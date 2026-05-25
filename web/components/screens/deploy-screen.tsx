"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {encodeFunctionData, type Address, type Hex} from "viem";
import {usePublicClient, useWalletClient} from "wagmi";

import {Address as AddrPill, shortAddr} from "@/components/address";
import {
  ROLE_REGISTRAR,
  SEPOLIA_ADDRESSES,
  STANDARD_CREATE2_DEPLOYER,
  ethRegistryAbi,
  openRegistrarCreate2Calldata,
  predictOpenRegistrarAddress,
  predictUserRegistryAddress,
  randomSalt,
  saltForParent,
  saplingFactoryAbi,
  userRegistryAbi,
} from "@/lib/sapling";

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
  onDone: (
    registryAddr: Address,
    registrarAddr: Address,
    txHash?: string,
  ) => void;
  onBack: () => void;
}) {
  const {data: walletClient} = useWalletClient();
  const publicClient = usePublicClient();

  const [phase, setPhase] = useState<Phase>("review");
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [txHashes, setTxHashes] = useState<Record<number, Address>>({});
  const [error, setError] = useState<string>();
  const [predictError, setPredictError] = useState<string>();
  // EIP-5792 capability: undefined while detecting, true if the wallet can
  // atomically batch the deploy in one signature, false if we must fall back
  // to sequential `sendTransaction` calls.
  const [batchCapable, setBatchCapable] = useState<boolean>();
  // Whether the predicted addresses already have code on-chain. If they do,
  // we must skip those deploy calls in the batch — otherwise the matching
  // CREATE / CREATE2 would revert and (with forceAtomic) sink the whole bundle.
  const [registryDeployed, setRegistryDeployed] = useState<boolean>(false);
  const [registrarDeployed, setRegistrarDeployed] = useState<boolean>(false);

  const {live, skipped} = buildBatch(parent, registry, registrar);
  const gasPrice = network === "mainnet" ? 12 : 1.2;
  const gasEst = 240_000 + live.length * 62_000;
  const ethCost = (gasEst * gasPrice) / 1e9;

  // "Deploy fresh" mode: use a random salt so a new registry/registrar pair is
  // produced even when a prior deploy already exists at the canonical salt.
  // Default mode (false) uses parentInfo.tokenId as salt and reuses any
  // existing deploy idempotently.
  const [freshDeploy, setFreshDeploy] = useState(false);
  const [freshSalt, setFreshSalt] = useState<bigint | undefined>(undefined);
  const effectiveTokenIdSalt =
    freshDeploy && freshSalt !== undefined ? freshSalt : parentInfo.tokenId;
  const salt = saltForParent(effectiveTokenIdSalt);

  // Final UserRegistry address: paste path uses the user-supplied address;
  // deploy path uses pure CREATE2 derivation from (admin, salt). No RPC.
  const predictedRegistry: Address | undefined = useMemo(() => {
    if (registry.source === "paste") return registry.pasteAddress as Address;
    if (freshDeploy && freshSalt === undefined) return undefined;
    return predictUserRegistryAddress(registry.admin, effectiveTokenIdSalt);
  }, [registry, freshDeploy, freshSalt, effectiveTokenIdSalt]);

  // OpenRegistrar address derives synchronously from (registry, salt). Pure.
  const predictedRegistrar: Address | undefined = useMemo(() => {
    if (registrar.source === "paste") return registrar.pasteAddress as Address;
    if (!predictedRegistry) return undefined;
    return predictOpenRegistrarAddress(predictedRegistry, salt);
  }, [registrar, predictedRegistry, salt]);

  // Seed / clear the random fresh salt. Flipping freshDeploy on picks a new
  // random salt; flipping it off clears it so we revert to parentInfo.tokenId.
  useEffect(() => {
    if (freshDeploy) {
      setFreshSalt(randomSalt());
    } else {
      setFreshSalt(undefined);
    }
  }, [freshDeploy]);

  // Is a UserRegistry already deployed at the predicted address? Single
  // getCode call — no event scan, no block range limits. In fresh-deploy mode
  // a non-empty code means a 256-bit-random-salt collision (astronomically
  // unlikely); roll another salt and try again.
  useEffect(() => {
    if (registry.source !== "deploy") return;
    if (!predictedRegistry || !publicClient) return;
    let cancelled = false;
    (async () => {
      try {
        const code = await publicClient.getCode({address: predictedRegistry});
        if (cancelled) return;
        const exists = !!code && code !== "0x";
        if (freshDeploy && exists) {
          setFreshSalt(randomSalt());
          return;
        }
        setRegistryDeployed(exists);
        setPredictError(undefined);
      } catch (e) {
        if (cancelled) return;
        setPredictError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [registry.source, predictedRegistry, publicClient, freshDeploy]);

  // Has the predicted OpenRegistrar already been deployed? The standard CREATE2
  // deployer silently no-ops on collision (returns address(0)) so this wouldn't
  // hard-fail like the UserRegistry path, but we still want to skip the call
  // in the batch to save gas and surface "reusing" state to the user.
  useEffect(() => {
    if (!predictedRegistrar || !publicClient) return;
    let cancelled = false;
    publicClient
      .getCode({address: predictedRegistrar})
      .then(code => {
        if (cancelled) return;
        setRegistrarDeployed(!!code && code !== "0x");
      })
      .catch(() => {
        if (cancelled) return;
        setRegistrarDeployed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [predictedRegistrar, publicClient]);

  // Probe EIP-5792 support. We need atomic execution on the active chain so
  // partial deploys can't happen. The state stays stale across disconnects;
  // the button is gated on walletClient anyway so it can't be misused.
  useEffect(() => {
    if (!walletClient || !publicClient?.chain) return;
    const chainId = publicClient.chain.id;
    let cancelled = false;
    (async () => {
      try {
        const caps = await walletClient.getCapabilities({chainId});
        if (cancelled) return;
        const status = caps?.atomic?.status;
        setBatchCapable(status === "supported" || status === "ready");
      } catch {
        if (cancelled) return;
        setBatchCapable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletClient, publicClient]);

  // Build the call list for both batched and sequential paths so they stay
  // in lockstep. Each entry is one tx in the sequential flow / one call in
  // the EIP-5792 bundle. Order matters: deploys first, then role grant on
  // the new registry, then the parent's subregistry pointer flip.
  const buildCalls = (
    regAddr: Address,
    registrarAddr: Address,
  ): {to: Address; data: Hex}[] => {
    const calls: {to: Address; data: Hex}[] = [];
    // Skip the registry deploy if a UserRegistry already lives at the predicted
    // address — VerifiableFactory's `new UUPSProxy{salt}` reverts on collision,
    // which (with forceAtomic) would sink the whole bundle.
    if (registry.source === "deploy" && !registryDeployed) {
      calls.push({
        to: SEPOLIA_ADDRESSES.saplingFactory,
        data: encodeFunctionData({
          abi: saplingFactoryAbi,
          functionName: "deployRegistry",
          args: [registry.admin, effectiveTokenIdSalt],
        }),
      });
    }
    // Arachnid's deployer silently no-ops on collision rather than reverting,
    // but skip the call anyway to save gas and keep the batch honest about
    // what it's actually doing.
    if (registrar.source === "deploy" && !registrarDeployed) {
      calls.push({
        to: STANDARD_CREATE2_DEPLOYER,
        data: openRegistrarCreate2Calldata(regAddr, salt),
      });
    }
    calls.push({
      to: regAddr,
      data: encodeFunctionData({
        abi: userRegistryAbi,
        functionName: "grantRootRoles",
        args: [ROLE_REGISTRAR, registrarAddr],
      }),
    });
    calls.push({
      to: parentInfo.registry,
      data: encodeFunctionData({
        abi: ethRegistryAbi,
        functionName: "setSubregistry",
        args: [parentInfo.tokenId, regAddr],
      }),
    });
    return calls;
  };

  const startedRef = useRef(false);

  const startBatchedDeploy = async () => {
    if (startedRef.current) return;
    if (!walletClient || !publicClient) return;
    if (!predictedRegistry || !predictedRegistrar) {
      setError("Predicted addresses not ready");
      return;
    }
    startedRef.current = true;

    setPhase("signing");
    try {
      const calls = buildCalls(predictedRegistry, predictedRegistrar);
      setStatuses(Object.fromEntries(calls.map((_, i) => [i, "submitted"])));
      const {id} = await walletClient.sendCalls({calls, forceAtomic: true});
      setPhase("confirming");
      const result = await walletClient.waitForCallsStatus({id});
      if (result.status !== "success") {
        throw new Error(`Bundle status: ${result.status}`);
      }
      // Atomic bundles usually return a single receipt covering all calls;
      // non-atomic returns one per call. Map whichever shape we got so each
      // row links to a real tx hash on Etherscan.
      const receipts = result.receipts ?? [];
      const fallbackHash = receipts[0]?.transactionHash as Address | undefined;
      const newHashes: Record<number, Address> = {};
      calls.forEach((_, i) => {
        const h = (receipts[i]?.transactionHash ?? fallbackHash) as
          | Address
          | undefined;
        if (h) newHashes[i] = h;
      });
      setTxHashes(t => ({...t, ...newHashes}));
      const regCode = await publicClient.getCode({address: predictedRegistry});
      const registrarCode = await publicClient.getCode({address: predictedRegistrar});
      if (!regCode || regCode === "0x") {
        throw new Error(`UserRegistry not at predicted ${predictedRegistry}`);
      }
      if (!registrarCode || registrarCode === "0x") {
        throw new Error(`OpenRegistrar not at predicted ${predictedRegistrar}`);
      }
      setStatuses(Object.fromEntries(calls.map((_, i) => [i, "confirmed"])));
      setPhase("done");
      // For atomic batches every call shares one tx hash, so the last receipt
      // is "the" batch tx. Fall back to the first receipt's hash for non-atomic.
      const finalHash =
        (receipts[receipts.length - 1]?.transactionHash ?? fallbackHash) as
          | string
          | undefined;
      onDone(predictedRegistry, predictedRegistrar, finalHash);
    } catch (e) {
      console.error("[sapling] batched deploy failed:", e);
      setError(e instanceof Error ? e.message : String(e));
      setPhase("review");
      startedRef.current = false;
    }
  };

  const startDeploy = async () => {
    if (startedRef.current) return;
    if (!walletClient || !publicClient) return;
    if (!predictedRegistry || !predictedRegistrar) {
      setError("Predicted addresses not ready");
      return;
    }
    startedRef.current = true;

    setPhase("signing");
    const registryAddr = predictedRegistry;
    const registrarAddr = predictedRegistrar;

    try {
      let idx = 0;

      if (registry.source === "deploy") {
        const curIdx = idx;
        // Skip if a registry already lives at the predicted address (idempotent re-run).
        const existing = await publicClient.getCode({address: registryAddr});
        if (existing && existing !== "0x") {
          setStatuses(s => ({...s, [curIdx]: "confirmed"}));
        } else {
          setStatuses(s => ({...s, [curIdx]: "submitted"}));
          const h = await walletClient.sendTransaction({
            to: SEPOLIA_ADDRESSES.saplingFactory,
            data: encodeFunctionData({
              abi: saplingFactoryAbi,
              functionName: "deployRegistry",
              args: [registry.admin, effectiveTokenIdSalt],
            }),
          });
          setTxHashes(t => ({...t, [curIdx]: h}));
          setPhase("confirming");
          await publicClient.waitForTransactionReceipt({hash: h});
          const code = await publicClient.getCode({address: registryAddr});
          if (!code || code === "0x") {
            throw new Error(`UserRegistry not at predicted ${registryAddr}`);
          }
          setStatuses(s => ({...s, [curIdx]: "confirmed"}));
        }
        idx++;
      }

      if (registrar.source === "deploy") {
        const curIdx = idx;
        const existing = await publicClient.getCode({address: registrarAddr});
        if (existing && existing !== "0x") {
          setStatuses(s => ({...s, [curIdx]: "confirmed"}));
        } else {
          setStatuses(s => ({...s, [curIdx]: "submitted"}));
          const h = await walletClient.sendTransaction({
            to: STANDARD_CREATE2_DEPLOYER,
            data: openRegistrarCreate2Calldata(registryAddr, salt),
          });
          setTxHashes(t => ({...t, [curIdx]: h}));
          await publicClient.waitForTransactionReceipt({hash: h});
          const code = await publicClient.getCode({address: registrarAddr});
          if (!code || code === "0x") {
            throw new Error(`OpenRegistrar not at predicted ${registrarAddr}`);
          }
          setStatuses(s => ({...s, [curIdx]: "confirmed"}));
        }
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

      let finalHash: Address | undefined;
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
        finalHash = h;
        setTxHashes(t => ({...t, [curIdx]: h}));
        await publicClient.waitForTransactionReceipt({hash: h});
        setStatuses(s => ({...s, [curIdx]: "confirmed"}));
        idx++;
      }

      setPhase("done");
      if (registryAddr && registrarAddr) onDone(registryAddr, registrarAddr, finalHash);
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
                  predictedRegistry ? (
                    <span className="inline-flex items-center gap-2">
                      {registryDeployed ? "Reusing existing" : "Deploy new"} ·{" "}
                      <AddrPill value={predictedRegistry} />
                    </span>
                  ) : (
                    <span className="text-fg-3">Deploy new · computing…</span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Reuse · <AddrPill value={registry.pasteAddress} />
                  </span>
                )
              }
            />
            {registry.source === "deploy" &&
              registryDeployed &&
              !freshDeploy && (
                <SummaryRow
                  k=""
                  v={
                    <button
                      type="button"
                      className="text-[12px] text-fg-3 underline hover:text-fg"
                      onClick={() => setFreshDeploy(true)}
                    >
                      Deploy a fresh registry instead
                    </button>
                  }
                />
              )}
            {registry.source === "deploy" && freshDeploy && (
              <SummaryRow
                k=""
                v={
                  <span className="inline-flex items-center gap-2 text-[12px] text-fg-3">
                    Fresh-deploy mode · random salt{" "}
                    {freshSalt !== undefined && (
                      <span className="font-mono">
                        {`0x${freshSalt.toString(16).padStart(64, "0").slice(0, 8)}…`}
                      </span>
                    )}
                    <button
                      type="button"
                      className="underline hover:text-fg"
                      onClick={() => setFreshDeploy(false)}
                    >
                      reuse instead
                    </button>
                  </span>
                }
              />
            )}
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
                  predictedRegistrar ? (
                    <span className="inline-flex items-center gap-2">
                      {registrarDeployed ? "Reusing existing" : "Deploy new"} ·
                      Open mode · <AddrPill value={predictedRegistrar} />
                    </span>
                  ) : (
                    <span className="text-fg-3">
                      Deploy new · Open mode · computing…
                    </span>
                  )
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

        </div>

        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-fg-3 mb-3">
            {batchCapable ? "Batch · one signature" : "Batch · sign each in order"}
          </div>
          <div className="sapling-card">
            <div className="py-3 px-4 border-b border-border text-[11px] font-mono uppercase tracking-wider text-fg-3 flex justify-between">
              <span>
                {live.length} call{live.length === 1 ? "" : "s"}
                {skipped.length > 0 && ` · ${skipped.length} skipped`}
              </span>
              <span>
                {batchCapable === undefined
                  ? "checking wallet…"
                  : batchCapable
                    ? "1 signature · atomic"
                    : `${live.length} signature${live.length === 1 ? "" : "s"}`}
              </span>
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

      {predictError && phase === "review" && (
        <div className="mt-6 sapling-card p-4 border-l-4" style={{borderLeftColor: "var(--danger)"}}>
          <p className="text-fg font-medium m-0 mb-1">
            Could not compute predicted registry address
          </p>
          <p className="text-[12.5px] text-fg-3 font-mono m-0 break-all">
            {predictError}
          </p>
        </div>
      )}

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
            onClick={batchCapable ? startBatchedDeploy : startDeploy}
            disabled={
              !walletClient ||
              !publicClient ||
              !predictedRegistry ||
              !predictedRegistrar ||
              batchCapable === undefined
            }
          >
            {batchCapable
              ? "Sign once and deploy"
              : `Sign ${live.length} tx${live.length === 1 ? "" : "s"} and deploy`}
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
      args: [shortAddr(registry.admin), "salt"],
    });
  } else {
    skipped.push({
      contract: "SaplingFactory",
      fn: "deployRegistry",
      args: ["admin", "salt"],
    });
  }

  if (registrar.source === "deploy") {
    live.push({
      contract: "Create2Deployer",
      fn: "deploy",
      args: ["salt", "OpenRegistrar(userRegistry)"],
    });
  } else {
    skipped.push({
      contract: "Create2Deployer",
      fn: "deploy",
      args: ["salt", "OpenRegistrar(userRegistry)"],
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
