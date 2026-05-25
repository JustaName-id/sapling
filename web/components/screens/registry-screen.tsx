"use client";

import {useEffect} from "react";
import {type Address, isAddress} from "viem";
import {Address as AddrPill} from "@/components/address";
import {SourceTabs, type Source} from "@/components/source-tabs";
import {Toggle} from "@/components/toggle";

export type RegistryConfig = {
  source: Source;
  admin: Address;
  upgradeable: boolean;
  pasteAddress: string;
  touched: boolean;
};

export function RegistryScreen({
  parent,
  parentExisting,
  registry,
  setRegistry,
  connectedAddress,
  onNext,
  onBack,
}: {
  parent: string;
  parentExisting: Address | null;
  registry: RegistryConfig;
  setRegistry: (r: RegistryConfig) => void;
  connectedAddress: Address;
  onNext: () => void;
  onBack: () => void;
}) {
  useEffect(() => {
    if (parentExisting && !registry.touched) {
      setRegistry({
        ...registry,
        source: "paste",
        pasteAddress: parentExisting,
        touched: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentExisting]);

  const validPaste = isAddress(registry.pasteAddress.trim() as Address);

  return (
    <div className="max-w-[720px] mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-[-0.025em] m-0 mb-2 leading-[1.15] text-fg">
          UserRegistry
        </h1>
        <p className="m-0 text-fg-3 text-[15px] max-w-[56ch]">
          Tracks ownership of subnames under{" "}
          <span className="font-mono">{parent}</span>. Deploy a fresh one, or
          reuse a contract you already deployed.
        </p>
      </div>

      {parentExisting && (
        <div
          className="sapling-card p-3.5 px-4 mb-6 flex items-center gap-3 text-[13.5px]"
          style={{
            background: "var(--accent-soft)",
            borderColor: "var(--accent)",
          }}
        >
          <span className="text-accent inline-flex">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle
                cx="8"
                cy="8"
                r="6.5"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M8 5v3.5M8 11v.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div className="flex-1">
            <strong className="font-medium">{parent}</strong> already points to
            a UserRegistry at <AddrPill value={parentExisting} />. You can reuse
            it or replace it.
          </div>
        </div>
      )}

      <SourceTabs
        value={registry.source}
        onChange={v => setRegistry({...registry, source: v, touched: true})}
      />

      {registry.source === "deploy" ? (
        <div className="sapling-card px-6 py-0">
          <FieldRow
            label="Admin address"
            help="Controls registry settings. You can transfer this later."
          >
            <input
              className="sapling-input mono"
              spellCheck={false}
              value={registry.admin}
              onChange={e =>
                setRegistry({
                  ...registry,
                  admin: e.target.value as Address,
                  touched: true,
                })
              }
            />
            {registry.admin.toLowerCase() ===
              connectedAddress.toLowerCase() && (
              <p className="text-[12px] text-fg-4 m-0 mt-2">Connected wallet</p>
            )}
          </FieldRow>

          <FieldRow
            label="Upgradeable"
            help="Lets you upgrade the registry implementation later. Turn off for an immutable registry."
          >
            <div className="flex">
              <Toggle
                checked={registry.upgradeable}
                onChange={v =>
                  setRegistry({...registry, upgradeable: v, touched: true})
                }
                ariaLabel="Upgradeable"
              />
            </div>
          </FieldRow>
        </div>
      ) : (
        <div className="sapling-card px-6 py-0">
          <FieldRow
            label="Registry address"
            help={
              <>
                Paste an already-deployed UserRegistry. Sapling will skip the
                deploy and wire it under{" "}
                <span className="font-mono">{parent}</span>.
              </>
            }
          >
            <input
              className="sapling-input mono"
              spellCheck={false}
              placeholder="0x…"
              value={registry.pasteAddress}
              onChange={e =>
                setRegistry({
                  ...registry,
                  pasteAddress: e.target.value,
                  touched: true,
                })
              }
            />
            {registry.pasteAddress && validPaste && (
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
            {registry.pasteAddress && !validPaste && (
              <p className="text-[12px] text-danger m-0 mt-2">
                Not a valid Ethereum address.
              </p>
            )}
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
          disabled={registry.source === "paste" && !validPaste}
        >
          Continue
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
