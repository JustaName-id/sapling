import {type Address, type Abi} from "viem";

/**
 * Canonical Sapling and ENSv2 staging addresses on Sepolia.
 */
export const SEPOLIA_ADDRESSES = {
  saplingFactory: "0xE491D4F2804E386d3b557d3401C0F95F7CdC7de7" as Address,
  ethRegistry: "0x796fFF2E907449be8D5921BCC215B1b76D89d080" as Address,
  verifiableFactory: "0x9240c5F31D747d60b3d9Aed2F57995094342B1Ed" as Address,
  userRegistryImpl: "0xEa93AFf7375E8176053ab6ab36B57cab53CbF702" as Address,
} as const;

/** RegistryRolesLib.ROLE_REGISTRAR = 1 << 0 */
export const ROLE_REGISTRAR = BigInt(1);

export const saplingFactoryAbi = [
  {
    type: "function",
    name: "deployRegistry",
    inputs: [{name: "admin", type: "address"}],
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
