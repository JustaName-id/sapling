"use client";

import {type Address} from "viem";
import {Address as AddrPill} from "@/components/sapling/address";

export function SuccessScreen({
  parent,
  network,
  registry,
  registrar,
  txHash,
  onReset,
}: {
  parent: string;
  network: "mainnet" | "sepolia";
  registry: Address;
  registrar: Address;
  /** Final wiring tx — `setSubregistry` (sequential) or the bundled tx (atomic). */
  txHash?: string;
  onReset: () => void;
}) {
  const explorer =
    network === "mainnet"
      ? "https://etherscan.io"
      : "https://sepolia.etherscan.io";
  const exampleSub = `bob.${parent}`;

  return (
    <div className="max-w-[720px] mx-auto w-full">
      <div className="mb-8">
        <div
          className="inline-flex items-center gap-2 py-1 px-2.5 rounded-full text-[12px] font-medium font-mono mb-4"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" fill="currentColor" opacity="0.2" />
            <path
              d="M3.5 6.2l1.7 1.7L8.7 4.4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Confirmed on {network === "mainnet" ? "mainnet" : "sepolia"}
        </div>
        <h1 className="text-[28px] font-semibold tracking-[-0.025em] m-0 mb-2 text-fg">
          Deployed.
        </h1>
        <p className="m-0 text-fg-3 max-w-[56ch]">
          Your subname registry is live under{" "}
          <span className="font-mono">{parent}</span>.
        </p>
      </div>

      <div className="grid gap-3">
        <RecordRow k="UserRegistry">
          <AddrPill
            value={registry}
            short={false}
            explorerHref={`${explorer}/address/${registry}`}
          />
        </RecordRow>
        <RecordRow k="Registrar">
          <AddrPill
            value={registrar}
            short={false}
            explorerHref={`${explorer}/address/${registrar}`}
          />
        </RecordRow>
        <RecordRow k="Parent">
          <span className="font-mono">{parent}</span>
        </RecordRow>
      </div>

      <div className="mt-6 py-3.5 px-4 bg-bg-sunk border border-border rounded-[12px] text-[13.5px] text-fg-2">
        You can now register subnames under{" "}
        <span className="font-mono text-fg">{parent}</span>. Try{" "}
        <span className="font-mono text-fg">{exampleSub}</span>.
      </div>

      <div className="mt-10 flex justify-end items-center gap-3">
        {txHash && (
          <a
            href={`${explorer}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="sapling-btn"
            data-variant="secondary"
          >
            View tx on Etherscan
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M3 9L9 3M9 3H4M9 3V8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </a>
        )}
        <button
          type="button"
          className="sapling-btn"
          data-variant="primary"
          onClick={onReset}
        >
          Deploy another
        </button>
      </div>
    </div>
  );
}

function RecordRow({k, children}: {k: string; children: React.ReactNode}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-4 p-4 border border-border rounded-[12px]">
      <span className="text-[13px] text-fg-3">{k}</span>
      <div>{children}</div>
    </div>
  );
}
