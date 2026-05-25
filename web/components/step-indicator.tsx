export const STEP_NAMES = ["Parent", "Registry", "Registrar", "Deploy"] as const;

export function StepIndicator({current}: {current: number}) {
  return (
    <>
      <ol
        className="hidden sm:flex items-center justify-center gap-0 pt-5 pb-0 px-6 max-w-[720px] mx-auto w-full"
        role="list"
        aria-label="Wizard progress"
      >
        {STEP_NAMES.map((name, i) => {
          const state =
            i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li
              key={i}
              className={`flex items-center gap-2 min-w-0 flex-none ${
                i > 0 ? "ml-[14px]" : ""
              }`}
              role="listitem"
              aria-current={state === "current" ? "step" : undefined}
            >
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="h-px bg-border w-8 mr-[14px] flex-none"
                />
              )}
              <span
                data-state={state}
                className="w-[22px] h-[22px] rounded-full border inline-flex items-center justify-center text-[11px] font-mono flex-shrink-0
                  data-[state=todo]:border-border-strong data-[state=todo]:text-fg-3 data-[state=todo]:bg-bg
                  data-[state=done]:border-accent data-[state=done]:text-accent data-[state=done]:bg-accent-soft
                  data-[state=current]:border-accent data-[state=current]:text-accent-fg data-[state=current]:bg-accent"
              >
                {state === "done" ? (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.5 6.5l2 2 5-5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                data-state={state}
                className="text-[12.5px] whitespace-nowrap overflow-hidden text-ellipsis
                  data-[state=todo]:text-fg-3 data-[state=done]:text-fg-2
                  data-[state=current]:text-fg data-[state=current]:font-medium"
              >
                {name}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="sm:hidden block pt-4 px-5 font-mono text-[11.5px] text-fg-3 tracking-wider uppercase">
        Step {current + 1} / {STEP_NAMES.length} · {STEP_NAMES[current]}
      </div>
    </>
  );
}
