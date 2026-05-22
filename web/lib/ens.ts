import {namehash, type Abi, type Address, type PublicClient} from "viem";

const ENS_STAGING_GRAPHQL = "https://staging-graphql.ens.dev/";

export type OwnedName = {
  name: string;
  /** Unix seconds (number or string), or null when the indexer doesn't have one. */
  expiryDate: number | string | null;
  /** Resolver address (used to fetch text records). null when the indexer has none. */
  resolverAddress: Address | null;
  /** Text record keys present on the resolver, e.g. `["avatar", "url"]`. */
  texts: string[];
  /** Resolved avatar URL once `resolveAvatars` has run. Undefined until then. */
  avatarUrl?: string;
};

type GraphResponse = {
  data?: {
    account: {
      id: string;
      domains: {
        name: string;
        expiryDate?: number | string | null;
        resolver?: {address?: string; texts?: string[]} | null;
      }[];
    } | null;
  };
};

/**
 * Fetch all ENSv2-staging names owned by `address`, at any depth. Pulls the
 * resolver address + text-record keys in the same query so callers can decide
 * which names need a follow-up `text()` resolve (e.g. for the avatar).
 *
 * Subname rows come back with `expiryDate: null` because only top-level
 * `.eth` names have a direct expiry in the indexer.
 *
 * Accepts an optional AbortSignal so callers can cancel in-flight requests
 * (e.g. on React 19 Strict Mode double-effects, on re-renders, or when the
 * component unmounts).
 */
export async function fetchOwnedEthNames(
  address: Address,
  signal?: AbortSignal,
): Promise<OwnedName[]> {
  const res = await fetch(ENS_STAGING_GRAPHQL, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      query: `{ account(id: "${address.toLowerCase()}") { id domains { name expiryDate resolver { address texts } } } }`,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`ENS graph ${res.status}`);
  const json: GraphResponse = await res.json();
  const domains = json.data?.account?.domains ?? [];
  return domains
    .filter(d => d.name.endsWith(".eth"))
    .map(d => ({
      name: d.name,
      expiryDate: d.expiryDate ?? null,
      resolverAddress: (d.resolver?.address as Address | undefined) ?? null,
      texts: d.resolver?.texts ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const resolverTextAbi = [
  {
    type: "function",
    name: "text",
    inputs: [
      {name: "node", type: "bytes32"},
      {name: "key", type: "string"},
    ],
    outputs: [{type: "string"}],
    stateMutability: "view",
  },
] as const satisfies Abi;

/**
 * For each name whose resolver advertises an `avatar` text record, read the
 * value off-chain in parallel and merge it back into the array. Names without
 * an avatar key (or with a resolver-less domain) come back unchanged.
 *
 * Browser-renderable values only (https://, http://, data:); anything else
 * is dropped here so the avatar component can fall back cleanly instead of
 * trying to render an unsupported scheme.
 */
export async function resolveAvatars(
  publicClient: PublicClient,
  names: OwnedName[],
  signal?: AbortSignal,
): Promise<OwnedName[]> {
  return Promise.all(
    names.map(async n => {
      if (signal?.aborted) return n;
      if (!n.resolverAddress) return n;
      if (!n.texts.includes("avatar")) return n;
      try {
        const value = await publicClient.readContract({
          address: n.resolverAddress,
          abi: resolverTextAbi,
          functionName: "text",
          args: [namehash(n.name), "avatar"],
        });
        if (!value) return n;
        if (
          value.startsWith("https://") ||
          value.startsWith("http://") ||
          value.startsWith("data:")
        ) {
          return {...n, avatarUrl: value};
        }
        return n;
      } catch {
        return n;
      }
    }),
  );
}

/** `labels.length > 2` — e.g. `bob.alice.eth`, `factory.leooo.eth`. */
export function isSubname(name: string): boolean {
  return name.split(".").length > 2;
}

/**
 * For a top-level `.eth`: "Expires in N years" / "Expired" / "No expiry".
 * For a subname: "When parent expires" (we don't fetch the parent's expiry).
 */
export function formatExpiry(name: string, expiry: number | string | null): string {
  if (isSubname(name)) return "When parent expires";
  if (expiry === null || expiry === undefined) return "No expiry";
  const seconds = Number(expiry);
  if (!Number.isFinite(seconds) || seconds <= 0) return "No expiry";
  const nowSec = Math.floor(Date.now() / 1000);
  const diff = seconds - nowSec;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86_400);
  if (days < 1) {
    const hours = Math.max(1, Math.floor(diff / 3_600));
    return `Expires in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (days < 60) return `Expires in ${days} day${days === 1 ? "" : "s"}`;
  if (days < 730) {
    const months = Math.floor(days / 30);
    return `Expires in ${months} month${months === 1 ? "" : "s"}`;
  }
  const years = Math.floor(days / 365);
  return `Expires in ${years} year${years === 1 ? "" : "s"}`;
}
