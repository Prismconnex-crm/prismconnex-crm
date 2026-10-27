"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Check,
  Download,
  Eraser,
  Eye,
  FileText,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Pencil,
  Plus,
  RemoveFormatting,
  Save,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildNoteFile,
  buildNoteFilename,
  deriveTitle,
  isBlank,
  UNTITLED,
  type NoteExportFormat,
} from "@/lib/events/notes";

/**
 * Notes for one event: a rich-text editor, an optional sketch pad, and the
 * event's other notes listed underneath.
 *
 * The editor is a contenteditable driven by document.execCommand. That API is
 * deprecated but still implemented everywhere, and it is the only way to get
 * bold/lists/links without pulling in an editor package — the repo's
 * disk-space constraint rules out a new dependency for this.
 *
 * The HTML is sanitised server-side on write (lib/events/note-sanitise.ts), not
 * here: client-side stripping is trivially bypassed, and the stored value has
 * to be safe for every later reader regardless of how it arrived.
 *
 * Durability has three layers, because losing a typed note is the one failure
 * that matters here:
 *   1. autosave 1.5s after typing stops,
 *   2. a flush on unmount with keepalive, so switching tabs does not drop an
 *      edit mid-debounce,
 *   3. a localStorage mirror written on every keystroke, reconciled on load, so
 *      a crash or an offline spell still leaves the text recoverable.
 */

const AUTOSAVE_MS = 1500;
const LOCAL_PREFIX = "pcx-event-note-draft:";

type SaveState = "idle" | "saving" | "saved" | "error";
type ListTab = "Recent" | "Saved";

type Note = {
  id: string;
  title: string;
  html: string;
  sketch: string | null;
  saved: boolean;
  createdAt: string;
  updatedAt: string;
};

/** What the localStorage mirror holds for one event. */
type LocalDraft = {
  noteId: string | null;
  html: string;
  sketch: string | null;
  updatedAt: string;
};

function readLocalDraft(slug: string): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_PREFIX + slug);
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    // Private browsing and blocked site-data both throw on access.
    return null;
  }
}

function writeLocalDraft(slug: string, draft: LocalDraft) {
  try {
    window.localStorage.setItem(LOCAL_PREFIX + slug, JSON.stringify(draft));
  } catch {
    // A full or unavailable store must not break typing.
  }
}

function clearLocalDraft(slug: string) {
  try {
    window.localStorage.removeItem(LOCAL_PREFIX + slug);
  } catch {
    /* no-op */
  }
}

function formatStamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // Keeps focus in the editor, so execCommand applies to the selection.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      className="inline-flex size-8 items-center justify-center rounded-[8px] border border-slate-200 bg-white text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-300 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300"
    >
      {children}
    </button>
  );
}

/** Shares the Sketch button's shape so the three sit as one group. */
function ActionButton({
  onClick,
  active,
  title,
  icon,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-semibold transition-colors",
        active
          ? "border-indigo-500 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-500"
          : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-300"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function EventNotesPanel({ eventSlug }: { eventSlug: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const downloadRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ html: string; sketch: string | null }>({ html: "", sketch: null });
  /**
   * The note the pending autosave belongs to. Held in a ref so a save queued
   * before the user clicked View still lands on the note they were typing in,
   * rather than overwriting the one they just opened.
   */
  const pendingId = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  /**
   * Held in state rather than written straight to the ref: the editor is not
   * mounted while `loading` is true, so the ref is still null when the fetch
   * resolves and assigning innerHTML there silently did nothing.
   */
  const [editorHtml, setEditorHtml] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [sketchOpen, setSketchOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [listTab, setListTab] = useState<ListTab>("Recent");

  const base = `/api/events/${encodeURIComponent(eventSlug)}/notes`;

  const active = useMemo(
    () => notes.find((note) => note.id === activeId) ?? null,
    [notes, activeId]
  );

  const upsertNote = useCallback((note: Note) => {
    setNotes((current) => {
      const without = current.filter((item) => item.id !== note.id);
      return [note, ...without].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }, []);

  /**
   * Writes the current buffer. Creates the note first if this event had none —
   * an event nobody has written about should not carry an empty row, so the
   * record is made on first keystroke rather than on first visit.
   */
  const persist = useCallback(
    async (options?: { saved?: boolean }) => {
      const payload = {
        html: latest.current.html,
        sketch: latest.current.sketch,
        title: deriveTitle(latest.current.html),
        ...(options?.saved === undefined ? {} : { saved: options.saved }),
      };
      const targetId = pendingId.current ?? activeId;

      setSaveState("saving");
      try {
        const response = targetId
          ? await fetch(`${base}/${targetId}`, {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(base, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });
        if (!response.ok) throw new Error(String(response.status));

        const note = (await response.json()) as Note;
        upsertNote(note);
        if (!targetId) {
          setActiveId(note.id);
          pendingId.current = note.id;
        }
        setSaveState("saved");
        clearLocalDraft(eventSlug);
        return note;
      } catch {
        // The localStorage mirror is the fallback: it already holds this text,
        // so a failed request loses nothing.
        setSaveState("error");
        return null;
      }
    },
    [activeId, base, eventSlug, upsertNote]
  );

  const queueSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), AUTOSAVE_MS);
  }, [persist]);

  /** Called on every edit: mirror locally first, then debounce the server write. */
  const onEdited = useCallback(() => {
    latest.current.html = editorRef.current?.innerHTML ?? "";
    writeLocalDraft(eventSlug, {
      noteId: pendingId.current ?? activeId,
      html: latest.current.html,
      sketch: latest.current.sketch,
      updatedAt: new Date().toISOString(),
    });
    setSaveState("idle");
    queueSave();
  }, [activeId, eventSlug, queueSave]);

  // Load every note for the event, then reconcile anything left locally.
  useEffect(() => {
    let live = true;
    setLoading(true);
    pendingId.current = null;

    fetch(base)
      .then((response) => (response.ok ? response.json() : { notes: [] }))
      .then((data: { notes?: Note[] }) => {
        if (!live) return;
        const loaded = data.notes ?? [];
        setNotes(loaded);

        const draft = readLocalDraft(eventSlug);
        const newest = loaded[0] ?? null;
        // A local mirror newer than the server copy means the last write never
        // landed — a crash, a closed tab, or an offline spell. Prefer it.
        const serverStamp = newest ? new Date(newest.updatedAt).getTime() : 0;
        const localStamp = draft ? new Date(draft.updatedAt).getTime() : 0;
        const useLocal = Boolean(draft) && localStamp > serverStamp;

        if (useLocal && draft) {
          const target = draft.noteId ?? newest?.id ?? null;
          setActiveId(target);
          pendingId.current = target;
          latest.current = { html: draft.html, sketch: draft.sketch };
          setEditorHtml(draft.html);
          setSaveState("idle");
        } else {
          setActiveId(newest?.id ?? null);
          pendingId.current = newest?.id ?? null;
          latest.current = { html: newest?.html ?? "", sketch: newest?.sketch ?? null };
          setEditorHtml(newest?.html ?? "");
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
      if (timer.current) {
        clearTimeout(timer.current);
        const targetId = pendingId.current;
        const body = JSON.stringify({
          html: latest.current.html,
          sketch: latest.current.sketch,
          title: deriveTitle(latest.current.html),
        });
        // Fire-and-forget: the component is going away, but the edit should not.
        void fetch(targetId ? `${base}/${targetId}` : base, {
          method: targetId ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        });
      }
    };
  }, [base, eventSlug]);

  // Write the loaded note in once the editor is actually mounted. Done as an
  // effect, not during render: React does not own this subtree's content, so
  // setting innerHTML is the only way to seed it, and it must happen after the
  // element exists.
  useEffect(() => {
    if (loading || !editorRef.current) return;
    if (editorRef.current.innerHTML !== editorHtml) {
      editorRef.current.innerHTML = editorHtml;
    }
  }, [loading, editorHtml]);

  // Restore a saved sketch once the canvas exists.
  useEffect(() => {
    if (!sketchOpen || !canvasRef.current) return;
    const context = canvasRef.current.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (!latest.current.sketch) return;
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0);
    image.src = latest.current.sketch;
  }, [sketchOpen, activeId]);

  // Close the download menu on an outside click.
  useEffect(() => {
    if (!downloadOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!downloadRef.current?.contains(event.target as Node)) setDownloadOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [downloadOpen]);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    onEdited();
  };

  const addLink = () => {
    const url = window.prompt("Link URL");
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      window.alert("Links must start with http:// or https://");
      return;
    }
    exec("createLink", url);
  };

  /** Flushes any pending edit so switching notes cannot drop it. */
  const flushPending = useCallback(async () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    await persist();
  }, [persist]);

  const openNote = useCallback(
    async (note: Note) => {
      await flushPending();
      setActiveId(note.id);
      pendingId.current = note.id;
      latest.current = { html: note.html, sketch: note.sketch };
      setEditorHtml(note.html);
      setSaveState("idle");
      clearLocalDraft(eventSlug);
    },
    [eventSlug, flushPending]
  );

  const newNote = useCallback(async () => {
    await flushPending();
    // Deliberately not created server-side yet: an empty note the user abandons
    // should leave no row behind. The first keystroke POSTs it.
    setActiveId(null);
    pendingId.current = null;
    latest.current = { html: "", sketch: null };
    setEditorHtml("");
    setSaveState("idle");
    clearLocalDraft(eventSlug);
    editorRef.current?.focus();
  }, [eventSlug, flushPending]);

  const saveNote = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const note = await persist({ saved: true });
    if (note) setListTab("Saved");
  }, [persist]);

  const deleteNote = useCallback(
    async (note: Note) => {
      if (!window.confirm(`Delete "${note.title || UNTITLED}"? This cannot be undone.`)) return;
      try {
        const response = await fetch(`${base}/${note.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error(String(response.status));
        setNotes((current) => current.filter((item) => item.id !== note.id));
        if (note.id === activeId) {
          setActiveId(null);
          pendingId.current = null;
          latest.current = { html: "", sketch: null };
          setEditorHtml("");
        }
      } catch {
        setSaveState("error");
      }
    },
    [activeId, base]
  );

  const download = useCallback(
    (format: NoteExportFormat) => {
      setDownloadOpen(false);
      const content = buildNoteFile(latest.current.html, format);
      const blob = new Blob([content], {
        type: format === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildNoteFilename(eventSlug, format);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Revoked on the next tick so the download has taken the blob.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    [eventSlug]
  );

  const captureSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    latest.current.sketch = canvas.toDataURL("image/png");
    setSaveState("idle");
    queueSave();
  };

  const pointerPos = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // The canvas is sized in CSS pixels but drawn in its own coordinate space.
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    drawing.current = true;
    const { x, y } = pointerPos(event);
    context.beginPath();
    context.moveTo(x, y);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#6366f1";
  };

  const moveDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const { x, y } = pointerPos(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const endDraw = () => {
    if (!drawing.current) return;
    drawing.current = false;
    captureSketch();
  };

  const clearSketch = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    latest.current.sketch = null;
    setSaveState("idle");
    queueSave();
  };

  const listed = useMemo(
    () => (listTab === "Saved" ? notes.filter((note) => note.saved) : notes),
    [notes, listTab]
  );

  const hasContent = !isBlank(editorHtml) || Boolean(latest.current.html);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-[#22304A] dark:bg-[#111B2E]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
          Notes
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {saveState === "saving"
              ? "Saving..."
              : saveState === "error"
                ? "Save failed — kept on this device"
                : active
                  ? `${active.saved ? "Saved" : "Draft"} ${formatStamp(active.updatedAt)}`
                  : "New note"}
          </span>
          <button
            type="button"
            onClick={() => void saveNote()}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[8px] bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {saveState === "saving" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : saveState === "saved" ? (
              <Check className="size-3.5" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <ToolbarButton onClick={() => exec("bold")} title="Bold">
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} title="Italic">
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Bullet list">
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("insertOrderedList")} title="Numbered list">
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton onClick={addLink} title="Link">
          <Link2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("removeFormat")} title="Clear formatting">
          <RemoveFormatting className="size-4" />
        </ToolbarButton>

        <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-[#22304A]" />

        <ActionButton
          onClick={() => setSketchOpen((open) => !open)}
          active={sketchOpen}
          title="Sketch pad"
          icon={<Pencil className="size-3.5" />}
          label="Sketch"
        />

        <ActionButton
          onClick={() => void newNote()}
          title="Start a new note for this event"
          icon={<Plus className="size-3.5" />}
          label="New"
        />

        <div ref={downloadRef} className="relative">
          <ActionButton
            onClick={() => setDownloadOpen((open) => !open)}
            active={downloadOpen}
            title="Download this note"
            icon={<Download className="size-3.5" />}
            label="Download"
          />
          {downloadOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-[10px] border border-slate-200 bg-white py-1 shadow-xl dark:border-[#22304A] dark:bg-[#0B1220]"
            >
              {(["txt", "md"] as const).map((format) => (
                <button
                  key={format}
                  type="button"
                  role="menuitem"
                  disabled={!hasContent}
                  onClick={() => download(format)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 dark:text-slate-200 dark:hover:bg-white/5 dark:disabled:text-slate-600"
                >
                  <FileText className="size-3.5" />
                  {format === "txt" ? "Plain text (.txt)" : "Markdown (.md)"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
          <Loader2 className="size-4 animate-spin" />
          Loading notes...
        </div>
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Event notes"
          onInput={onEdited}
          className="min-h-[220px] w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-[13px] leading-6 text-slate-800 outline-none transition-colors focus:border-indigo-400 dark:border-[#22304A] dark:bg-[#0B1220]/60 dark:text-slate-100 [&_a]:text-indigo-600 [&_a]:underline dark:[&_a]:text-indigo-300 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
        />
      )}

      {sketchOpen ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
              Sketch
            </p>
            <button
              type="button"
              onClick={clearSketch}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-300"
            >
              <Trash2 className="size-3.5" />
              Clear
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={900}
            height={320}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            className="w-full cursor-crosshair touch-none rounded-2xl border border-slate-200 bg-white dark:border-[#22304A] dark:bg-[#0B1220]"
          />
          <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
            <Eraser className="size-3" />
            Drawn strokes save with the note.
          </p>
        </div>
      ) : null}

      {/* Every note for this event. Recent is everything newest-first; Saved is
          only what the user committed with the Save button. */}
      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-[#22304A]">
        <div className="mb-3 inline-flex items-center gap-1 rounded-[10px] border border-slate-200 bg-slate-50 p-0.5 dark:border-[#22304A] dark:bg-[#0B1220]">
          {(["Recent", "Saved"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setListTab(tab)}
              className={cn(
                "rounded-[8px] px-3 py-1 text-[12px] font-semibold transition-colors",
                listTab === tab
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-[#111B2E] dark:text-indigo-300"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {tab}
              <span className="ml-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                {tab === "Saved" ? notes.filter((note) => note.saved).length : notes.length}
              </span>
            </button>
          ))}
        </div>

        {listed.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-slate-400 dark:text-slate-500">
            {listTab === "Saved"
              ? "Nothing saved yet. Press Save to keep a note here."
              : "No notes for this event yet."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {listed.map((note) => (
              <li
                key={note.id}
                className={cn(
                  "flex items-center gap-3 rounded-[10px] border px-3 py-2 transition-colors",
                  note.id === activeId
                    ? "border-indigo-300 bg-indigo-50/60 dark:border-indigo-400/40 dark:bg-indigo-500/10"
                    : "border-slate-200 bg-white hover:border-indigo-200 dark:border-[#22304A] dark:bg-[#0B1220] dark:hover:border-indigo-400/30"
                )}
              >
                <button
                  type="button"
                  onClick={() => void deleteNote(note)}
                  title="Delete note"
                  aria-label={`Delete ${note.title || UNTITLED}`}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-[7px] border border-slate-200 bg-white text-slate-400 transition-colors hover:border-rose-300 hover:text-rose-600 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-500 dark:hover:border-rose-400/50 dark:hover:text-rose-400"
                >
                  <Trash2 className="size-3.5" />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                    {note.title || UNTITLED}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                    {formatStamp(note.updatedAt)}
                    {note.saved ? (
                      <span className="rounded-full bg-emerald-500/10 px-1.5 py-px font-semibold text-emerald-600 dark:text-emerald-400">
                        Saved
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/10 px-1.5 py-px font-semibold text-amber-600 dark:text-amber-500">
                        Draft
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void openNote(note)}
                  className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-300 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300"
                >
                  <Eye className="size-3.5" />
                  View
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
