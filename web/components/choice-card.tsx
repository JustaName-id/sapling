"use client";

export function ChoiceCard({
  selected,
  disabled,
  badge,
  onClick,
  title,
  body,
  tone = "default",
}: {
  selected: boolean;
  disabled?: boolean;
  badge?: string;
  onClick: () => void;
  title: string;
  body: string;
  tone?: "default" | "warning";
}) {
  const accent = tone === "warning" ? "var(--danger)" : "var(--fg)";
  const borderColor = disabled
    ? "var(--border)"
    : selected
      ? accent
      : "var(--border)";
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`text-left p-4 rounded-[12px] border bg-bg-elev transition-all w-full ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:border-border-strong cursor-pointer"
      }`}
      style={{
        borderColor,
        borderWidth: selected && !disabled ? 2 : 1,
        padding: selected && !disabled ? "15px" : "16px",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0"
            style={{
              borderColor: selected && !disabled ? accent : "var(--border-strong)",
              borderWidth: 1.5,
            }}
          >
            {selected && !disabled && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{background: accent}}
              />
            )}
          </span>
          <span
            className="text-[14px] font-medium truncate"
            style={{
              color: selected && !disabled && tone === "warning" ? accent : "var(--fg)",
            }}
          >
            {title}
          </span>
        </div>
        {badge && (
          <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border border-border bg-bg-sunk text-fg-3 shrink-0">
            {badge}
          </span>
        )}
      </div>
      <p className="m-0 text-[12.5px] text-fg-3 leading-normal">{body}</p>
    </button>
  );
}
