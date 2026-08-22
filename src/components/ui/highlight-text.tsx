"use client";

import { memo } from "react";

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="bg-yellow-200 dark:bg-yellow-900/60 text-foreground rounded px-0.5">{part}</mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

export default memo(HighlightText);
