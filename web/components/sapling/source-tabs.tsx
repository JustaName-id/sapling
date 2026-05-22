"use client";

export type Source = "deploy" | "paste";

export function SourceTabs({
  value,
  onChange,
}: {
  value: Source;
  onChange: (v: Source) => void;
}) {
  return (
    <div className="grid grid-cols-2 border-b border-border mb-6">
      {([
        {v: "deploy", label: "Deploy new"},
        {v: "paste", label: "Use existing"},
      ] as const).map(o => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`appearance-none bg-transparent border-0 py-3 px-1 text-[14px] font-medium cursor-pointer text-center transition-colors -mb-px border-b-2 ${
            value === o.v
              ? "border-accent text-fg"
              : "border-transparent text-fg-3 hover:text-fg-2"
          }`}
          style={{borderBottomWidth: 2}}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
