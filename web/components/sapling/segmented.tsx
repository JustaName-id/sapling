"use client";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: {value: T; label: string}[];
}) {
  return (
    <div
      role="tablist"
      className="inline-flex p-[3px] bg-bg-sunk rounded-[12px] border border-border"
    >
      {options.map(opt => (
        <button
          key={opt.value}
          role="tab"
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`appearance-none border-0 bg-transparent h-[30px] px-[14px] rounded-[5px] inline-flex items-center gap-1.5 text-[13px] cursor-pointer transition-colors ${
            value === opt.value
              ? "bg-bg text-fg shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              : "text-fg-3"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
