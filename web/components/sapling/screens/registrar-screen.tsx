"use client";

import {isAddress} from "viem";
import {SourceTabs, type Source} from "@/components/sapling/source-tabs";
import {RadioRow} from "@/components/sapling/radio-row";
import {Toggle} from "@/components/sapling/toggle";

export type RegistrarConfig = {
  source: Source;
  mode: "open";
  emancipate: boolean;
  pasteAddress: string;
};

export function RegistrarScreen({
  parent,
  registrar,
  setRegistrar,
  onNext,
  onBack,
}: {
  parent: string;
  registrar: RegistrarConfig;
  setRegistrar: (r: RegistrarConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const validPaste = isAddress(registrar.pasteAddress.trim());

  return (
    <div className="max-w-[720px] mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-[-0.025em] m-0 mb-2 leading-[1.15] text-fg">
          Registrar
        </h1>
        <p className="m-0 text-fg-3 text-[15px] max-w-[56ch]">
          Controls how subnames under{" "}
          <span className="font-mono">{parent}</span> get minted. Deploy a new
          registrar, or wire your registry to one you already have.
        </p>
      </div>

      <SourceTabs
        value={registrar.source}
        onChange={v => setRegistrar({...registrar, source: v})}
      />

      {registrar.source === "deploy" ? (
        <div className="sapling-card px-6 py-0">
          <div className="py-5 border-b border-border">
            <div className="mb-3">
              <p className="text-[14px] font-medium text-fg m-0 mb-1">Mode</p>
              <p className="text-[13px] text-fg-3 m-0 leading-[1.5] max-w-[56ch]">
                How users acquire subnames. Only Open ships in v1.
              </p>
            </div>
            <div>
              <RadioRow
                selected={registrar.mode === "open"}
                onClick={() => setRegistrar({...registrar, mode: "open"})}
                title="Open"
                help="Anyone can register a subname under your parent. No fee."
              />
              <RadioRow
                disabled
                selected={false}
                title="Paid"
                badge="Soon"
                help="Anyone can register, but pays a fee per name."
              />
              <RadioRow
                disabled
                selected={false}
                title="Allowlist"
                badge="Soon"
                help="Only addresses on your allowlist can register."
              />
            </div>
          </div>

          <FieldRow
            label="Emancipate at deploy"
            help="Revoke your own ability to change the subregistry pointer. Makes your namespace permanent under .eth."
          >
            <div className="flex">
              <Toggle
                checked={registrar.emancipate}
                onChange={v => setRegistrar({...registrar, emancipate: v})}
                ariaLabel="Emancipate"
              />
            </div>
          </FieldRow>
        </div>
      ) : (
        <div className="sapling-card px-6 py-0">
          <FieldRow
            label="Registrar address"
            help="Paste an already-deployed registrar contract. Sapling will skip the deploy and only grant it the registrar role on your registry."
          >
            <input
              className="sapling-input mono"
              spellCheck={false}
              placeholder="0x…"
              value={registrar.pasteAddress}
              onChange={e =>
                setRegistrar({...registrar, pasteAddress: e.target.value})
              }
            />
            {registrar.pasteAddress && validPaste && (
              <p className="text-[12px] text-accent m-0 mt-2 flex items-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6.5l2 2 5-5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Valid address
              </p>
            )}
            {registrar.pasteAddress && !validPaste && (
              <p className="text-[12px] text-danger m-0 mt-2">
                Not a valid Ethereum address.
              </p>
            )}
          </FieldRow>

          <FieldRow
            label="Emancipate at deploy"
            help="Revoke your own ability to change the subregistry pointer. Independent of the registrar choice."
          >
            <div className="flex">
              <Toggle
                checked={registrar.emancipate}
                onChange={v => setRegistrar({...registrar, emancipate: v})}
                ariaLabel="Emancipate"
              />
            </div>
          </FieldRow>
        </div>
      )}

      <div className="mt-10 flex justify-between items-center gap-3">
        <button
          type="button"
          className="sapling-btn"
          data-variant="ghost"
          onClick={onBack}
        >
          Back
        </button>
        <button
          type="button"
          className="sapling-btn"
          data-variant="primary"
          onClick={onNext}
          disabled={registrar.source === "paste" && !validPaste}
        >
          Review
        </button>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  help,
  children,
}: {
  label: string;
  help: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="py-5 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 md:gap-8 items-start border-b border-border last:border-b-0">
      <div>
        <p className="text-[14px] font-medium text-fg m-0 mb-1">{label}</p>
        <p className="text-[13px] text-fg-3 m-0 leading-[1.5] max-w-[42ch]">
          {help}
        </p>
      </div>
      <div>{children}</div>
    </div>
  );
}
