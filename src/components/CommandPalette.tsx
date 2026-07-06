import { useEffect, useMemo, useRef, useState } from "react";

// ⌘K command palette — jump to a page or fire a question at Cadence from anywhere.

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  section: "Navigate" | "Ask Cadence";
  run: () => void;
}

export default function CommandPalette({
  open,
  onClose,
  actions,
  onAskFree,
}: {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
  onAskFree: (q: string) => void;
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () => actions.filter((a) => !query || a.label.toLowerCase().includes(query) || a.hint?.toLowerCase().includes(query)),
    [actions, query]
  );
  // Free-form ask always available when the user typed something.
  const freeAsk: PaletteAction[] = q.trim()
    ? [{ id: "__free", label: `Ask Cadence: “${q.trim()}”`, section: "Ask Cadence", run: () => onAskFree(q.trim()) }]
    : [];
  const items = [...freeAsk, ...filtered];

  useEffect(() => setIdx(0), [query]);

  if (!open) return null;

  const pick = (i: number) => {
    const item = items[i];
    if (!item) return;
    onClose();
    item.run();
  };

  const sections = Array.from(new Set(items.map((i) => i.section)));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 pt-[14vh]" onClick={onClose}>
      <div
        className="flex max-h-[62vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 shrink-0">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); pick(idx); }
              else if (e.key === "Escape") onClose();
            }}
            placeholder="Type a question or jump to a page…"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">esc</kbd>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {items.length === 0 && <div className="px-3 py-8 text-center text-sm text-slate-400">Nothing matches.</div>}
          {sections.map((section) => (
            <div key={section}>
              <div className="px-3 pb-1 pt-2.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{section}</div>
              {items.map((item, i) =>
                item.section !== section ? null : (
                  <button
                    key={item.id}
                    onClick={() => pick(i)}
                    onMouseEnter={() => setIdx(i)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${i === idx ? "bg-[var(--color-brand-soft)]" : "hover:bg-slate-50"}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px]">
                      {item.section === "Navigate" ? "→" : "✨"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-slate-900">{item.label}</span>
                      {item.hint && <span className="block truncate text-[11px] text-slate-400">{item.hint}</span>}
                    </span>
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
