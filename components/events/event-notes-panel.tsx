"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Check,
  Eraser,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Pencil,
  RemoveFormatting,
  Save,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Notes for one event: a small rich-text editor and an optional sketch pad.
 *
 * The editor is a contenteditable driven by document.execCommand. That API is
 * deprecated but still implemented everywhere, and it is the only way to get
 * bold/lists/links without pulling in an editor package — the repo's
 * disk-space constraint rules out a new dependency for this.
 *
 * The HTML is sanitised server-side on save (see the notes route), not here:
 * client-side stripping is trivially bypassed, and the stored value has to be
 * safe for every later reader regardless of how it arrived.
 *
 * Autosaves 1.5s after typing stops, and on unmount, so a note survives a tab
 * change. The Save button is kept because autosave is invisible and people
 * want to know their work is committed.
 */

const AUTOSAVE_MS = 1500;

type SaveState = "idle" | "saving" | "saved" | "error";

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

export function EventNotesPanel({ eventSlug }: { eventSlug: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ html: string; sketch: string | null }>({ html: "", sketch: null });

  const [loading, setLoading] = useState(true);
  /**
   * Held in state rather than written straight to the ref: the editor is not
   * mounted while `loading` is true, so the ref is still null when the fetch
   * resolves and assigning innerHTML there silently did nothing.
   */
  const [initialHtml, setInitialHtml] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [sketchOpen, setSketchOpen] = useState(false);

  const save = useCallback(async () => {
    setSaveState("saving");
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(eventSlug)}/notes`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(latest.current),
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { updatedAt: string | null };
      setUpdatedAt(data.updatedAt);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [eventSlug]);

  const queueSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [save]);

  // Load, and flush any pending edit when leaving the tab.
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/events/${encodeURIComponent(eventSlug)}/notes`)
      .then((response) => (response.ok ? response.json() : { html: "", sketch: null }))
      .then((data: { html?: string; sketch?: string | null; updatedAt?: string | null }) => {
        if (!active) return;
        latest.current = { html: data.html ?? "", sketch: data.sketch ?? null };
        setInitialHtml(data.html ?? "");
        setUpdatedAt(data.updatedAt ?? null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (timer.current) {
        clearTimeout(timer.current);
        // Fire-and-forget: the component is going away, but the edit should not.
        void fetch(`/api/events/${encodeURIComponent(eventSlug)}/notes`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(latest.current),
          keepalive: true,
        });
      }
    };
  }, [eventSlug]);

  // Write the loaded note in once the editor is actually mounted. Done as an
  // effect, not during render: React does not own this subtree's content, so
  // setting innerHTML is the only way to seed it, and it must happen after the
  // element exists.
  useEffect(() => {
    if (loading || !editorRef.current) return;
    if (editorRef.current.innerHTML !== initialHtml) {
      editorRef.current.innerHTML = initialHtml;
    }
  }, [loading, initialHtml]);

  // Restore a saved sketch once the canvas exists.
  useEffect(() => {
    if (!sketchOpen || !canvasRef.current || !latest.current.sketch) return;
    const context = canvasRef.current.getContext("2d");
    if (!context) return;
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0);
    image.src = latest.current.sketch;
  }, [sketchOpen]);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    latest.current.html = editorRef.current?.innerHTML ?? "";
    setSaveState("idle");
    queueSave();
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
                ? "Save failed"
                : updatedAt
                  ? `Saved ${new Date(updatedAt).toLocaleString()}`
                  : "Not saved yet"}
          </span>
          <button
            type="button"
            onClick={() => void save()}
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

        <button
          type="button"
          onClick={() => setSketchOpen((open) => !open)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-semibold transition-colors",
            sketchOpen
              ? "border-indigo-500 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-500"
              : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-300"
          )}
        >
          <Pencil className="size-3.5" />
          Sketch
        </button>
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
          onInput={() => {
            latest.current.html = editorRef.current?.innerHTML ?? "";
            setSaveState("idle");
            queueSave();
          }}
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
    </div>
  );
}
