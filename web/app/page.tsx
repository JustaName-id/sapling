"use client";

import {useEffect, useRef, useState} from "react";
import {
  useAccount,
  useReadContract,
  useSendTransaction,
  useWaitForTransactionReceipt,
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

type Phase = "select" | "review" | "deploy" | "success";

type Substep = "registry" | "registrar" | "grant" | "wire" | "done";

type SubstepResult = {
  txHash?: Address;
  done: boolean;
};

export default function Home() {
  const {address, isConnected} = useAccount();
  const [phase, setPhase] = useState<Phase>("select");
  const [label, setLabel] = useState("");
  const [deployed, setDeployed] = useState<{
    registry: Address;
    registrar: Address;
  }>();
  const trimmed = label.trim().toLowerCase();

  const {data: parentTokenId} = useReadContract({
    address: SEPOLIA_ADDRESSES.ethRegistry,
    abi: ethRegistryAbi,
    functionName: "getTokenId",
    args: trimmed ? [labelhash(trimmed)] : undefined,
    query: {enabled: trimmed.length > 0},
  });

  const {data: parentOwner} = useReadContract({
    address: SEPOLIA_ADDRESSES.ethRegistry,
    abi: ethRegistryAbi,
    functionName: "ownerOf",
    args: parentTokenId ? [parentTokenId] : undefined,
    query: {enabled: parentTokenId !== undefined},
  });

  const ownsParent =
    !!address &&
    !!parentOwner &&
    address.toLowerCase() === parentOwner.toLowerCase();

  function reset() {
    setPhase("select");
    setLabel("");
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
              label={label}
              setLabel={setLabel}
              parentOwner={parentOwner as Address | undefined}
              ownsParent={ownsParent}
              address={address}
              onNext={() => setPhase("review")}
            />
          )}

          {phase === "review" && (
            <ReviewStep
              label={trimmed}
              admin={address!}
              onBack={() => setPhase("select")}
              onConfirm={() => setPhase("deploy")}
            />
          )}

          {phase === "deploy" && (
            <DeployFlow
              label={trimmed}
              admin={address!}
              parentTokenId={parentTokenId as bigint}
              onComplete={(registry, registrar) => {
                setDeployed({registry, registrar});
                setPhase("success");
              }}
              onReset={reset}
            />
          )}

          {phase === "success" && deployed && (
            <SuccessStep
              label={trimmed}
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
  label,
  setLabel,
  parentOwner,
  ownsParent,
  address,
  onNext,
}: {
  label: string;
  setLabel: (v: string) => void;
  parentOwner: Address | undefined;
  ownsParent: boolean;
  address: Address | undefined;
  onNext: () => void;
}) {
  const trimmed = label.trim().toLowerCase();
  const looksValid = /^[a-z0-9-]{3,}$/.test(trimmed);

  let status: "idle" | "checking" | "owns" | "not-owner" | "not-registered" =
    "idle";
  if (!trimmed || !looksValid) status = "idle";
  else if (parentOwner === undefined) status = "checking";
  else if (parentOwner === "0x0000000000000000000000000000000000000000")
    status = "not-registered";
  else if (ownsParent) status = "owns";
  else status = "not-owner";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Which name?
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="label">Your parent name</Label>
          <div className="flex items-center gap-2">
            <Input
              id="label"
              autoFocus
              spellCheck={false}
              placeholder="alice"
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="font-mono"
            />
            <span className="text-muted-foreground font-mono">.eth</span>
          </div>
          <p className="text-muted-foreground text-xs">
            We&apos;ll deploy a UserRegistry under{" "}
            <span className="font-mono">{trimmed || "your"}.eth</span>, an
            OpenRegistrar bound to it, grant the registrar role, and wire it
            under <span className="font-mono">.eth</span>.
          </p>
        </div>

        {status === "checking" && (
          <Alert>
            <AlertDescription>Checking ownership on Sepolia…</AlertDescription>
          </Alert>
        )}
        {status === "not-registered" && (
          <Alert variant="destructive">
            <AlertTitle>Not registered</AlertTitle>
            <AlertDescription>
              <span className="font-mono">{trimmed}.eth</span> isn&apos;t
              registered on Sepolia ENSv2 staging yet.
            </AlertDescription>
          </Alert>
        )}
        {status === "not-owner" && parentOwner && (
          <Alert variant="destructive">
            <AlertTitle>Different wallet owns this</AlertTitle>
            <AlertDescription className="font-mono text-xs">
              {parentOwner}
              <br />
              <span className="text-muted-foreground">
                connected: {address}
              </span>
            </AlertDescription>
          </Alert>
        )}
        {status === "owns" && (
          <Alert>
            <AlertTitle>You own this name</AlertTitle>
            <AlertDescription>
              You&apos;re ready to deploy a subregistry under it.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button disabled={status !== "owns"} onClick={onNext}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewStep({
  label,
  admin,
  onBack,
  onConfirm,
}: {
  label: string;
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
          <span className="font-mono">{label}.eth</span>
        </Field>
        <Field label="Admin (full control)">
          <span className="font-mono text-xs">{admin}</span>
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
                ethRegistry.setSubregistry({label}, registry)
              </code>{" "}
              — wire the registry under{" "}
              <span className="font-mono">.eth</span>.
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
 * Sequential 4-step deploy flow using a *single* useSendTransaction hook
 * reused across substeps. Running multiple hook instances side-by-side caused
 * cross-instance state interference (the wallet response from one would not
 * surface on the active hook), so we serialize through one mutation slot and
 * persist each step's result in local state before resetting.
 */
function DeployFlow({
  label,
  admin,
  parentTokenId,
  onComplete,
  onReset,
}: {
  label: string;
  admin: Address;
  parentTokenId: bigint;
  onComplete: (registry: Address, registrar: Address) => void;
  onReset: () => void;
}) {
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

  // We capture the active tx hash via the onSuccess callback rather than
  // reading `send.data` — that hook field doesn't update reliably for the
  // current wallet/connector when sendTransaction is invoked from a useEffect.
  // The callback fires reliably; we drive everything off that.
  const [activeHash, setActiveHash] = useState<Address>();
  const [callbackError, setCallbackError] = useState<string>();

  // One-shot guard per substep — StrictMode safety.
  const firedFor = useRef<Substep | null>(null);

  const send = useSendTransaction();
  const receipt = useWaitForTransactionReceipt({hash: activeHash});

  // Concise per-tick log.
  useEffect(() => {
    console.log(
      `[sapling] substep=${substep} | send.status=${send.status} activeHash=${activeHash ?? "—"} | receipt.status=${receipt.status} mined=${receipt.data ? "yes" : "no"} | err=${send.error?.message ?? callbackError ?? receipt.error?.message ?? "—"} | registry=${registry ?? "—"} registrar=${registrar ?? "—"}`,
    );
  }, [
    substep,
    send.status,
    send.error,
    activeHash,
    callbackError,
    receipt.status,
    receipt.data,
    receipt.error,
    registry,
    registrar,
  ]);

  // Firing effect.
  useEffect(() => {
    if (firedFor.current === substep) return;
    if (substep === "done") return;

    const onCb = {
      onSuccess: (hash: Address) => {
        console.log(`[sapling] [${substep}] onSuccess hash=`, hash);
        setActiveHash(hash);
      },
      onError: (err: Error) => {
        console.log(`[sapling] [${substep}] onError`, err);
        setCallbackError(err.message);
      },
    };

    if (substep === "registry") {
      firedFor.current = "registry";
      console.log("[sapling] firing 1: deployRegistry");
      send.sendTransaction(
        {
          to: SEPOLIA_ADDRESSES.saplingFactory,
          data: encodeFunctionData({
            abi: saplingFactoryAbi,
            functionName: "deployRegistry",
            args: [admin],
          }),
        },
        onCb,
      );
    } else if (substep === "registrar" && registry) {
      firedFor.current = "registrar";
      console.log("[sapling] firing 2: deploy OpenRegistrar", registry);
      send.sendTransaction(
        {
          data: encodeDeployData({
            abi: openRegistrarAbi,
            bytecode: openRegistrarBytecode,
            args: [registry],
          }),
        },
        onCb,
      );
    } else if (substep === "grant" && registry && registrar) {
      firedFor.current = "grant";
      console.log("[sapling] firing 3: grantRootRoles", {registry, registrar});
      send.sendTransaction(
        {
          to: registry,
          data: encodeFunctionData({
            abi: userRegistryAbi,
            functionName: "grantRootRoles",
            args: [ROLE_REGISTRAR, registrar],
          }),
        },
        onCb,
      );
    } else if (substep === "wire" && registry) {
      firedFor.current = "wire";
      console.log("[sapling] firing 4: setSubregistry", {parentTokenId, registry});
      send.sendTransaction(
        {
          to: SEPOLIA_ADDRESSES.ethRegistry,
          data: encodeFunctionData({
            abi: ethRegistryAbi,
            functionName: "setSubregistry",
            args: [parentTokenId, registry],
          }),
        },
        onCb,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [substep, registry, registrar]);

  // Receipt-driven advancement.
  useEffect(() => {
    if (!receipt.data) return;
    if (firedFor.current !== substep) return; // stale receipt
    const txHash = activeHash;

    if (substep === "registry") {
      const events = parseEventLogs({
        abi: saplingFactoryAbi,
        eventName: "RegistryDeployed",
        logs: receipt.data.logs,
      });
      const reg = events[0]?.args.registry as Address | undefined;
      if (!reg) {
        console.warn("[sapling] step 1 receipt: no RegistryDeployed event");
        return;
      }
      console.log("[sapling] step 1 done. registry =", reg);
      setResults(r => ({...r, registry: {done: true, txHash}}));
      setRegistry(reg);
      setActiveHash(undefined);
      setSubstep("registrar");
      return;
    }

    if (substep === "registrar") {
      const addr = receipt.data.contractAddress as Address | null;
      if (!addr) {
        console.warn("[sapling] step 2 receipt has no contractAddress");
        return;
      }
      console.log("[sapling] step 2 done. registrar =", addr);
      setResults(r => ({...r, registrar: {done: true, txHash}}));
      setRegistrar(addr);
      setActiveHash(undefined);
      setSubstep("grant");
      return;
    }

    if (substep === "grant") {
      console.log("[sapling] step 3 done");
      setResults(r => ({...r, grant: {done: true, txHash}}));
      setActiveHash(undefined);
      setSubstep("wire");
      return;
    }

    if (substep === "wire") {
      console.log("[sapling] step 4 done");
      if (!registry || !registrar) return;
      setResults(r => ({...r, wire: {done: true, txHash}}));
      setSubstep("done");
      onComplete(registry, registrar);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.data, substep]);

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
          activeMining={substep === "registry" && receipt.isLoading}
          finalTxHash={results.registry.txHash}
          contextAddr={registry}
        />
        <SubstepRow
          n={2}
          label="Deploy OpenRegistrar"
          state={stateOf("registrar", substep, results.registrar)}
          activeTxHash={substep === "registrar" ? activeHash : undefined}
          activeMining={substep === "registrar" && receipt.isLoading}
          finalTxHash={results.registrar.txHash}
          contextAddr={registrar}
        />
        <SubstepRow
          n={3}
          label="Grant ROLE_REGISTRAR"
          state={stateOf("grant", substep, results.grant)}
          activeTxHash={substep === "grant" ? activeHash : undefined}
          activeMining={substep === "grant" && receipt.isLoading}
          finalTxHash={results.grant.txHash}
        />
        <SubstepRow
          n={4}
          label={`Set subregistry under ${label}.eth`}
          state={stateOf("wire", substep, results.wire)}
          activeTxHash={substep === "wire" ? activeHash : undefined}
          activeMining={substep === "wire" && receipt.isLoading}
          finalTxHash={results.wire.txHash}
        />

        {(send.error || callbackError) && (
          <Alert variant="destructive">
            <AlertTitle>Transaction failed</AlertTitle>
            <AlertDescription className="text-xs break-all">
              {send.error?.message ?? callbackError}
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
  label,
  registry,
  registrar,
  onAnother,
}: {
  label: string;
  registry: Address;
  registrar: Address;
  onAnother: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Live on <span className="font-mono">{label}.eth</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p>
          Anyone can now mint a subname under{" "}
          <span className="font-mono">{label}.eth</span> via your OpenRegistrar.
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
              href={`https://explorer.ens.dev/${label}.eth/subnames`}
              target="_blank"
              rel="noreferrer"
            >
              explorer.ens.dev/{label}.eth/subnames
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
