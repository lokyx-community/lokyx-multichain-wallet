// Bitcoin and Ethereum addresses as LOKYX sun codes. Both carry a 20-byte payload, so they fit the same sun
// (sun.ts) with a different type byte:
//   3  Bitcoin mainnet, native segwit (bc1q…, 20-byte key hash)
//   4  Bitcoin test networks (tb1q…): signet and testnet share the prefix
//   5  Ethereum (0x…, 20 bytes); also what a token (ERC-20) is received at
// Taproot (32-byte) and other chains with longer addresses need a bigger sun and are not drawn as rings;
// the QR code is always available for those and for other wallets.

import { bech32 } from '@scure/base';
import { getAddress } from 'viem';

export const TYPE_BTC = 3;
export const TYPE_BTC_TEST = 4;
export const TYPE_ETH = 5;

export interface ChainSun {
  type: number;
  bytes: Uint8Array;
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** The type byte and 20 payload bytes for an address, or null when it can't be drawn as a sun. */
export function chainToSun(chain: 'btc' | 'eth', address: string): ChainSun | null {
  try {
    const a = address.trim();
    if (chain === 'eth') {
      if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return null;
      return { type: TYPE_ETH, bytes: Uint8Array.from(a.slice(2).match(/../g)!.map((h) => parseInt(h, 16))) };
    }
    const { prefix, words } = bech32.decode(a.toLowerCase() as `${string}1${string}`);
    if (prefix !== 'bc' && prefix !== 'tb') return null;
    if (words[0] !== 0) return null; // witness v0 only (v1 taproot is 32 bytes)
    const prog = bech32.fromWords(words.slice(1));
    if (prog.length !== 20) return null; // P2WSH is 32 bytes
    return { type: prefix === 'bc' ? TYPE_BTC : TYPE_BTC_TEST, bytes: Uint8Array.from(prog) };
  } catch {
    return null;
  }
}

/** The address a sun with this type byte stands for, or null if the type isn't a Bitcoin or Ethereum one. */
export function sunToChain(type: number, bytes: Uint8Array): { chain: 'btc' | 'eth'; address: string } | null {
  if (bytes.length !== 20) return null;
  if (type === TYPE_ETH) return { chain: 'eth', address: getAddress(`0x${hex(bytes)}`) };
  if (type === TYPE_BTC || type === TYPE_BTC_TEST) return { chain: 'btc', address: bech32.encode(type === TYPE_BTC ? 'bc' : 'tb', [0, ...bech32.toWords(bytes)]) };
  return null;
}
