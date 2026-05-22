"use client";

import {useState} from "react";

export function EnsAvatar({name, src}: {name: string; src?: string}) {
  // Track which src URL failed so a *new* src can try again. Using the URL
  // (not a boolean) sidesteps the React 19 "setState in effect on prop change"
  // antipattern — `broken` resets implicitly whenever `src` changes.
  const [brokenSrc, setBrokenSrc] = useState<string>();
  const broken = src !== undefined && brokenSrc === src;

  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  const h1 = h % 360;
  const h2 = (h1 + 50) % 360;

  return (
    <span className="w-8 h-8 rounded-full flex-shrink-0 bg-bg-sunk border border-border flex items-center justify-center font-mono text-[11px] text-fg-3 overflow-hidden relative">
      <span
        className="absolute inset-0"
        style={{
          background: `conic-gradient(from ${h % 360}deg, oklch(70% 0.08 ${h1}), oklch(55% 0.1 ${h2}), oklch(70% 0.08 ${h1}))`,
        }}
      />
      {src && !broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBrokenSrc(src)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </span>
  );
}
