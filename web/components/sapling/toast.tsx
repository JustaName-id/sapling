"use client";

import {useEffect, useState} from "react";

let toastId = 0;
const listeners = new Set<(msg: string | null) => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string) {
  toastId++;
  listeners.forEach(l => l(message));
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => listeners.forEach(l => l(null)), 1800);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const l = (m: string | null) => setMsg(m);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (!msg) return null;
  return (
    <div
      className="fixed left-1/2 bottom-8 -translate-x-1/2 bg-fg text-bg py-2.5 px-3.5 rounded-[12px] text-[13px] font-medium z-50 shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
      style={{animation: "sapling-toast-in 0.18s ease"}}
    >
      {msg}
    </div>
  );
}
