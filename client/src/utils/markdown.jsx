import React from 'react';

// Lightweight markdown → JSX for AI replies — no library dependency,
// just the handful of things these models actually produce: **bold**,
// #/##/### headers, and "- "/"* " bullet lists. Renders real React
// elements (not dangerouslySetInnerHTML) so there's no injection risk.
// Originally lived only in AITools.jsx (Lumi's main chat) — pulled out
// here so Exam Assistant's Study Chat can reuse the exact same renderer
// instead of showing literal `**bold**` asterisks in its replies, which
// is exactly what was happening before this existed there.
function renderInlineMd(line, keyPrefix) {
  const parts = line.split(/(\*\*.+?\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
      : <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>
  );
}

export function renderMarkdown(text) {
  if (!text) return null;
  const lines = String(text).split('\n');
  const elements = [];
  let listBuffer = [];
  const flushList = () => {
    if (listBuffer.length) {
      elements.push(<ul key={`ul-${elements.length}`} className="list-disc ps-5 my-1 space-y-0.5">{listBuffer}</ul>);
      listBuffer = [];
    }
  };
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed === '') { flushList(); return; }
    if (/^#{1,4}\s+/.test(trimmed)) {
      flushList();
      const headerText = trimmed.replace(/^#{1,4}\s+/, '');
      elements.push(<p key={idx} className="font-bold mt-2.5 mb-1 first:mt-0">{renderInlineMd(headerText, idx)}</p>);
    } else if (/^[-*]\s+/.test(trimmed)) {
      listBuffer.push(<li key={idx}>{renderInlineMd(trimmed.replace(/^[-*]\s+/, ''), idx)}</li>);
    } else {
      flushList();
      elements.push(<p key={idx} className="mb-1 last:mb-0">{renderInlineMd(line, idx)}</p>);
    }
  });
  flushList();
  return elements;
}
