"use client";

import {isAddress} from "viem";
import {ChoiceCard} from "@/components/choice-card";

export type RegistrarConfig = {
  source: "deploy" | "paste";
  mode: "open";
  pasteAddress: string;
};

const SAPLING_REPO = "https://github.com/JustaName-id/sapling";
const REGISTRAR_BASE_URL = `${SAPLING_REPO}/blob/main/contracts/src/base/SaplingRegistrarBase.sol`;
const OPEN_REGISTRAR_URL = `${SAPLING_REPO}/blob/main/contracts/src/registrars/OpenRegistrar.sol`;

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
  const usingCustom = registrar.source === "paste";
  const validPaste = isAddress(registrar.pasteAddress.trim());
  const blocked = usingCustom && !validPaste;

  return (
    <div className="max-w-[720px] mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-tight m-0 mb-2 leading-[1.15] text-fg">
          Registration policy
        </h1>
        <p className="m-0 text-fg-3 text-[15px] max-w-[56ch]">
          Controls who can mint subnames under{" "}
          <span className="font-mono">{parent}</span>. Sapling deploys an Open
          registrar by default.
        </p>
      </div>

      <div className="mb-2">
        <p className="text-[14px] font-medium text-fg m-0 mb-1">Mode</p>
        <p className="text-[13px] text-fg-3 m-0 mb-3 leading-normal max-w-[56ch]">
          How users acquire subnames.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ChoiceCard
            selected={!usingCustom && registrar.mode === "open"}
            onClick={() =>
              setRegistrar({...registrar, source: "deploy", mode: "open"})
            }
            title="Open"
            body="Anyone can register a subname under your parent. No fee."
          />
          <ChoiceCard
            disabled
            selected={false}
            onClick={() => {}}
            title="Paid"
            badge="Soon"
            body="Anyone can register, but pays a fee per name."
          />
          <ChoiceCard
            disabled
            selected={false}
            onClick={() => {}}
            title="Allowlist"
            badge="Soon"
            body="Only addresses on your allowlist can register."
          />
        </div>
      </div>

      <details
        className="mt-6 sapling-card px-6 py-4"
        open={usingCustom}
        onToggle={e => {
          const open = (e.target as HTMLDetailsElement).open;
          if (!open && usingCustom) {
            setRegistrar({...registrar, source: "deploy"});
          } else if (open && !usingCustom) {
            setRegistrar({...registrar, source: "paste"});
          }
        }}
      >
        <summary className="cursor-pointer text-[14px] font-medium text-fg list-none flex items-center justify-between">
          <span>Use a registrar I deployed myself</span>
          <span className="text-fg-4 text-[12px]">advanced</span>
        </summary>
        <div className="mt-4">
          <p className="text-[13px] text-fg-3 m-0 mb-3 leading-[1.55] max-w-[60ch]">
            Want paid, allowlist, signature, or passkey-gated minting? Inherit
            from{" "}
            <a
              href={REGISTRAR_BASE_URL}
              target="_blank"
              rel="noreferrer"
              className="underline text-fg hover:text-accent font-mono text-[12.5px]"
            >
              SaplingRegistrarBase.sol
            </a>{" "}
            and write your own. See{" "}
            <a
              href={OPEN_REGISTRAR_URL}
              target="_blank"
              rel="noreferrer"
              className="underline text-fg hover:text-accent font-mono text-[12.5px]"
            >
              OpenRegistrar.sol
            </a>{" "}
            as a reference.
          </p>
          <p className="text-[12px] text-fg-4 m-0 mb-2 font-mono uppercase tracking-wider">
            Registrar address
          </p>
          <input
            className="sapling-input mono"
            spellCheck={false}
            placeholder="0x…"
            value={registrar.pasteAddress}
            onChange={e =>
              setRegistrar({
                ...registrar,
                source: "paste",
                pasteAddress: e.target.value,
              })
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
              Valid address — Sapling will skip the registrar deploy and only
              grant it the registrar role.
            </p>
          )}
          {registrar.pasteAddress && !validPaste && (
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
          Review
        </button>
      </div>
    </div>
  );
}
