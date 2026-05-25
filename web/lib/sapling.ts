import {
  concat,
  encodeAbiParameters,
  encodeDeployData,
  getCreate2Address,
  keccak256,
  pad,
  toHex,
  type Abi,
  type Address,
  type Hex,
} from "viem";

import {openRegistrarAbi, openRegistrarBytecode} from "./openRegistrar";
import {uupsProxyAbi, uupsProxyBytecode} from "./uupsProxy";

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
 * Cryptographically random 256-bit salt for fresh deploys. Used when the user
 * wants a new registry under a parent that already has one — pick a random
 * salt instead of bumping the canonical (tokenId) one so collisions are
 * effectively impossible on first try.
 */
export function randomSalt(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n;
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
 * CREATE2 address of the UserRegistry proxy that SaplingFactory.deployRegistry
 * would land at for the given (admin, salt). Pure derivation, no RPC call.
 *
 * Mirrors the on-chain composition exactly:
 *   namespacedSalt = keccak256(abi.encode(admin, salt))
 *   outerSalt      = keccak256(abi.encode(SaplingFactory, namespacedSalt))
 *   initcode       = UUPSProxy.creationCode || abi.encode(VerifiableFactory, outerSalt)
 *   proxy          = CREATE2(deployer = VerifiableFactory, salt = outerSalt, initcode)
 *
 * Pair with `getCode(predicted)` to test for prior deployment without any
 * event-log scan or block-range dance.
 */
export function predictUserRegistryAddress(
  admin: Address,
  salt: bigint,
): Address {
  const namespacedSalt = keccak256(
    encodeAbiParameters(
      [{type: "address"}, {type: "uint256"}],
      [admin, salt],
    ),
  );
  const outerSalt = keccak256(
    encodeAbiParameters(
      [{type: "address"}, {type: "uint256"}],
      [SEPOLIA_ADDRESSES.saplingFactory, BigInt(namespacedSalt)],
    ),
  );
  const initcode = encodeDeployData({
    abi: uupsProxyAbi,
    bytecode: uupsProxyBytecode,
    args: [SEPOLIA_ADDRESSES.verifiableFactory, outerSalt],
  });
  return getCreate2Address({
    from: SEPOLIA_ADDRESSES.verifiableFactory,
    salt: outerSalt,
    bytecodeHash: keccak256(initcode),
  });
}
