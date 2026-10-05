/**
 * A small, forgiving HTML tree for reading organizer web pages: enough
 * structure to find repeated exhibitor cards (a link, its logo, its booth)
 * without a DOM library. Unclosed and misnested tags are tolerated the way
 * browsers mostly do: a closing tag closes up to its nearest open match, and
 * an unmatched one is ignored.
 */

export type HtmlNode = {
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
  parent: HtmlNode | null;
  /** Text directly inside this element, in order (child element text is not included). */
  text: string[];
};

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'noscript', 'template', 'svg', 'textarea']);
/** Elements that close an open <p> or <li> of the same kind when a new one starts. */
const AUTO_CLOSE: Record<string, Set<string>> = {
  p: new Set(['p', 'div', 'ul', 'ol', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'header', 'footer']),
  li: new Set(['li']),
  option: new Set(['option']),
  tr: new Set(['tr']),
  td: new Set(['td', 'th', 'tr']),
  th: new Set(['td', 'th', 'tr']),
};

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

export function decodeHtml(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    return ENTITIES[code.toLowerCase()] ?? entity;
  });
}

function parseAttrs(source: string) {
  const attrs: Record<string, string> = {};
  for (const match of Array.from(source.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g))) {
    const name = match[1].toLowerCase();
    if (!(name in attrs)) attrs[name] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

/** The page as a tree under a synthetic root. Script, style and similar raw elements are dropped. */
export function parseHtml(html: string): HtmlNode {
  const root: HtmlNode = { tag: '#root', attrs: {}, children: [], parent: null, text: [] };
  const source = html.slice(0, 4_000_000);
  let current = root;
  const token = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/?([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(source))) {
    if (match.index > last) {
      const text = source.slice(last, match.index);
      if (text.trim()) current.text.push(decodeHtml(text));
    }
    last = token.lastIndex;
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    const closing = match[0][1] === '/';
    if (closing) {
      let node: HtmlNode | null = current;
      while (node && node.tag !== name) node = node.parent;
      if (node && node.parent) current = node.parent;
      continue;
    }
    if (RAW.has(name)) {
      // Skip to the matching close tag; the content is never page text.
      const end = source.toLowerCase().indexOf(`</${name}`, last);
      last = token.lastIndex = end < 0 ? source.length : source.indexOf('>', end) + 1 || source.length;
      continue;
    }
    const closes = AUTO_CLOSE[current.tag];
    if (closes?.has(name)) current = current.parent ?? root;
    const node: HtmlNode = { tag: name, attrs: parseAttrs(match[2] ?? ''), children: [], parent: current, text: [] };
    current.children.push(node);
    if (!VOID.has(name) && !/\/\s*$/.test(match[2] ?? '')) current = node;
  }
  if (last < source.length && source.slice(last).trim()) current.text.push(decodeHtml(source.slice(last)));
  return root;
}

/** Every element under `node`, depth first, in document order. */
export function descendants(node: HtmlNode): HtmlNode[] {
  const out: HtmlNode[] = [];
  const stack = [...node.children].reverse();
  while (stack.length) {
    const next = stack.pop()!;
    out.push(next);
    for (let index = next.children.length - 1; index >= 0; index -= 1) stack.push(next.children[index]);
  }
  return out;
}

/** The visible text of an element, whitespace collapsed. */
export function textOf(node: HtmlNode): string {
  const parts: string[] = [];
  const walk = (current: HtmlNode) => {
    // Interleave is not tracked; order of own text then children is close enough for short card text.
    parts.push(...current.text);
    for (const child of current.children) {
      if (child.tag === 'br' || /^(?:p|div|li|h\d|td|th|tr|section|article)$/.test(child.tag)) parts.push(' ');
      walk(child);
    }
  };
  walk(node);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export const ancestors = (node: HtmlNode) => {
  const out: HtmlNode[] = [];
  for (let current = node.parent; current; current = current.parent) out.push(current);
  return out;
};

const CHROME_TOKEN = /^(?:site-|main-|global-|page-|top-|primary-)?(?:nav|navbar|navigation|menu|megamenu|mainmenu|footer|header|breadcrumbs?|sidebar)$|cookie|consent/i;

/**
 * Page chrome whose links are navigation, not content: <nav>/<aside>, the
 * page's own <header>/<footer> (not a card's, inside <article>/<li>/<main>),
 * and elements whose class or id names the site menu, header or footer.
 */
export function isChrome(node: HtmlNode) {
  const chain = [node, ...ancestors(node)];
  return chain.some((item, index) => {
    if (item.tag === 'nav' || item.tag === 'aside' || item.attrs.role === 'navigation') return true;
    if ((item.tag === 'header' || item.tag === 'footer') && !chain.slice(index + 1).some((outer) => /^(?:article|li|main)$/.test(outer.tag))) return true;
    return `${item.attrs.class ?? ''} ${item.attrs.id ?? ''}`.split(/\s+/).some((token) => token && CHROME_TOKEN.test(token));
  });
}
