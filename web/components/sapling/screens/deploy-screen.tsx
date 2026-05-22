"use client";

import {useEffect, useRef, useState} from "react";
import {
  encodeDeployData,
  encodeFunctionData,
  parseEventLogs,
  type Address,
} from "viem";
import {usePublicClient, useWalletClient} from "wagmi";

import {Address as AddrPill, shortAddr} from "@/components/sapling/address";
import {
  ROLE_REGISTRAR,
  SEPOLIA_ADDRESSES,
  ethRegistryAbi,
  saplingFactoryAbi,
  userRegistryAbi,
} from "@/lib/sapling";
import {openRegistrarAbi, openRegistrarBytecode} from "@/lib/openRegistrar";

import type {RegistryConfig} from "./registry-screen";
import type {RegistrarConfig} from "./registrar-screen";

type Phase = "review" | "signing" | "broadcasting" | "confirming" | "done";
type Status = "pending" | "submitted" | "confirmed";

type Call = {
  contract: string;
  fn: string;
  args: string[];
  skipped?: boolean;
};

type ParentInfo = {
  registry: Address;
  tokenId: bigint;
  owner: Address;
  label: string;
};

export function DeployScreen({
  parent,
  parentInfo,
  network,
  registry,
  registrar,
  onDone,
  onBack,
}: {
  parent: string;
  parentInfo: ParentInfo;
  network: "mainnet" | "sepolia";
  registry: RegistryConfig;
  registrar: RegistrarConfig;
  onDone: (registryAddr: Address, registrarAddr: Address) => void;
  onBack: () => void;
}) {
  const {data: walletClient} = useWalletClient();
  const publicClient = usePublicClient();

  const [phase, setPhase] = useState<Phase>("review");
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [txHashes, setTxHashes] = useState<Record<number, Address>>({});
  const [error, setError] = useState<string>();

  const {live, skipped} = buildBatch(parent, registry, registrar);
  const gasPrice = network === "mainnet" ? 12 : 1.2;
  const gasEst = 240_000 + live.length * 62_000;
  const ethCost = (gasEst * gasPrice) / 1e9;

  const startedRef = useRef(false);
  const startDeploy = async () => {
    if (startedRef.current) return;
    if (!walletClient || !publicClient) return;
    startedRef.current = true;

    setPhase("signing");
    let registryAddr: Address | undefined =
      registry.source === "paste" ? (registry.pasteAddress as Address) : undefined;
    let registrarAddr: Address | undefined =
      registrar.source === "paste" ? (registrar.pasteAddress as Address) : undefined;

    try {
      let idx = 0;

      if (registry.source === "deploy") {
        const curIdx = idx;
        setStatuses(s => ({...s, [curIdx]: "submitted"}));
        const h = await walletClient.sendTransaction({
          to: SEPOLIA_ADDRESSES.saplingFactory,
          data: encodeFunctionData({
            abi: saplingFactoryAbi,
            functionName: "deployRegistry",
            args: [registry.admin],
          }),
        });
        setTxHashes(t => ({...t, [curIdx]: h}));
        setPhase("confirming");
        const r = await publicClient.waitForTransactionReceipt({hash: h});
        const events = parseEventLogs({
          abi: saplingFactoryAbi,
          eventName: "RegistryDeployed",
          logs: r.logs,
        });
        registryAddr = events[0]?.args.registry as Address | undefined;
        if (!registryAddr) throw new Error("RegistryDeployed event missing");
        setStatuses(s => ({...s, [curIdx]: "confirmed"}));
        idx++;
      }

      if (registrar.source === "deploy") {
        const curIdx = idx;
        if (!registryAddr) throw new Error("registry address unresolved");
        setStatuses(s => ({...s, [curIdx]: "submitted"}));
        const h = await walletClient.sendTransaction({
          data: encodeDeployData({
            abi: openRegistrarAbi,
            bytecode: openRegistrarBytecode,
            args: [registryAddr],
          }),
        });
        setTxHashes(t => ({...t, [curIdx]: h}));
        const r = await publicClient.waitForTransactionReceipt({hash: h});
        registrarAddr = (r.contractAddress as Address | null) ?? undefined;
        if (!registrarAddr) throw new Error("OpenRegistrar address missing");
        setStatuses(s => ({...s, [curIdx]: "confirmed"}));
        idx++;
      }

      {
        const curIdx = idx;
        if (!registryAddr || !registrarAddr)
          throw new Error("addresses unresolved before grantRootRoles");
        setStatuses(s => ({...s, [curIdx]: "submitted"}));
        const h = await walletClient.sendTransaction({
          to: registryAddr,
          data: encodeFunctionData({
            abi: userRegistryAbi,
            functionName: "grantRootRoles",
            args: [ROLE_REGISTRAR, registrarAddr],
          }),
        });
        setTxHashes(t => ({...t, [curIdx]: h}));
        await publicClient.waitForTransactionReceipt({hash: h});
        setStatuses(s => ({...s, [curIdx]: "confirmed"}));
        idx++;
      }

      {
        const curIdx = idx;
        if (!registryAddr) throw new Error("registry missing for setSubregistry");
        setStatuses(s => ({...s, [curIdx]: "submitted"}));
        const h = await walletClient.sendTransaction({
          to: parentInfo.registry,
          data: encodeFunctionData({
            abi: ethRegistryAbi,
            functionName: "setSubregistry",
            args: [parentInfo.tokenId, registryAddr],
          }),
        });
        setTxHashes(t => ({...t, [curIdx]: h}));
        await publicClient.waitForTransactionReceipt({hash: h});
        setStatuses(s => ({...s, [curIdx]: "confirmed"}));
        idx++;
      }

      setPhase("done");
      if (registryAddr && registrarAddr) onDone(registryAddr, registrarAddr);
    } catch (e) {
      console.error("[sapling] deploy failed:", e);
      setError(e instanceof Error ? e.message : String(e));
      setPhase("review");
      startedRef.current = false;
    }
  };

  useEffect(() => {
    setStatuses(Object.fromEntries(live.map((_, i) => [i, "pending"])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inFlight = phase !== "review" && phase !== "done";
  const head =
    phase === "review"
      ? "Deploy"
      : phase === "signing"
        ? "Waiting for signature"
        : phase === "broadcasting"
          ? "Broadcasting"
          : "Confirming";

  return (
    <div className="max-w-[960px] mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-[-0.025em] m-0 mb-2 leading-[1.15] text-fg">
          {head}
        </h1>
        <p className="m-0 text-fg-3 text-[15px] max-w-[60ch]">
          {phase === "review" &&
            "Review the calls below. Sign each to deploy your subname registry."}
          {phase === "signing" && "Confirm in your wallet."}
          {phase === "broadcasting" && "Sending the batch to the network."}
          {phase === "confirming" &&
            "Walking the batch to your new registry."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-fg-3 mb-3">
            Summary
          </div>
          <div className="sapling-card px-4 py-1">
            <SummaryRow k="Parent" v={<span className="font-mono">{parent}</span>} />
            <SummaryRow
              k="Network"
              v={network === "mainnet" ? "Ethereum Mainnet" : "Sepolia"}
            />
            <SummaryRow
              k="UserRegistry"
              v={
                registry.source === "deploy" ? (
                  <span className="text-fg">Deploy new</span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Reuse · <AddrPill value={registry.pasteAddress} />
                  </span>
                )
              }
            />
            {registry.source === "deploy" && (
              <>
                <SummaryRow
                  k="Admin"
                  v={<AddrPill value={registry.admin} />}
                />
                <SummaryRow
                  k="Upgradeable"
                  v={registry.upgradeable ? "Yes" : "No, immutable"}
                />
              </>
            )}
            <SummaryRow
              k="Registrar"
              v={
                registrar.source === "deploy" ? (
                  <span className="text-fg">Deploy new · Open mode</span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Reuse · <AddrPill value={registrar.pasteAddress} />
                  </span>
                )
              }
            />
            <SummaryRow
              k="Emancipated"
              v={registrar.emancipate ? "Yes, at deploy" : "No"}
            />
          </div>

          <div className="text-[11px] font-mono uppercase tracking-wider text-fg-3 mt-6 mb-3">
            Resolves
          </div>
          <div className="sapling-card px-4 py-1">
            <SummaryRow
              k="Pattern"
              v={
                <span className="font-mono text-[12.5px] text-fg">
                  *.{parent}
                </span>
              }
            />
            <SummaryRow
              k="Parent registry"
              v={
                <span className="font-mono text-[12.5px] text-fg">
                  {shortAddr(parentInfo.registry)}
                </span>
              }
            />
          </div>
        </div>

        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-fg-3 mb-3">
            Batch · sign each in order
          </div>
          <div className="sapling-card">
            <div className="py-3 px-4 border-b border-border text-[11px] font-mono uppercase tracking-wider text-fg-3 flex justify-between">
              <span>
                {live.length} call{live.length === 1 ? "" : "s"}
                {skipped.length > 0 && ` · ${skipped.length} skipped`}
              </span>
              <span>1 signature each</span>
            </div>
            {live.map((c, i) => (
              <TxRow
                key={`l${i}`}
                idx={i + 1}
                call={c}
                status={inFlight || phase === "done" ? statuses[i] : undefined}
                txHash={txHashes[i]}
                network={network}
              />
            ))}
            {skipped.map((c, i) => (
              <TxRow key={`s${i}`} idx={0} call={c} skipped network={network} />
            ))}
            <div className="flex justify-between py-3 px-4 text-[13px] border-t border-border bg-bg-sunk">
              <span className="text-fg-3">Estimated gas</span>
              <span className="font-mono text-fg">
                {gasEst.toLocaleString()} · {gasPrice} gwei
              </span>
            </div>
            <div className="flex justify-between py-3 px-4 text-[13px] bg-bg-sunk">
              <span className="text-fg-3">Total cost</span>
              <span className="font-mono text-fg">{ethCost.toFixed(5)} ETH</span>
            </div>
          </div>

          {skipped.length > 0 && phase === "review" && (
            <p className="mt-3 text-[12.5px] text-fg-3">
              {skipped.length} call{skipped.length > 1 ? "s" : ""} skipped
              because you&apos;re reusing existing contract
              {skipped.length > 1 ? "s" : ""}.
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-6 sapling-card p-4 border-l-4" style={{borderLeftColor: "var(--danger)"}}>
          <p className="text-fg font-medium m-0 mb-1">Transaction failed</p>
          <p className="text-[12.5px] text-fg-3 font-mono m-0 break-all">
            {error}
          </p>
        </div>
      )}

      {phase === "review" && (
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
            onClick={startDeploy}
            disabled={!walletClient || !publicClient}
          >
            Sign and deploy
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryRow({k, v}: {k: string; v: React.ReactNode}) {
  return (
    <div className="flex justify-between gap-4 py-3 border-b border-border last:border-b-0 text-[14px]">
      <span className="text-fg-3">{k}</span>
      <span className="text-fg text-right">{v}</span>
    </div>
  );
}

function TxRow({
  idx,
  call,
  status,
  txHash,
  skipped,
  network,
}: {
  idx: number;
  call: Call;
  status?: Status;
  txHash?: Address;
  skipped?: boolean;
  network: "mainnet" | "sepolia";
}) {
  const explorer =
    network === "mainnet" ? "https://etherscan.io" : "https://sepolia.etherscan.io";
  return (
    <div
      className={`py-3.5 px-4 border-b border-border last:border-b-0 flex gap-3 items-start ${
        skipped ? "opacity-40" : ""
      }`}
    >
      <div className="font-mono text-[11px] text-fg-4 w-4 flex-shrink-0 pt-0.5">
        {skipped ? "–" : String(idx).padStart(2, "0")}
      </div>
      <div
        className={`flex-1 min-w-0 font-mono text-[12.5px] leading-[1.55] text-fg ${
          skipped ? "line-through" : ""
        }`}
      >
        <span className="text-fg-2">{call.contract}</span>
        <span className="text-fg-4">.</span>
        <span className="text-fg">{call.fn}</span>
        <span className="text-fg-4">(</span>
        {call.args.map((a, i) => (
          <span key={i}>
            {i > 0 && <span className="text-fg-4">, </span>}
            <span className="text-fg">{a}</span>
          </span>
        ))}
        <span className="text-fg-4">)</span>
        {txHash && !skipped && (
          <a
            href={`${explorer}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="block text-[11px] text-fg-3 underline mt-1"
          >
            {shortAddr(txHash, 10, 8)}
          </a>
        )}
      </div>
      <div className="text-[10.5px] font-mono uppercase tracking-wider flex-shrink-0 pt-0.5 flex items-center gap-1.5">
        {skipped ? (
          <span className="text-fg-4">skipped</span>
        ) : status === "pending" ? (
          <span className="text-fg-4">·  pending</span>
        ) : status === "submitted" ? (
          <span className="text-fg-3 inline-flex items-center gap-1">
            <span className="block w-1.5 h-1.5 rounded-full border border-current" />
            submitted
          </span>
        ) : status === "confirmed" ? (
          <span className="text-accent inline-flex items-center gap-1">
            <span className="block w-1.5 h-1.5 rounded-full bg-current" />
            confirmed
          </span>
        ) : null}
      </div>
    </div>
  );
}

function buildBatch(
  parent: string,
  registry: RegistryConfig,
  registrar: RegistrarConfig,
): {live: Call[]; skipped: Call[]} {
  const live: Call[] = [];
  const skipped: Call[] = [];
  const label = parent.split(".")[0];

  if (registry.source === "deploy") {
    live.push({
      contract: "SaplingFactory",
      fn: "deployRegistry",
      args: [shortAddr(registry.admin)],
    });
  } else {
    skipped.push({
      contract: "SaplingFactory",
      fn: "deployRegistry",
      args: ["admin"],
    });
  }

  if (registrar.source === "deploy") {
    live.push({
      contract: "OpenRegistrar",
      fn: "constructor",
      args: ["userRegistry"],
    });
  } else {
    skipped.push({
      contract: "OpenRegistrar",
      fn: "constructor",
      args: ["userRegistry"],
    });
  }

  live.push({
    contract: "UserRegistry",
    fn: "grantRootRoles",
    args: [
      "ROLE_REGISTRAR",
      registrar.source === "paste"
        ? shortAddr(registrar.pasteAddress)
        : "openRegistrar",
    ],
  });

  live.push({
    contract: "EthRegistry",
    fn: "setSubregistry",
    args: [
      `"${label}"`,
      registry.source === "paste"
        ? shortAddr(registry.pasteAddress)
        : "userRegistry",
    ],
  });

  if (registrar.emancipate) {
    live.push({
      contract: "EthRegistry",
      fn: "emancipate",
      args: ["parentTokenId"],
    });
  }

  return {live, skipped};
}
