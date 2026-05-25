"use client";

import {SaplingDrawing} from "@/components/sapling-drawing";

export type Network = "mainnet" | "sepolia";

export function ConnectScreen({onStart}: {onStart: () => void}) {
  return (
    <div className="max-w-[1280px] mx-auto px-6 pt-6 pb-0 w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-stretch">
        <div className="flex flex-col justify-center py-6 md:py-8">
          <h1 className="text-fg font-bold leading-none mb-[22px] tracking-[-0.035em] text-[40px] sm:text-[clamp(40px,4.8vw,60px)]">
            Issue onchain ENSv2
            <br />
            subnames on L1.
          </h1>

          <p className="text-[15.5px] leading-[1.55] text-fg-2 m-0 mb-7 max-w-[52ch]">
            Pick a <span className="font-mono">.eth</span> you own. Sapling
            deploys an ENSv2 UserRegistry under it in one batch.
          </p>

          <div className="flex gap-3 items-center flex-wrap mb-6">
            <button
              type="button"
              className="sapling-btn"
              data-variant="primary"
              onClick={onStart}
            >
              Issue subnames
              <svg
                width="14"
                height="14"
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
        </div>

        <div className="flex items-center justify-center py-6 md:py-8">
          <SaplingDrawing />
        </div>
      </div>
    </div>
  );
}
