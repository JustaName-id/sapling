"use client";

import {useEffect} from "react";
import {type Address, isAddress} from "viem";
import {Address as AddrPill} from "@/components/address";
import {Toggle} from "@/components/toggle";

export type RegistryConfig = {
  source: "deploy" | "paste";
  admin: Address;
  upgradeable: boolean;
  pasteAddress: string;
  touched: boolean;
};

const ENS_USER_REGISTRY_URL =
  "https://github.com/ensdomains/contracts-v2/blob/main/contracts/src/registry/UserRegistry.sol";

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
  // When the parent already has a registry wired, default to reusing it.
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

  const usingCustomPaste =
    registry.source === "paste" &&
    (!parentExisting ||
      registry.pasteAddress.toLowerCase() !== parentExisting.toLowerCase());
  const reusingExisting =
    registry.source === "paste" &&
    parentExisting !== null &&
    registry.pasteAddress.toLowerCase() === parentExisting.toLowerCase();

  const validPaste = isAddress(registry.pasteAddress.trim() as Address);
  const blocked = usingCustomPaste && !validPaste;

  return (
    <div className="max-w-[720px] mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-[-0.025em] m-0 mb-2 leading-[1.15] text-fg">
          Subname ownership
        </h1>
        <p className="m-0 text-fg-3 text-[15px] max-w-[56ch]">
          Sapling deploys a contract that tracks ownership of subnames under{" "}
          <span className="font-mono">{parent}</span>.
        </p>
      </div>

      {parentExisting && (
        <div
          className="sapling-card p-4 mb-6"
          style={{
            background: "var(--accent-soft)",
            borderColor: "var(--accent)",
          }}
        >
          <div className="flex items-start gap-3 mb-3">
            <span className="text-accent inline-flex mt-0.5">
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
            <div className="flex-1 text-[13.5px] text-fg">
              <strong className="font-medium">{parent}</strong> already has a
              registry at <AddrPill value={parentExisting} />.
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="sapling-btn"
              data-variant={reusingExisting ? "primary" : "ghost"}
              data-size="sm"
              onClick={() =>
                setRegistry({
                  ...registry,
                  source: "paste",
                  pasteAddress: parentExisting,
                  touched: true,
                })
              }
            >
              Reuse this
            </button>
            <button
              type="button"
              className="sapling-btn"
              data-variant={registry.source === "deploy" ? "primary" : "ghost"}
              data-size="sm"
              onClick={() =>
                setRegistry({
                  ...registry,
                  source: "deploy",
                  pasteAddress: "",
                  touched: true,
                })
              }
            >
              Deploy a new one
            </button>
          </div>
        </div>
      )}

      {registry.source === "deploy" && (
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
      )}

      <details
        className="mt-6 sapling-card px-6 py-4"
        open={usingCustomPaste}
        onToggle={e => {
          const open = (e.target as HTMLDetailsElement).open;
          if (!open && usingCustomPaste) {
            setRegistry({
              ...registry,
              source: "deploy",
              pasteAddress: "",
              touched: true,
            });
          } else if (open && registry.source !== "paste") {
            setRegistry({...registry, source: "paste", touched: true});
          }
        }}
      >
        <summary className="cursor-pointer text-[14px] font-medium text-fg list-none flex items-center justify-between">
          <span>Use a UserRegistry I deployed myself</span>
          <span className="text-fg-4 text-[12px]">advanced</span>
        </summary>
        <div className="mt-4">
          <p className="text-[13px] text-fg-3 m-0 mb-3 leading-[1.55] max-w-[60ch]">
            Deploy your own UserRegistry (custom storage, roles, or upgrade
            logic) from the base contract at{" "}
            <a
              href={ENS_USER_REGISTRY_URL}
              target="_blank"
              rel="noreferrer"
              className="underline text-fg hover:text-accent font-mono text-[12.5px]"
            >
              UserRegistry.sol
            </a>
            , then paste its address here. Sapling will skip the deploy and
            wire it under <span className="font-mono">{parent}</span>.
          </p>
          <p className="text-[12px] text-fg-4 m-0 mb-2 font-mono uppercase tracking-wider">
            Registry address
          </p>
          <input
            className="sapling-input mono"
            spellCheck={false}
            placeholder="0x…"
            value={
              reusingExisting
                ? ""
                : registry.pasteAddress
            }
            onChange={e =>
              setRegistry({
                ...registry,
                source: "paste",
                pasteAddress: e.target.value,
                touched: true,
              })
            }
          />
          {usingCustomPaste && registry.pasteAddress && validPaste && (
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
          {usingCustomPaste && registry.pasteAddress && !validPaste && (
            <p className="text-[12px] text-danger m-0 mt-2">
              Not a valid Ethereum address.
            </p>
          )}
        </div>
      </details>

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
          disabled={blocked}
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
