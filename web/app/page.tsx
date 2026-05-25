"use client";

import {useEffect, useMemo, useState} from "react";
import {useAccount, usePublicClient} from "wagmi";
import {type Address, type PublicClient} from "viem";

import {BrandMark} from "@/components/brand-mark";
import {ConnectButton} from "@/components/connect-button";
import {Footer} from "@/components/footer";
import {StepIndicator} from "@/components/step-indicator";
import {ToastHost} from "@/components/toast";

import {
  ConnectScreen,
  type Network,
} from "@/components/screens/connect-screen";
import {PickParentScreen} from "@/components/screens/pick-parent-screen";
import {
  RegistryScreen,
  type RegistryConfig,
} from "@/components/screens/registry-screen";
import {
  RegistrarScreen,
  type RegistrarConfig,
} from "@/components/screens/registrar-screen";
import {DeployScreen} from "@/components/screens/deploy-screen";
import {SuccessScreen} from "@/components/screens/success-screen";

import {SEPOLIA_ADDRESSES, ethRegistryAbi} from "@/lib/sapling";
import {labelhash} from "@/lib/labelhash";

type Step = 0 | 1 | 2 | 3 | 4;

type ParentInfo = {
  registry: Address;
  tokenId: bigint;
  owner: Address;
  label: string;
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as Address;

export default function Home() {
  const {address, isConnected} = useAccount();
  const publicClient = usePublicClient();

  const [step, setStep] = useState<Step>(0);
  const [network, setNetwork] = useState<Network>("sepolia");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [parentInfo, setParentInfo] = useState<ParentInfo | null>(null);
  const [parentExisting, setParentExisting] = useState<Address | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string>();

  const [registry, setRegistry] = useState<RegistryConfig>({
    source: "deploy",
    admin: (address ?? ZERO_ADDR) as Address,
    upgradeable: true,
    pasteAddress: "",
    touched: false,
  });
  const [registrar, setRegistrar] = useState<RegistrarConfig>({
    source: "deploy",
    mode: "open",
    emancipate: false,
    pasteAddress: "",
  });

  const [deployed, setDeployed] = useState<{
    registry: Address;
    registrar: Address;
    txHash?: string;
  }>();

  // Keep admin synced to connected wallet until user touches it.
  useEffect(() => {
    if (!address) return;
    setRegistry(r =>
      r.touched ? r : {...r, admin: address},
    );
  }, [address]);

  // Disconnect during the deeper steps (Registry/Registrar/Deploy) kicks back
  // to the hero — those steps need an active wallet + an owned parent. Parent
  // step (1) is allowed to be in a disconnected state and renders its own
  // connect prompt.
  useEffect(() => {
    if (!isConnected && step > 1) {
      setStep(0);
      setSelectedName(null);
      setParentInfo(null);
      setParentExisting(null);
      setDeployed(undefined);
    }
  }, [isConnected, step]);

  const handleStart = () => goto(1);

  // Resolve parent registry + detect existing UserRegistry when selectedName changes.
  useEffect(() => {
    if (!selectedName || !publicClient) {
      setParentInfo(null);
      setParentExisting(null);
      setResolveError(undefined);
      return;
    }
    let cancelled = false;
    setResolving(true);
    setResolveError(undefined);
    (async () => {
      try {
        const info = await resolveParent(selectedName, publicClient);
        if (cancelled) return;
        setParentInfo(info);

        // After we have the parent's registry + label, check whether this
        // name already has a UserRegistry wired underneath.
        const existing = (await publicClient.readContract({
          address: info.registry,
          abi: ethRegistryAbi,
          functionName: "getSubregistry",
          args: [info.label],
        })) as Address;
        if (cancelled) return;
        setParentExisting(existing === ZERO_ADDR ? null : existing);
      } catch (e) {
        if (cancelled) return;
        console.warn("[sapling] resolveParent failed", e);
        setResolveError(e instanceof Error ? e.message : String(e));
        setParentInfo(null);
        setParentExisting(null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedName, publicClient]);

  const ownsParent = useMemo(
    () =>
      !!address &&
      !!parentInfo &&
      address.toLowerCase() === parentInfo.owner.toLowerCase(),
    [address, parentInfo],
  );

  const goto = (s: Step) => {
    setStep(s);
    if (typeof window !== "undefined") {
      window.scrollTo({top: 0, behavior: "smooth"});
    }
  };

  const reset = () => {
    setStep(0);
    setSelectedName(null);
    setParentInfo(null);
    setParentExisting(null);
    setDeployed(undefined);
    setRegistry({
      source: "deploy",
      admin: (address ?? ZERO_ADDR) as Address,
      upgradeable: true,
      pasteAddress: "",
      touched: false,
    });
    setRegistrar({
      source: "deploy",
      mode: "open",
      emancipate: false,
      pasteAddress: "",
    });
  };

  const showStepIndicator = step > 0 && !deployed;
  const indicatorIndex = (step - 1) as 0 | 1 | 2 | 3;

  return (
    <div className="min-h-screen flex flex-col bg-bg text-fg">
      <header className="h-16 border-b border-border flex items-center px-7 gap-4 bg-bg sticky top-0 z-10">
        <span
          className="flex items-center gap-1.5 font-semibold text-[15px] tracking-[-0.01em] cursor-pointer"
          onClick={reset}
        >
          <span className="text-accent inline-flex">
            <BrandMark />
          </span>
          Sapling
        </span>

        <div className="flex-1" />

        <ConnectButton />
      </header>

      {showStepIndicator && <StepIndicator current={indicatorIndex} />}

      <main className="flex-1 px-6 py-6 pb-20">
        {step === 0 ? (
          <ConnectScreen onStart={handleStart} />
        ) : deployed && parentInfo && selectedName ? (
          <SuccessScreen
            parent={selectedName}
            network={network}
            registry={deployed.registry}
            registrar={deployed.registrar}
            txHash={deployed.txHash}
            onReset={reset}
          />
        ) : step === 1 ? (
          <PickParentScreen
            address={address}
            network={network}
            selected={selectedName}
            setSelected={setSelectedName}
            onNext={() => {
              if (ownsParent) goto(2);
            }}
            onBack={() => goto(0)}
          />
        ) : step === 2 && parentInfo && address ? (
          <>
            {resolving && (
              <div className="max-w-[720px] mx-auto mb-4 text-[12.5px] text-fg-3 font-mono">
                Resolving parent registry…
              </div>
            )}
            {resolveError && (
              <div className="max-w-[720px] mx-auto mb-4 text-[12.5px] text-danger">
                {resolveError}
              </div>
            )}
            <RegistryScreen
              parent={selectedName!}
              parentExisting={parentExisting}
              registry={registry}
              setRegistry={setRegistry}
              connectedAddress={address}
              onNext={() => goto(3)}
              onBack={() => goto(1)}
            />
          </>
        ) : step === 3 && parentInfo ? (
          <RegistrarScreen
            parent={selectedName!}
            registrar={registrar}
            setRegistrar={setRegistrar}
            onNext={() => goto(4)}
            onBack={() => goto(2)}
          />
        ) : step === 4 && parentInfo ? (
          <DeployScreen
            parent={selectedName!}
            parentInfo={parentInfo}
            network={network}
            registry={registry}
            registrar={registrar}
            onDone={(r, reg, tx) =>
              setDeployed({registry: r, registrar: reg, txHash: tx})
            }
            onBack={() => goto(3)}
          />
        ) : (
          // Step needs parentInfo but it's still loading or unresolved.
          <div className="max-w-[720px] mx-auto text-fg-3">
            {resolving
              ? "Resolving the parent name on Sepolia…"
              : resolveError
                ? resolveError
                : "Loading…"}
          </div>
        )}
      </main>

      <Footer />
      <ToastHost />
    </div>
  );
}

async function resolveParent(
  fullName: string,
  publicClient: PublicClient,
): Promise<ParentInfo> {
  const labels = fullName.split(".");
  if (labels[labels.length - 1] !== "eth")
    throw new Error("must end with .eth");
  if (labels.length < 2) throw new Error("name too short");

  const leafLabel = labels[0];
  const middle = labels.slice(1, -1).reverse();

  let current: Address = SEPOLIA_ADDRESSES.ethRegistry;
  for (const lbl of middle) {
    const next = (await publicClient.readContract({
      address: current,
      abi: ethRegistryAbi,
      functionName: "getSubregistry",
      args: [lbl],
    })) as Address;
    if (next === ZERO_ADDR)
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
