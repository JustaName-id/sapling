import {type Address} from "viem";

const ENS_STAGING_GRAPHQL = "https://staging-graphql.ens.dev/";

export type OwnedName = {
  name: string;
  /** Unix seconds (number or string), or null when the indexer doesn't have one. */
  expiryDate: number | string | null;
};

type GraphResponse = {
  data?: {
    account: {
      id: string;
      domains: {name: string; expiryDate?: number | string | null}[];
    } | null;
  };
};

/**
 * Fetch all ENSv2-staging names owned by `address`, at any depth.
 * Subname rows come back with `expiryDate: null` because only top-level
 * `.eth` names have a direct expiry in the indexer.
 */
export async function fetchOwnedEthNames(
  address: Address,
): Promise<OwnedName[]> {
  const res = await fetch(ENS_STAGING_GRAPHQL, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      query: `{ account(id: "${address.toLowerCase()}") { id domains { name expiryDate } } }`,
    }),
  });
  if (!res.ok) throw new Error(`ENS graph ${res.status}`);
  const json: GraphResponse = await res.json();
  const domains = json.data?.account?.domains ?? [];
  return domains
    .filter(d => d.name.endsWith(".eth"))
    .map(d => ({name: d.name, expiryDate: d.expiryDate ?? null}))
    .sort((a, b) => a.name.localeCompare(b.name));
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
