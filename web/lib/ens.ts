import {type Address} from "viem";

const ENS_STAGING_GRAPHQL = "https://staging-graphql.ens.dev/";

type GraphResponse = {
  data?: {
    account: {
      id: string;
      domains: {name: string}[];
    } | null;
  };
};

/**
 * Fetch all ENSv2-staging names owned by `address`, at any depth. Sapling is
 * recursive — anyone can deploy a subregistry under any name they own,
 * including deeper subnames like `bob.alice.eth`.
 */
export async function fetchOwnedEthNames(address: Address): Promise<string[]> {
  const res = await fetch(ENS_STAGING_GRAPHQL, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      query: `{ account(id: "${address.toLowerCase()}") { id domains { name } } }`,
    }),
  });
  if (!res.ok) throw new Error(`ENS graph ${res.status}`);
  const json: GraphResponse = await res.json();
  const domains = json.data?.account?.domains ?? [];
  return domains
    .map(d => d.name)
    .filter(n => n.endsWith(".eth"))
    .sort();
}
