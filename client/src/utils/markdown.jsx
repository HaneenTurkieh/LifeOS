import React from 'react';

// Lightweight markdown → JSX for AI replies — no library dependency,
// handles what these models actually produce: **bold**, `inline code`,
// fenced ```code blocks```, #/##/### headers, horizontal rules (---),
// and "- "/"* "/"1. " lists. Renders real React elements (not
// dangerouslySetInnerHTML) so there's no injection risk.
// Originally lived only in AITools.jsx (Lumi's main chat) — pulled out
// here so Exam Assistant's Study Chat can reuse the exact same renderer
// instead of showing literal `**bold**` asterisks in its replies, which
// is exactly what was happening before this existed there.
//
// Sept 2026: Haneen flagged fenced code blocks and horizontal rules
// showing up as literal ``` / --- text instead of being rendered — this
// was a real gap, not a one-off: Lumi routinely answers with a code
// block (exactly what happened here, teaching git commands) or a "---"
// section divider, and neither had ever been handled — every line
// inside/around a code fence just fell through to the plain-paragraph
// branch below, one line at a time, with nothing to say "this multi-line
// span is one verbatim block." Added a real fenced-code pass (scans
// forward to the closing fence instead of processing line-by-line),
// inline `code` spans, horizontal rules, and numbered lists; headers now
// render as actual heading tags with a size per level instead of every
// level looking identical.
function renderInlineMd(line, keyPrefix) {
  // **bold** and `inline code` in one pass so a line can mix both
  // without one splitter's output confusing the other's.
  const parts = line.split(/(\*\*.+?\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 3) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      return (
        <code key={`${keyPrefix}-${i}`} className="px-1 py-0.5 rounded-md bg-ink/[0.07] dark:bg-white/10 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

// A model's own "#" is a sub-point inside a chat bubble, not a page
// title — bump every level down two notches (h1→h3) so it never
// outsizes the rest of the reply, with a matching text-size step per
// original level.
const HEADER_SIZE = { 1: 'text-[15px]', 2: 'text-sm', 3: 'text-sm', 4: 'text-xs' };

export function renderMarkdown(text) {
  if (!text) return null;
  const lines = String(text).split('\n');
  const elements = [];
  let listBuffer = [];
  let listType = null; // 'ul' | 'ol' — which kind is currently being buffered
  const flushList = () => {
    if (listBuffer.length) {
      const ordered = listType === 'ol';
      const cls = ordered ? 'list-decimal ps-5 my-1 space-y-0.5' : 'list-disc ps-5 my-1 space-y-0.5';
      elements.push(
        ordered
          ? <ol key={`list-${elements.length}`} className={cls}>{listBuffer}</ol>
          : <ul key={`list-${elements.length}`} className={cls}>{listBuffer}</ul>
      );
      listBuffer = [];
      listType = null;
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block — collect every line verbatim up to the closing
    // ``` (or end of text, if a reply got cut off mid-block) instead of
    // handling it one line at a time like everything else here, which is
    // what left the raw ``` markers and unformatted lines visible before.
    const fenceMatch = /^```(\w*)\s*$/.exec(trimmed);
    if (fenceMatch) {
      flushList();
      const codeLines = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== '```') {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip the closing fence line itself (harmless if we ran off the end instead)
      elements.push(
        <pre key={`code-${elements.length}`}
          className="my-1.5 rounded-xl px-3 py-2.5 text-xs font-mono overflow-x-auto whitespace-pre bg-ink/[0.06] dark:bg-white/[0.08] border border-ink/10 dark:border-white/10">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    if (trimmed === '') { flushList(); i += 1; continue; }

    // Horizontal rule — a line that's nothing but 3+ of the same -, *,
    // or _ character (ignoring internal spacing, e.g. "- - -"). Checked
    // before the bullet match below: a real bullet like "- item" always
    // has non-dash content after it, so this never swallows one.
    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
      flushList();
      elements.push(<hr key={`hr-${i}`} className="my-2.5 border-ink/10 dark:border-white/10" />);
      i += 1;
      continue;
    }

    const headerMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const HeaderTag = `h${Math.min(level + 2, 6)}`;
      elements.push(
        <HeaderTag key={i} className={`font-bold mt-2.5 mb-1 first:mt-0 ${HEADER_SIZE[level] || 'text-sm'}`}>
          {renderInlineMd(headerMatch[2], i)}
        </HeaderTag>
      );
      i += 1;
      continue;
    }

    const olMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (olMatch) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listBuffer.push(<li key={i}>{renderInlineMd(olMatch[1], i)}</li>);
      i += 1;
      continue;
    }

    const ulMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (ulMatch) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listBuffer.push(<li key={i}>{renderInlineMd(ulMatch[1], i)}</li>);
      i += 1;
      continue;
    }

    flushList();
    elements.push(<p key={i} className="mb-1 last:mb-0">{renderInlineMd(line, i)}</p>);
    i += 1;
  }
  flushList();
  return elements;
}
