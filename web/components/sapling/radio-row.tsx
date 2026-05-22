"use client";

export function RadioRow({
  selected,
  disabled,
  onClick,
  title,
  badge,
  help,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title: string;
  badge?: string;
  help: string;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      className={`flex items-start gap-3.5 p-4 px-[18px] border rounded-[12px] bg-bg-elev cursor-pointer mb-2.5 transition-colors ${
        selected
          ? "border-accent bg-accent-soft"
          : "border-border hover:border-border-strong"
      } ${disabled ? "opacity-45 cursor-not-allowed pointer-events-none" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`w-4 h-4 rounded-full border flex-shrink-0 mt-0.5 relative ${
          selected ? "border-accent" : "border-border-strong"
        }`}
      >
        {selected && (
          <span className="absolute inset-[3px] bg-accent rounded-full" />
        )}
      </span>
      <div className="flex-1">
        <p className="text-[14px] font-medium m-0 mb-0.5 flex items-center gap-2 text-fg">
          {title}
          {badge && (
            <span className="text-[10.5px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border border-border bg-bg-sunk text-fg-3">
              {badge}
            </span>
          )}
        </p>
        <p className="text-[13px] text-fg-3 m-0 leading-relaxed">{help}</p>
      </div>
    </div>
  );
}
