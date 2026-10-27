import { describe, expect, it } from 'vitest';
import {
  buildNoteFile,
  buildNoteFilename,
  deriveTitle,
  htmlToMarkdown,
  htmlToPlainText,
  isBlank,
  toNoteDto,
  UNTITLED,
} from '@/lib/events/notes';
import { sanitiseHtml, sanitiseSketch, sanitiseTitle } from '@/lib/events/note-sanitise';

describe('note titles', () => {
  it('uses the first line of the note', () => {
    expect(deriveTitle('<p>Meeting with Promethean</p><p>Stand NL40</p>')).toBe(
      'Meeting with Promethean'
    );
  });

  it('falls back to Untitled for an empty note', () => {
    expect(deriveTitle('')).toBe(UNTITLED);
    expect(deriveTitle('<p><br></p>')).toBe(UNTITLED);
  });

  it('drops the bullet marker when the note opens with a list', () => {
    expect(deriveTitle('<ul><li>Follow up on pricing</li></ul>')).toBe('Follow up on pricing');
  });

  it('truncates a very long first line rather than filling the row', () => {
    const title = deriveTitle(`<p>${'x'.repeat(200)}</p>`);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith('…')).toBe(true);
  });

  it('treats a note with only markup as blank', () => {
    expect(isBlank('<p></p><div><br></div>')).toBe(true);
    expect(isBlank('<p>something</p>')).toBe(false);
  });
});

describe('plain text export', () => {
  it('keeps block boundaries as line breaks instead of one run-on line', () => {
    expect(htmlToPlainText('<p>First</p><p>Second</p>')).toBe('First\nSecond');
  });

  it('marks list items so a bulleted note still reads as a list', () => {
    expect(htmlToPlainText('<ul><li>One</li><li>Two</li></ul>')).toBe('- One\n- Two');
  });

  it('strips formatting but keeps the words', () => {
    expect(htmlToPlainText('<p>Call <strong>Jane</strong> about <em>pricing</em></p>')).toBe(
      'Call Jane about pricing'
    );
  });

  it('decodes entities rather than leaving them raw', () => {
    expect(htmlToPlainText('<p>Smith &amp; Co &ndash; &ldquo;deal&rdquo;</p>')).toBe(
      'Smith & Co – “deal”'
    );
  });
});

describe('markdown export', () => {
  it('converts bold, italic and links', () => {
    const md = htmlToMarkdown(
      '<p><strong>Bold</strong> and <em>italic</em> and <a href="https://example.com">a link</a></p>'
    );
    expect(md).toContain('**Bold**');
    expect(md).toContain('*italic*');
    expect(md).toContain('[a link](https://example.com)');
  });

  it('numbers an ordered list instead of bulleting it', () => {
    const md = htmlToMarkdown('<ol><li>First</li><li>Second</li></ol>');
    expect(md).toContain('1. First');
    expect(md).toContain('2. Second');
  });

  it('bullets an unordered list', () => {
    expect(htmlToMarkdown('<ul><li>One</li></ul>')).toContain('- One');
  });

  it('adds a heading from the title when the note has no heading of its own', () => {
    const file = buildNoteFile('<p>Supplier shortlist</p><p>Three to call</p>', 'md');
    expect(file.startsWith('# Supplier shortlist')).toBe(true);
  });

  it('does not add a second heading when the note already starts with one', () => {
    const file = buildNoteFile('<h1>Agenda</h1><p>Item one</p>', 'md');
    expect(file.startsWith('# Agenda')).toBe(true);
    expect(file.match(/^#/gm)?.length).toBe(1);
  });

  it('escapes markdown characters in a title so they render as typed', () => {
    const file = buildNoteFile('<p>Budget *final* [v2]</p><p>body</p>', 'md');
    expect(file.startsWith('# Budget \\*final\\* \\[v2\\]')).toBe(true);
  });
});

describe('download filename', () => {
  it('follows the agreed pattern', () => {
    const name = buildNoteFilename('bett-show-london-2027-01-20', 'txt', new Date(2027, 0, 20));
    expect(name).toBe('prismconnex-event-bett-show-london-2027-01-20-2027-01-20-note.txt');
  });

  it('uses the md extension for markdown', () => {
    expect(buildNoteFilename('x', 'md', new Date(2026, 11, 1))).toBe(
      'prismconnex-event-x-2026-12-01-note.md'
    );
  });

  it('strips characters that could escape the filename', () => {
    const name = buildNoteFilename('../../etc/passwd', 'txt', new Date(2026, 0, 2));
    expect(name).not.toContain('/');
    expect(name).not.toContain('..');
  });
});

describe('note sanitising', () => {
  it('removes a script a paste could have carried in', () => {
    expect(sanitiseHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
  });

  it('strips event handler attributes', () => {
    expect(sanitiseHtml('<p onclick="steal()">text</p>')).toBe('<p>text</p>');
  });

  it('keeps an http link but drops a javascript one', () => {
    expect(sanitiseHtml('<a href="https://example.com">x</a>')).toContain('href="https://example.com"');
    expect(sanitiseHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
  });

  it('accepts only an inline PNG for the sketch', () => {
    expect(sanitiseSketch('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(sanitiseSketch('https://example.com/track.png')).toBeNull();
    expect(sanitiseSketch(42)).toBeNull();
  });

  it('reduces a title to plain text', () => {
    expect(sanitiseTitle('<b>Call</b>  Jane')).toBe('Call Jane');
  });
});

describe('note DTO', () => {
  const row = {
    id: 'n1',
    title: '',
    html: '<p>Derived from content</p>',
    sketch: null,
    saved: false,
    createdAt: new Date('2026-10-10T09:00:00.000Z'),
    updatedAt: new Date('2026-10-10T10:00:00.000Z'),
  };

  it('derives a title for rows written before the column existed', () => {
    expect(toNoteDto(row).title).toBe('Derived from content');
  });

  it('keeps a stored title when there is one', () => {
    expect(toNoteDto({ ...row, title: 'Explicit' }).title).toBe('Explicit');
  });

  it('serialises dates as ISO strings for the client', () => {
    expect(toNoteDto(row).updatedAt).toBe('2026-10-10T10:00:00.000Z');
  });
});
