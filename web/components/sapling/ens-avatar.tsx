export function EnsAvatar({name}: {name: string}) {
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
    </span>
  );
}
