import React from "react";

// A small, dependency-free markdown renderer tuned for chat answers.
// Supports: headings, bold/italic, inline code, fenced code, GFM pipe tables,
// blockquotes, ordered/unordered lists, horizontal rules, and links.

export default function Markdown({ children }: { children: string }) {
  return <div className="space-y-3 text-sm leading-relaxed text-slate-800">{renderBlocks(children)}</div>;
}

// ── Inline (bold / italic / code / links) ────────────────────────────────────
const INLINE = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)]+)\))/;

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest.length) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    if (m[1]) out.push(<strong key={`${key}-${i++}`} className="font-semibold text-slate-900">{m[2]}</strong>);
    else if (m[3]) out.push(<code key={`${key}-${i++}`} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800">{m[4]}</code>);
    else if (m[5]) out.push(<em key={`${key}-${i++}`}>{m[6]}</em>);
    else if (m[7]) out.push(<a key={`${key}-${i++}`} href={m[9]} target="_blank" rel="noreferrer" className="text-[var(--color-brand)] underline">{m[8]}</a>);
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

// ── Block-level parsing ──────────────────────────────────────────────────────
const isHr = (l: string) => /^\s*([-*_])(\s*\1){2,}\s*$/.test(l);
const isTableSep = (l: string) => l.includes("|") && /-/.test(l) && /^[\s|:-]+$/.test(l);
const splitRow = (l: string) =>
  l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function renderBlocks(src: string): React.ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // blank
    if (line.trim() === "") { i++; continue; }

    // fenced code
    if (line.trim().startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      i++; // closing fence
      blocks.push(
        <pre key={k++} className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2.5 font-mono text-[0.8rem] leading-relaxed text-slate-100">
          <code>{body.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // horizontal rule
    if (isHr(line)) { blocks.push(<hr key={k++} className="border-slate-200" />); i++; continue; }

    // heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const content = inline(h[2], `h${k}`);
      const cls =
        level <= 1 ? "mt-1 text-lg font-bold text-slate-900"
        : level === 2 ? "mt-2 border-b border-slate-200 pb-1 text-base font-semibold text-slate-900"
        : "mt-1 text-sm font-semibold text-slate-900";
      blocks.push(React.createElement(`h${Math.min(level, 6)}`, { key: k++, className: cls }, content));
      i++;
      continue;
    }

    // blockquote (used for the 📊 callouts)
    if (line.trimStart().startsWith(">")) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) {
        quoted.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={k++} className="rounded-r-md border-l-4 border-[var(--color-brand)] bg-[var(--color-brand-soft)]/50 px-3 py-2">
          <div className="space-y-1">{renderBlocks(quoted.join("\n"))}</div>
        </blockquote>
      );
      continue;
    }

    // table
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={k++} className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {header.map((c, ci) => (
                  <th key={ci} className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left font-semibold text-slate-700">
                    {inline(c, `th-${k}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="even:bg-slate-50/40">
                  {header.map((_, ci) => (
                    <td key={ci} className="border border-slate-200 px-2.5 py-1.5 align-top">
                      {inline(r[ci] ?? "", `td-${k}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // lists (ordered / unordered)
    const listMatch = /^(\s*)([-*+]|\d+\.)\s+/.exec(line);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]);
      const items: string[] = [];
      while (i < lines.length) {
        const lm = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (!lm) break;
        items.push(lm[3]);
        i++;
      }
      const itemNodes = items.map((it, ii) => (
        <li key={ii} className="pl-1">{inline(it, `li-${k}-${ii}`)}</li>
      ));
      blocks.push(
        ordered
          ? <ol key={k++} className="list-decimal space-y-1 pl-5">{itemNodes}</ol>
          : <ul key={k++} className="list-disc space-y-1 pl-5">{itemNodes}</ul>
      );
      continue;
    }

    // paragraph: gather consecutive plain lines
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !isHr(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !lines[i].trimStart().startsWith(">") &&
      !lines[i].trim().startsWith("```") &&
      !/^(\s*)([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={k++}>{inline(para.join(" "), `p${k}`)}</p>);
  }

  return blocks;
}
