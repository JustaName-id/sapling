"use client";

import {useState} from "react";

export function shortAddr(a: string | undefined | null, l = 6, r = 4): string {
  if (!a) return "";
  if (a.length <= l + r + 2) return a;
  return `${a.slice(0, l)}…${a.slice(-r)}`;
}

export function Address({
  value,
  short = true,
  showCopy = true,
  explorerHref,
  className,
}: {
  value: string;
  short?: boolean;
  showCopy?: boolean;
  /** When provided, renders an external-link icon button next to copy. */
  explorerHref?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-[13px] text-fg ${className ?? ""}`}
    >
      <span>{short ? shortAddr(value) : value}</span>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy address"
          title={copied ? "Copied" : "Copy"}
          className={`appearance-none border-0 bg-transparent p-1 rounded-[4px] inline-flex cursor-pointer transition-colors ${
            copied
              ? "text-accent"
              : "text-fg-4 hover:text-fg-2 hover:bg-bg-sunk"
          }`}
        >
          {copied ? (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8l3 3 7-7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect
                x="5"
                y="5"
                width="9"
                height="9"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"
                stroke="currentColor"
                strokeWidth="1.3"
              />
            </svg>
          )}
        </button>
      )}
      {explorerHref && (
        <a
          href={explorerHref}
          target="_blank"
          rel="noreferrer"
          aria-label="View on block explorer"
          title="View on explorer"
          onClick={e => e.stopPropagation()}
          className="appearance-none p-1 rounded-[4px] inline-flex text-fg-4 hover:text-fg-2 hover:bg-bg-sunk transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M5 11L11 5M11 5H6.5M11 5V9.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M9.5 2.5h-6A1 1 0 0 0 2.5 3.5v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-6"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </a>
      )}
    </span>
  );
}
