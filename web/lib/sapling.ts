import {
  concat,
  decodeFunctionData,
  encodeDeployData,
  getCreate2Address,
  keccak256,
  pad,
  toHex,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

import {openRegistrarAbi, openRegistrarBytecode} from "./openRegistrar";

/**
 * Canonical Sapling and ENSv2 staging addresses on Sepolia.
 */
export const SEPOLIA_ADDRESSES = {
  saplingFactory: "0x7D6175379F903e575694A503A02A3A1261805ef6" as Address,
  ethRegistry: "0x796fFF2E907449be8D5921BCC215B1b76D89d080" as Address,
  verifiableFactory: "0x9240c5F31D747d60b3d9Aed2F57995094342B1Ed" as Address,
  userRegistryImpl: "0xEa93AFf7375E8176053ab6ab36B57cab53CbF702" as Address,
} as const;

/**
 * Block at which the canonical Sepolia SaplingFactory was deployed. Used as a
 * lower bound when scanning RegistryDeployed events so we don't ask the RPC
 * to look further back than necessary (and avoid block-range limits).
 */
export const SAPLING_FACTORY_DEPLOY_BLOCK_SEPOLIA = 10_896_004n;

/**
 * Arachnid's deterministic deployment proxy, pre-deployed on every EVM chain.
 * Calldata layout: `salt (32 bytes) || initcode`.
 * Reference: https://github.com/Arachnid/deterministic-deployment-proxy
 */
export const STANDARD_CREATE2_DEPLOYER =
  "0x4e59b44847b379578588920cA78FbF26c0B4956C" as Address;

/** RegistryRolesLib.ROLE_REGISTRAR = 1 << 0 */
export const ROLE_REGISTRAR = BigInt(1);

export const saplingFactoryAbi = [
  {
    type: "function",
    name: "deployRegistry",
    inputs: [
      {name: "admin", type: "address"},
      {name: "salt", type: "uint256"},
    ],
    outputs: [{name: "registry", type: "address"}],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "RegistryDeployed",
    inputs: [
      {name: "admin", type: "address", indexed: true},
      {name: "registry", type: "address", indexed: true},
      {name: "caller", type: "address", indexed: true},
    ],
  },
] as const satisfies Abi;

/**
 * Per-parent salt used for both the UserRegistry (via SaplingFactory) and the
 * OpenRegistrar (via the standard CREATE2 deployer). Tying both to the parent
 * tokenId gives a single canonical (registry, registrar) pair per `.eth` name.
 */
export function saltForParent(parentTokenId: bigint): Hex {
  return pad(toHex(parentTokenId), {size: 32});
}

/**
 * CREATE2 address of the OpenRegistrar that would be deployed via the standard
 * deployer for the given (registry, salt). Pure derivation, no RPC call.
 */
export function predictOpenRegistrarAddress(
  registry: Address,
  salt: Hex,
): Address {
  const initcode = encodeDeployData({
    abi: openRegistrarAbi,
    bytecode: openRegistrarBytecode,
    args: [registry],
  });
  return getCreate2Address({
    from: STANDARD_CREATE2_DEPLOYER,
    salt,
    bytecodeHash: keccak256(initcode),
  });
}

/**
 * Calldata for deploying an OpenRegistrar through the standard CREATE2 deployer.
 * Bake the salt onto the front of the initcode and send `to = deployer`.
 */
export function openRegistrarCreate2Calldata(
  registry: Address,
  salt: Hex,
): Hex {
  const initcode = encodeDeployData({
    abi: openRegistrarAbi,
    bytecode: openRegistrarBytecode,
    args: [registry],
  });
  return concat([salt, initcode]);
}

export const ethRegistryAbi = [
  {
    type: "function",
    name: "ownerOf",
    inputs: [{name: "tokenId", type: "uint256"}],
    outputs: [{type: "address"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTokenId",
    inputs: [{name: "anyId", type: "uint256"}],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubregistry",
    inputs: [{name: "label", type: "string"}],
    outputs: [{type: "address"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setSubregistry",
    inputs: [
      {name: "anyId", type: "uint256"},
      {name: "registry", type: "address"},
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const satisfies Abi;

/** Minimal UserRegistry ABI for grantRootRoles (inherited from EAC). */
export const userRegistryAbi = [
  {
    type: "function",
    name: "grantRootRoles",
    inputs: [
      {name: "roleBitmap", type: "uint256"},
      {name: "account", type: "address"},
    ],
    outputs: [{type: "bool"}],
    stateMutability: "nonpayable",
  },
] as const satisfies Abi;

/**
 * Look up an already-deployed UserRegistry for (admin, salt) by scanning the
 * SaplingFactory's RegistryDeployed events.
 *
 * Used as the primary path when predicting the registry address: if a prior
 * deploy exists, simulating deployRegistry would revert (CREATE2 collision in
 * VerifiableFactory), so we ask the chain for what's there instead.
 *
 * Returns null if no matching event found.
 */
export async function findExistingUserRegistry(
  publicClient: PublicClient,
  admin: Address,
  salt: bigint,
): Promise<Address | null> {
  const events = await publicClient.getContractEvents({
    address: SEPOLIA_ADDRESSES.saplingFactory,
    abi: saplingFactoryAbi,
    eventName: "RegistryDeployed",
    args: {admin},
    fromBlock: SAPLING_FACTORY_DEPLOY_BLOCK_SEPOLIA,
  });
  for (const e of events) {
    if (!e.transactionHash) continue;
    try {
      const tx = await publicClient.getTransaction({hash: e.transactionHash});
      const decoded = decodeFunctionData({
        abi: saplingFactoryAbi,
        data: tx.input,
      });
      if (
        decoded.functionName === "deployRegistry" &&
        decoded.args[1] === salt
      ) {
        return e.args.registry as Address;
      }
    } catch {
      // Skip unparseable txs (e.g. smart-account wrappers we can't decode).
    }
  }
  return null;
}
