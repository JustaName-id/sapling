"use client";

import {useEffect, useRef, useState} from "react";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import {
  encodeDeployData,
  encodeFunctionData,
  parseEventLogs,
  type Address,
} from "viem";
import {Check, Loader2} from "lucide-react";

import {ConnectButton} from "@/components/connect-button";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Badge} from "@/components/ui/badge";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";

import {
  ROLE_REGISTRAR,
  SEPOLIA_ADDRESSES,
  ethRegistryAbi,
  saplingFactoryAbi,
  userRegistryAbi,
} from "@/lib/sapling";
import {
  openRegistrarAbi,
  openRegistrarBytecode,
} from "@/lib/openRegistrar";
import {labelhash} from "@/lib/labelhash";
import {fetchOwnedEthNames} from "@/lib/ens";

type Phase = "select" | "review" | "deploy" | "success";

type Substep = "registry" | "registrar" | "grant" | "wire" | "done";

type SubstepResult = {
  txHash?: Address;
  done: boolean;
};

type ParentInfo = {
  /** The registry where the picked name's token lives. setSubregistry runs here. */
  registry: Address;
  /** The picked name's tokenId in that registry. */
  tokenId: bigint;
  /** Current owner of that token. */
  owner: Address;
  /** The label part (leaf), e.g. "leooo" for "leooo.eth", "test" for "test.11111.eth". */
  label: string;
};

export default function Home() {
  const {address, isConnected} = useAccount();
  const publicClient = usePublicClient();
  const [phase, setPhase] = useState<Phase>("select");
  const [name, setName] = useState(""); // full name, e.g. "leooo.eth" or "test.11111.eth"
  const [parentInfo, setParentInfo] = useState<ParentInfo | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string>();
  const [deployed, setDeployed] = useState<{
    registry: Address;
    registrar: Address;
  }>();

  const normalized = normalizeName(name);

  // Walk the registry chain to find which registry holds the picked name.
  useEffect(() => {
    if (!normalized || !publicClient) {
      setParentInfo(null);
      setResolveError(undefined);
      return;
    }
    let cancelled = false;
    setResolving(true);
    setResolveError(undefined);
    (async () => {
      try {
        const info = await resolveParent(normalized, publicClient);
        if (cancelled) return;
        setParentInfo(info);
      } catch (e) {
        if (cancelled) return;
        console.warn("[sapling] resolveParent failed", e);
        setResolveError(e instanceof Error ? e.message : String(e));
        setParentInfo(null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [normalized, publicClient]);

  const ownsParent =
    !!address &&
    !!parentInfo &&
    address.toLowerCase() === parentInfo.owner.toLowerCase();

  function reset() {
    setPhase("select");
    setName("");
    setDeployed(undefined);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-12 px-6 py-16">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Sapling</h1>
          <span className="text-muted-foreground hidden text-sm sm:inline">
            Subregistries for ENSv2
          </span>
        </div>
        <ConnectButton />
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-4xl font-semibold tracking-tight">
          Deploy your subname registry
        </h2>
        <p className="text-muted-foreground max-w-md text-balance text-base">
          Spin up an onchain UserRegistry under any{" "}
          <code className="font-mono">.eth</code> name you own. Subnames live on
          L1, no bridge, no gateway.
        </p>
      </section>

      {!isConnected ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground">
              Connect the wallet that owns the <code>.eth</code> name you want
              to deploy a subregistry for.
            </p>
            <ConnectButton />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <PhaseIndicator phase={phase} />

          {phase === "select" && (
            <SelectStep
              name={name}
              setName={setName}
              normalized={normalized}
              parentInfo={parentInfo}
              resolving={resolving}
              resolveError={resolveError}
              ownsParent={ownsParent}
              address={address}
              onNext={() => setPhase("review")}
            />
          )}

          {phase === "review" && parentInfo && (
            <ReviewStep
              name={normalized}
              parentInfo={parentInfo}
              admin={address!}
              onBack={() => setPhase("select")}
              onConfirm={() => setPhase("deploy")}
            />
          )}

          {phase === "deploy" && parentInfo && (
            <DeployFlow
              name={normalized}
              admin={address!}
              parentRegistry={parentInfo.registry}
              parentTokenId={parentInfo.tokenId}
              onComplete={(registry, registrar) => {
                setDeployed({registry, registrar});
                setPhase("success");
              }}
              onReset={reset}
            />
          )}

          {phase === "success" && deployed && (
            <SuccessStep
              name={normalized}
              registry={deployed.registry}
              registrar={deployed.registrar}
              onAnother={reset}
            />
          )}
        </div>
      )}
    </main>
  );
}

/** Add `.eth` suffix if missing, normalize case + whitespace. */
function normalizeName(input: string): string {
  const t = input.trim().toLowerCase();
  if (!t) return "";
  return t.endsWith(".eth") ? t : `${t}.eth`;
}

/**
 * Walk the registry chain from the `.eth` root down to the registry that
 * holds the picked name's leaf label, returning that registry + the leaf's
 * tokenId + current owner.
 *
 * For "leooo.eth": parentRegistry = ethRegistry, label = "leooo".
 * For "test.11111.eth": parentRegistry = ethRegistry.getSubregistry("11111"),
 *                       label = "test".
 */
async function resolveParent(
  fullName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any,
): Promise<ParentInfo> {
  const labels = fullName.split(".");
  if (labels[labels.length - 1] !== "eth")
    throw new Error("must end with .eth");
  if (labels.length < 2) throw new Error("name too short");

  const leafLabel = labels[0];
  // Labels between the leaf and the .eth root, ordered outermost-first.
  const middle = labels.slice(1, -1).reverse();

  let current: Address = SEPOLIA_ADDRESSES.ethRegistry;
  for (const lbl of middle) {
    const next = (await publicClient.readContract({
      address: current,
      abi: ethRegistryAbi,
      functionName: "getSubregistry",
      args: [lbl],
    })) as Address;
    if (next === "0x0000000000000000000000000000000000000000")
      throw new Error(`no subregistry for "${lbl}" — parent chain broken`);
    current = next;
  }

  const tokenId = (await publicClient.readContract({
    address: current,
    abi: ethRegistryAbi,
    functionName: "getTokenId",
    args: [labelhash(leafLabel)],
  })) as bigint;

  const owner = (await publicClient.readContract({
    address: current,
    abi: ethRegistryAbi,
    functionName: "ownerOf",
    args: [tokenId],
  })) as Address;

  return {registry: current, tokenId, owner, label: leafLabel};
}

function PhaseIndicator({phase}: {phase: Phase}) {
  const phases: {key: Phase; label: string}[] = [
    {key: "select", label: "Choose"},
    {key: "review", label: "Review"},
    {key: "deploy", label: "Deploy"},
    {key: "success", label: "Done"},
  ];
  const currentIndex = phases.findIndex(s => s.key === phase);

  return (
    <ol className="flex items-center justify-between gap-2">
      {phases.map((s, i) => {
        const state =
          i < currentIndex ? "done" : i === currentIndex ? "active" : "todo";
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              data-state={state}
              className="data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=done]:border-foreground data-[state=done]:bg-foreground data-[state=done]:text-background data-[state=todo]:border-border data-[state=todo]:text-muted-foreground flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium"
            >
              {i + 1}
            </span>
            <span
              data-state={state}
              className="data-[state=todo]:text-muted-foreground hidden text-sm font-medium sm:inline"
            >
              {s.label}
            </span>
            {i < phases.length - 1 && (
              <div className="bg-border ml-2 h-px flex-1" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SelectStep({
  name,
  setName,
  normalized,
  parentInfo,
  resolving,
  resolveError,
  ownsParent,
  address,
  onNext,
}: {
  name: string;
  setName: (v: string) => void;
  normalized: string;
  parentInfo: ParentInfo | null;
  resolving: boolean;
  resolveError?: string;
  ownsParent: boolean;
  address: Address | undefined;
  onNext: () => void;
}) {
  const [ownedNames, setOwnedNames] = useState<string[]>([]);
  const [namesStatus, setNamesStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");

  useEffect(() => {
    if (!address) return;
    setNamesStatus("loading");
    fetchOwnedEthNames(address)
      .then(names => {
        setOwnedNames(names);
        setNamesStatus("loaded");
      })
      .catch(err => {
        console.warn("[sapling] ens graph fetch failed", err);
        setNamesStatus("error");
      });
  }, [address]);

  const canContinue = ownsParent && !!parentInfo;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Which name?
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {namesStatus === "loading" && (
          <div className="text-muted-foreground inline-flex items-center gap-2 text-sm">
            <Loader2 className="size-3 animate-spin" />
            Finding your ENS names…
          </div>
        )}

        {namesStatus === "loaded" && ownedNames.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">
              Your names ({ownedNames.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {ownedNames.map(n => {
                const selected = normalized === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setName(n)}
                    data-selected={selected}
                    className="data-[selected=true]:border-foreground data-[selected=true]:bg-foreground data-[selected=true]:text-background border-border hover:bg-muted rounded-full border px-3 py-1.5 font-mono text-sm transition-colors"
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {namesStatus === "loaded" && ownedNames.length === 0 && (
          <Alert>
            <AlertTitle>No names found</AlertTitle>
            <AlertDescription>
              The ENS staging indexer doesn&apos;t see any names owned by this
              wallet. You can still type one manually below.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="name">
            {ownedNames.length > 0 ? "Or type a name" : "Your parent name"}
          </Label>
          <Input
            id="name"
            autoFocus
            spellCheck={false}
            placeholder="alice.eth or sub.alice.eth"
            value={name}
            onChange={e => setName(e.target.value)}
            className="font-mono"
          />
          <p className="text-muted-foreground text-xs">
            We&apos;ll deploy a UserRegistry under{" "}
            <span className="font-mono">{normalized || "your.name.eth"}</span>,
            an OpenRegistrar bound to it, grant the registrar role, and wire it
            under the registry that holds{" "}
            <span className="font-mono">{normalized || "the name"}</span>.
          </p>
        </div>

        {resolving && normalized && (
          <Alert>
            <AlertDescription className="inline-flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" />
              Resolving parent registry chain on Sepolia…
            </AlertDescription>
          </Alert>
        )}
        {resolveError && (
          <Alert variant="destructive">
            <AlertTitle>Can&apos;t resolve</AlertTitle>
            <AlertDescription className="text-xs">
              {resolveError}
            </AlertDescription>
          </Alert>
        )}
        {parentInfo && !ownsParent && (
          <Alert variant="destructive">
            <AlertTitle>Different wallet owns this</AlertTitle>
            <AlertDescription className="font-mono text-xs">
              {parentInfo.owner}
              <br />
              <span className="text-muted-foreground">
                connected: {address}
              </span>
            </AlertDescription>
          </Alert>
        )}
        {parentInfo && ownsParent && (
          <Alert>
            <AlertTitle>You own this name</AlertTitle>
            <AlertDescription className="flex flex-col gap-1">
              <span>You&apos;re ready to deploy a subregistry under it.</span>
              <span className="text-muted-foreground font-mono text-xs">
                parent registry: {parentInfo.registry.slice(0, 10)}…
                {parentInfo.registry.slice(-6)}
              </span>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button disabled={!canContinue} onClick={onNext}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewStep({
  name,
  parentInfo,
  admin,
  onBack,
  onConfirm,
}: {
  name: string;
  parentInfo: ParentInfo;
  admin: Address;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Review
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Field label="Name">
          <span className="font-mono">{name}</span>
        </Field>
        <Field label="Admin (full control)">
          <span className="font-mono text-xs">{admin}</span>
        </Field>
        <Field label="Parent registry (where setSubregistry runs)">
          <span className="font-mono text-xs">{parentInfo.registry}</span>
        </Field>
        <Field label="Network">
          <Badge variant="secondary">Sepolia</Badge>
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">
            Transactions (4)
          </span>
          <ol className="text-muted-foreground flex list-decimal flex-col gap-1.5 pl-5 text-sm">
            <li>
              <code className="font-mono">SaplingFactory.deployRegistry</code>{" "}
              — mint a fresh UserRegistry proxy.
            </li>
            <li>
              Deploy a new <code className="font-mono">OpenRegistrar</code>{" "}
              bound to that registry.
            </li>
            <li>
              <code className="font-mono">
                UserRegistry.grantRootRoles(REGISTRAR, registrar)
              </code>{" "}
              — let anyone mint subnames via the registrar.
            </li>
            <li>
              <code className="font-mono">
                parentRegistry.setSubregistry({parentInfo.label}, registry)
              </code>{" "}
              — wire the new registry as the subregistry of{" "}
              <span className="font-mono">{name}</span>.
            </li>
          </ol>
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onConfirm}>Deploy</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Procedural deploy flow. We bypass wagmi's reactive `useSendTransaction` hook
 * entirely — running it once per substep through useEffect caused racey
 * hook-state interference where the wallet's tx-hash response sometimes
 * never surfaced on the active hook. Here we drive everything from a single
 * `async function` using `walletClient.sendTransaction` + `publicClient
 * .waitForTransactionReceipt`. State is updated explicitly between steps,
 * with no hook reactivity in the critical path.
 */
function DeployFlow({
  name,
  admin,
  parentRegistry,
  parentTokenId,
  onComplete,
  onReset,
}: {
  name: string;
  admin: Address;
  parentRegistry: Address;
  parentTokenId: bigint;
  onComplete: (registry: Address, registrar: Address) => void;
  onReset: () => void;
}) {
  const {data: walletClient} = useWalletClient();
  const publicClient = usePublicClient();

  const [substep, setSubstep] = useState<Substep>("registry");
  const [registry, setRegistry] = useState<Address>();
  const [registrar, setRegistrar] = useState<Address>();
  const [results, setResults] = useState<Record<Substep, SubstepResult>>({
    registry: {done: false},
    registrar: {done: false},
    grant: {done: false},
    wire: {done: false},
    done: {done: false},
  });
  const [activeHash, setActiveHash] = useState<Address>();
  const [activeMining, setActiveMining] = useState(false);
  const [error, setError] = useState<string>();

  // Run-once guard. useRef survives StrictMode dev re-invocations.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (!walletClient || !publicClient) return;
    startedRef.current = true;

    (async () => {
      try {
        // ── 1: deploy UserRegistry via SaplingFactory ───────────────────
        setSubstep("registry");
        setActiveHash(undefined);
        setActiveMining(false);
        console.log("[sapling] step 1: sending deployRegistry…");
        const h1 = await walletClient.sendTransaction({
          to: SEPOLIA_ADDRESSES.saplingFactory,
          data: encodeFunctionData({
            abi: saplingFactoryAbi,
            functionName: "deployRegistry",
            args: [admin],
          }),
        });
        console.log("[sapling] step 1: hash =", h1);
        setActiveHash(h1);
        setActiveMining(true);
        const r1 = await publicClient.waitForTransactionReceipt({hash: h1});
        console.log("[sapling] step 1: mined");
        const events1 = parseEventLogs({
          abi: saplingFactoryAbi,
          eventName: "RegistryDeployed",
          logs: r1.logs,
        });
        const reg = events1[0]?.args.registry as Address | undefined;
        if (!reg) throw new Error("Step 1: RegistryDeployed event not found");
        setRegistry(reg);
        setResults(s => ({...s, registry: {done: true, txHash: h1}}));

        // ── 2: deploy OpenRegistrar ─────────────────────────────────────
        setSubstep("registrar");
        setActiveHash(undefined);
        setActiveMining(false);
        console.log("[sapling] step 2: deploying OpenRegistrar…");
        const h2 = await walletClient.sendTransaction({
          data: encodeDeployData({
            abi: openRegistrarAbi,
            bytecode: openRegistrarBytecode,
            args: [reg],
          }),
        });
        console.log("[sapling] step 2: hash =", h2);
        setActiveHash(h2);
        setActiveMining(true);
        const r2 = await publicClient.waitForTransactionReceipt({hash: h2});
        const reg2 = r2.contractAddress as Address | null;
        if (!reg2) throw new Error("Step 2: contractAddress missing on receipt");
        console.log("[sapling] step 2: registrar =", reg2);
        setRegistrar(reg2);
        setResults(s => ({...s, registrar: {done: true, txHash: h2}}));

        // ── 3: grantRootRoles ───────────────────────────────────────────
        setSubstep("grant");
        setActiveHash(undefined);
        setActiveMining(false);
        console.log("[sapling] step 3: grantRootRoles…");
        const h3 = await walletClient.sendTransaction({
          to: reg,
          data: encodeFunctionData({
            abi: userRegistryAbi,
            functionName: "grantRootRoles",
            args: [ROLE_REGISTRAR, reg2],
          }),
        });
        console.log("[sapling] step 3: hash =", h3);
        setActiveHash(h3);
        setActiveMining(true);
        await publicClient.waitForTransactionReceipt({hash: h3});
        setResults(s => ({...s, grant: {done: true, txHash: h3}}));

        // ── 4: setSubregistry on the parent registry ────────────────────
        setSubstep("wire");
        setActiveHash(undefined);
        setActiveMining(false);
        console.log("[sapling] step 4: setSubregistry on", parentRegistry);
        const h4 = await walletClient.sendTransaction({
          to: parentRegistry,
          data: encodeFunctionData({
            abi: ethRegistryAbi,
            functionName: "setSubregistry",
            args: [parentTokenId, reg],
          }),
        });
        console.log("[sapling] step 4: hash =", h4);
        setActiveHash(h4);
        setActiveMining(true);
        await publicClient.waitForTransactionReceipt({hash: h4});
        setResults(s => ({...s, wire: {done: true, txHash: h4}}));

        // ── done ────────────────────────────────────────────────────────
        setSubstep("done");
        setActiveHash(undefined);
        setActiveMining(false);
        console.log("[sapling] all 4 done. registry =", reg, "registrar =", reg2);
        onComplete(reg, reg2);
      } catch (e) {
        console.error("[sapling] deploy failed:", e);
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient, publicClient]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Deploying
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SubstepRow
          n={1}
          label="Deploy UserRegistry"
          state={stateOf("registry", substep, results.registry)}
          activeTxHash={substep === "registry" ? activeHash : undefined}
          activeMining={substep === "registry" && activeMining}
          finalTxHash={results.registry.txHash}
          contextAddr={registry}
        />
        <SubstepRow
          n={2}
          label="Deploy OpenRegistrar"
          state={stateOf("registrar", substep, results.registrar)}
          activeTxHash={substep === "registrar" ? activeHash : undefined}
          activeMining={substep === "registrar" && activeMining}
          finalTxHash={results.registrar.txHash}
          contextAddr={registrar}
        />
        <SubstepRow
          n={3}
          label="Grant ROLE_REGISTRAR"
          state={stateOf("grant", substep, results.grant)}
          activeTxHash={substep === "grant" ? activeHash : undefined}
          activeMining={substep === "grant" && activeMining}
          finalTxHash={results.grant.txHash}
        />
        <SubstepRow
          n={4}
          label={`Set subregistry under ${name}`}
          state={stateOf("wire", substep, results.wire)}
          activeTxHash={substep === "wire" ? activeHash : undefined}
          activeMining={substep === "wire" && activeMining}
          finalTxHash={results.wire.txHash}
        />

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Transaction failed</AlertTitle>
            <AlertDescription className="text-xs break-all">
              {error}
            </AlertDescription>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={onReset}>
                Start over
              </Button>
            </div>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

type RowState = "pending" | "active" | "done";

function stateOf(
  rowKey: Substep,
  current: Substep,
  result: SubstepResult,
): RowState {
  if (result.done) return "done";
  const order: Substep[] = ["registry", "registrar", "grant", "wire", "done"];
  if (rowKey === current) return "active";
  return order.indexOf(rowKey) < order.indexOf(current) ? "done" : "pending";
}

function SubstepRow({
  n,
  label,
  state,
  activeTxHash,
  activeMining,
  finalTxHash,
  contextAddr,
}: {
  n: number;
  label: string;
  state: RowState;
  activeTxHash?: Address;
  activeMining?: boolean;
  finalTxHash?: Address;
  contextAddr?: Address;
}) {
  const txHash = finalTxHash ?? activeTxHash;
  return (
    <div
      data-state={state}
      className="data-[state=pending]:opacity-50 flex items-start gap-3 rounded-lg border p-3"
    >
      <span
        data-state={state}
        className="data-[state=done]:bg-foreground data-[state=done]:text-background data-[state=active]:border-foreground border-border mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium"
      >
        {state === "done" ? (
          <Check className="size-3" />
        ) : state === "active" ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          n
        )}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-sm font-medium">{label}</span>
        {state === "active" && !activeTxHash && (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <Loader2 className="size-3 animate-spin" />
            Waiting for signature…
          </span>
        )}
        {state === "active" && activeTxHash && activeMining && (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <Loader2 className="size-3 animate-spin" />
            Mining…
          </span>
        )}
        {txHash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground font-mono text-xs underline"
          >
            {txHash.slice(0, 10)}…{txHash.slice(-8)}
          </a>
        )}
        {contextAddr && state === "done" && (
          <a
            href={`https://sepolia.etherscan.io/address/${contextAddr}`}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground font-mono text-xs underline"
          >
            → {contextAddr}
          </a>
        )}
      </div>
    </div>
  );
}

function SuccessStep({
  name,
  registry,
  registrar,
  onAnother,
}: {
  name: string;
  registry: Address;
  registrar: Address;
  onAnother: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Live on <span className="font-mono">{name}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p>
          Anyone can now mint a subname under{" "}
          <span className="font-mono">{name}</span> via your OpenRegistrar.
          Resolution walks the tree natively on Sepolia.
        </p>

        <Field label="UserRegistry">
          <a
            href={`https://sepolia.etherscan.io/address/${registry}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs underline"
          >
            {registry}
          </a>
        </Field>

        <Field label="OpenRegistrar">
          <a
            href={`https://sepolia.etherscan.io/address/${registrar}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs underline"
          >
            {registrar}
          </a>
        </Field>

        <Alert>
          <AlertTitle>What works now</AlertTitle>
          <AlertDescription className="text-sm">
            Visit{" "}
            <a
              className="underline"
              href={`https://explorer.ens.dev/${name}/subnames`}
              target="_blank"
              rel="noreferrer"
            >
              explorer.ens.dev/{name}/subnames
            </a>{" "}
            to see your subnames appear as they&apos;re minted.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onAnother}>
            Deploy for another name
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}
