import {keccak256, toBytes} from "viem";

/** Compute the ENS labelhash for a single label. */
export function labelhash(label: string): bigint {
  return BigInt(keccak256(toBytes(label)));
}
