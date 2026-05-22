"use client";

import {useEffect, useState} from "react";
import {type Address} from "viem";
import {usePublicClient} from "wagmi";
import {useConnectModal} from "@rainbow-me/rainbowkit";
import {
  fetchOwnedEthNames,
  formatExpiry,
  resolveAvatars,
  type OwnedName,
} from "@/lib/ens";
import {EnsAvatar} from "@/components/sapling/ens-avatar";

type Status = "idle" | "loading" | "loaded" | "error";

export function PickParentScreen({
  address,
  network,
  selected,
  setSelected,
  onNext,
  onBack,
}: {
  address: Address | undefined;
  network: "mainnet" | "sepolia";
  selected: string | null;
  setSelected: (n: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const {openConnectModal} = useConnectModal();
  const publicClient = usePublicClient();
  const [names, setNames] = useState<OwnedName[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [manualName, setManualName] = useState("");

  useEffect(() => {
    if (!address) {
      setNames([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    // React 19 Strict Mode runs effects twice on mount in dev. Without an
    // abort, two parallel requests hit ENS staging GraphQL — one of them
    // races back as a failure (or an empty `{account: null}` overwriting
    // good data with []). AbortController cancels the first request's
    // network call so only the second one reaches the server.
    const abort = new AbortController();
    fetchOwnedEthNames(address, abort.signal)
      .then(async ns => {
        if (abort.signal.aborted) return;
        // Show names immediately; avatars stream in on a follow-up pass so
        // the picker isn't gated on resolver RPC calls.
        setNames(ns);
        setStatus("loaded");
        if (!publicClient) return;
        const withAvatars = await resolveAvatars(publicClient, ns, abort.signal);
        if (abort.signal.aborted) return;
        setNames(withAvatars);
      })
      .catch(err => {
        if (abort.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus("error");
      });
    return () => abort.abort();
  }, [address, publicClient]);

  const display: OwnedName[] =
    manualName.trim().length > 0
      ? [
          {
            name: normalize(manualName),
            expiryDate: null,
            resolverAddress: null,
            texts: [],
          },
        ]
      : names;

  return (
    <div className="max-w-[720px] mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-[-0.025em] m-0 mb-2 leading-[1.15] text-fg">
          Pick a parent name
        </h1>
        <p className="m-0 text-fg-3 text-[15px] max-w-[56ch]">
          Subnames will live under it. You&apos;ll need to own this name on{" "}
          {network === "mainnet" ? "Mainnet" : "Sepolia"}.
        </p>
      </div>

      {!address && (
        <div className="sapling-card p-6 mb-4 flex flex-col items-start gap-4">
          <div>
            <p className="text-fg font-medium m-0 mb-1 text-[14px]">
              Connect a wallet to continue
            </p>
            <p className="text-fg-3 text-[13px] m-0 leading-[1.5] max-w-[52ch]">
              Sapling shows the{" "}
              <span className="font-mono">.eth</span> names owned by the
              connected wallet so you can pick one as the parent for your new
              subname registry.
            </p>
          </div>
          <button
            type="button"
            className="sapling-btn"
            data-variant="primary"
            data-size="sm"
            onClick={() => openConnectModal?.()}
          >
            Connect wallet
            <svg
              width="12"
              height="12"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2.5 7h9M8 3.5L11.5 7 8 10.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}

      {address && status === "loading" && (
        <div>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="flex items-center gap-3.5 p-3.5 px-[18px] border border-border rounded-[12px] mb-2.5 bg-bg-elev pointer-events-none"
            >
              <div
                className="w-8 h-8 rounded-full bg-bg-sunk"
                style={{animation: "sapling-skel 1.4s ease-in-out infinite"}}
              />
              <div className="flex-1 flex flex-col gap-1.5">
                <div
                  className="bg-bg-sunk rounded h-3 w-2/5"
                  style={{animation: "sapling-skel 1.4s ease-in-out infinite"}}
                />
                <div
                  className="bg-bg-sunk rounded h-2.5 w-1/4"
                  style={{animation: "sapling-skel 1.4s ease-in-out infinite"}}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {address && status !== "loading" && (
        <>
          {names.length === 0 && status === "loaded" && (
            <div className="text-center py-14 px-6 border border-dashed border-border-strong rounded-[18px] text-fg-3 mb-4">
              <h3 className="m-0 mb-1.5 text-fg text-[15px] font-medium">
                No .eth names found
              </h3>
              <p className="m-0 mb-4 text-[13.5px]">
                No names owned by this address on{" "}
                {network === "mainnet" ? "Mainnet" : "Sepolia"}. You can still
                type a name manually below.
              </p>
            </div>
          )}

          <div role="radiogroup" aria-label="Your .eth names">
            {display.map(d => (
              <NameRow
                key={d.name}
                name={d.name}
                expiryDate={d.expiryDate}
                avatarUrl={d.avatarUrl}
                selected={selected === d.name}
                dimmed={!!selected && selected !== d.name}
                onClick={() => setSelected(d.name)}
              />
            ))}
          </div>

          <div className="mt-4 mb-2">
            <label
              htmlFor="manual-name"
              className="block text-[12px] font-mono uppercase tracking-wider text-fg-3 mb-2"
            >
              Or type a name
            </label>
            <input
              id="manual-name"
              className="sapling-input mono"
              spellCheck={false}
              placeholder="alice.eth or sub.alice.eth"
              value={manualName}
              onChange={e => {
                setManualName(e.target.value);
                const n = normalize(e.target.value);
                setSelected(n || null);
              }}
            />
            <p className="text-[12px] text-fg-4 mt-2 m-0">
              Sapling will deploy a UserRegistry under{" "}
              <span className="font-mono">
                {selected || "your.name.eth"}
              </span>
              .
            </p>
          </div>
        </>
      )}

      <Actions
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!address || !selected}
      />
    </div>
  );
}

function NameRow({
  name,
  expiryDate,
  avatarUrl,
  selected,
  dimmed,
  onClick,
}: {
  name: string;
  expiryDate: number | string | null;
  avatarUrl?: string;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const expiryLabel = formatExpiry(name, expiryDate);
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onClick}
      className={`flex items-center gap-3.5 p-3.5 px-[18px] border rounded-[12px] mb-2.5 cursor-pointer bg-bg-elev transition-all ${
        selected
          ? "border-accent bg-accent-soft"
          : "border-border hover:border-border-strong hover:shadow-sm"
      } ${dimmed ? "opacity-50" : ""}`}
    >
      <EnsAvatar name={name} src={avatarUrl} />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="font-mono text-[14px] text-fg">{name}</span>
        <span className="text-[12px] text-fg-3">{expiryLabel}</span>
      </div>
      <svg
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
        className={`w-[18px] h-[18px] flex-shrink-0 ${
          selected ? "opacity-100 text-accent" : "opacity-0"
        }`}
      >
        <path
          d="M3 9.5l4 4 8-9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function Actions({
  onBack,
  onNext,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled: boolean;
}) {
  return (
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
        disabled={nextDisabled}
      >
        Continue
      </button>
    </div>
  );
}

function normalize(input: string): string {
  const t = input.trim().toLowerCase();
  if (!t) return "";
  return t.endsWith(".eth") ? t : `${t}.eth`;
}
