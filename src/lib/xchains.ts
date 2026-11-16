// Solana and Tron over their public endpoints. The transactions themselves are built and signed in
// sol-core.ts and tron-core.ts; this file only reads balances, fetches a recent block, and relays.

import { activeNets, chainSettings, ensureExtraAddresses, fetchT } from './multichain';
import { assertAllowedX } from './xchains-core';
import { readPhrase } from './wallet';
import { solKey, trxKey } from './multichain-core';
import { SOL_NETS, signSolTransfer, solDelta, type SolNet, type SolTxRow } from './sol-core';
import { TRON_NETS, parseTronTxs, signTronTransfer, tronAddressOk, type TronNet, type TronTxRow } from './tron-core';

// ---------- Solana ----------

let rid = 0;
async function solRpc<T>(net: SolNet, method: string, params: unknown[]): Promise<T> {
  const r = await fetchT(SOL_NETS[net].rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++rid, method, params }) });
  if (r.status === 429) throw new Error('The Solana network is busy. Try again in a minute.');
  const j = (await r.json()) as { result?: T; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message ?? 'The Solana network refused it');
  return j.result as T;
}

export async function solBalance(net: SolNet, address: string): Promise<bigint> {
  const r = await solRpc<{ value: number }>(net, 'getBalance', [address, { commitment: 'confirmed' }]);
  return BigInt(r.value);
}

export async function solHistory(net: SolNet, address: string, limit = 8): Promise<SolTxRow[]> {
  const sigs = await solRpc<{ signature: string; blockTime?: number; err: unknown }[]>(net, 'getSignaturesForAddress', [address, { limit }]);
  const rows = await Promise.all(
    sigs.map(async (s): Promise<SolTxRow | null> => {
      const tx = await solRpc<unknown>(net, 'getTransaction', [s.signature, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]).catch(() => null);
      const d = tx ? solDelta(tx, address) : null;
      return d == null ? null : { id: s.signature, time: s.blockTime ?? undefined, delta: d, failed: s.err != null };
    }),
  );
  return rows.filter((r): r is SolTxRow => r !== null);
}

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
/** Known token mints, so a balance shows with a name. Others show by their mint. */
export const SOL_TOKENS: Record<string, { symbol: string; name: string; logo?: 'usdc' | 'usdt' }> = {
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': { symbol: 'USDC', name: 'USD Coin', logo: 'usdc' }, // devnet
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', name: 'USD Coin', logo: 'usdc' }, // mainnet
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', name: 'Tether', logo: 'usdt' }, // mainnet
};
export interface XToken {
  id: string;
  symbol: string;
  name: string;
  logo?: 'usdc' | 'usdt';
  balance: string;
}
export async function solTokens(net: SolNet, address: string): Promise<XToken[]> {
  const r = await solRpc<{ value: { account: { data: { parsed: { info: { mint: string; tokenAmount: { uiAmountString: string; amount: string } } } } } }[] }>(net, 'getTokenAccountsByOwner', [
    address,
    { programId: TOKEN_PROGRAM },
    { encoding: 'jsonParsed', commitment: 'confirmed' },
  ]);
  return r.value
    .map((v) => v.account.data.parsed.info)
    .filter((i) => i.tokenAmount.amount !== '0')
    .map((i) => {
      const k = SOL_TOKENS[i.mint];
      return { id: i.mint, symbol: k?.symbol ?? `${i.mint.slice(0, 4)}…`, name: k?.name ?? `Token ${i.mint.slice(0, 4)}…${i.mint.slice(-4)}`, logo: k?.logo, balance: i.tokenAmount.uiAmountString };
    });
}

/** Devnet and testnet hand out test SOL themselves (limited per day, and sometimes dry). */
export async function solAirdrop(net: SolNet, address: string): Promise<string> {
  if (SOL_NETS[net].real) throw new Error('No free SOL on mainnet');
  return solRpc<string>(net, 'requestAirdrop', [address, 1_000_000_000]);
}

/** The smallest balance a brand-new Solana account may hold (rent-exempt minimum for an empty account). */
const RENT_MIN = 890_880n;
const SOL_FEE = 5_000n;

export async function prepareSol(to: string, lamports: bigint) {
  const net = activeNets().sol;
  assertAllowedX(chainSettings.get(), 'sol', net);
  const a = await ensureExtraAddresses();
  const from = a.sol!;
  const [bal, toBal, bh] = await Promise.all([solBalance(net, from), solBalance(net, to), solRpc<{ value: { blockhash: string } }>(net, 'getLatestBlockhash', [{ commitment: 'confirmed' }])]);
  if (lamports + SOL_FEE > bal) throw new Error('Not enough SOL for that amount and the network fee (0.000005 SOL).');
  if (toBal === 0n && lamports < RENT_MIN) throw new Error('That address has never held SOL. The first payment to it must be at least 0.00089 SOL.');
  const left = bal - lamports - SOL_FEE;
  if (left > 0n && left < RENT_MIN) throw new Error('That would leave less than 0.00089 SOL, which Solana does not allow. Send everything but 0.001 SOL, or all of it minus the fee.');
  const phrase = await readPhrase();
  if (!phrase) throw new Error('No recovery words on this phone');
  const k = solKey(phrase);
  try {
    if (k.address !== from) throw new Error('Your Solana address does not match your words');
    return { net, from, fee: SOL_FEE, ...signSolTransfer(k.sk, from, to, lamports, bh.value.blockhash) };
  } finally {
    k.sk.fill(0);
  }
}

export async function broadcastSol(net: SolNet, b64: string): Promise<string> {
  return solRpc<string>(net, 'sendTransaction', [b64, { encoding: 'base64', preflightCommitment: 'confirmed' }]);
}

/** The slot once the payment is confirmed, null while waiting. Throws if it failed. */
export async function solTxSlot(net: SolNet, id: string): Promise<number | null> {
  const r = await solRpc<{ value: ({ slot: number; err: unknown; confirmationStatus?: string } | null)[] }>(net, 'getSignatureStatuses', [[id], { searchTransactionHistory: true }]);
  const s = r.value[0];
  if (!s) return null;
  if (s.err) throw new Error('The payment failed on the network. Only the fee was spent.');
  return s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized' ? s.slot : null;
}

// ---------- Tron ----------

async function tronPost<T>(net: TronNet, path: string, body: unknown): Promise<T> {
  const r = await fetchT(`${TRON_NETS[net].api}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (r.status === 429) throw new Error('The Tron network is busy. Try again in a minute.');
  if (!r.ok) throw new Error(`The Tron network answered ${r.status}`);
  return (await r.json()) as T;
}
async function tronGet<T>(net: TronNet, path: string): Promise<T> {
  const r = await fetchT(`${TRON_NETS[net].api}${path}`);
  if (r.status === 429) throw new Error('The Tron network is busy. Try again in a minute.');
  if (!r.ok) throw new Error(`The Tron network answered ${r.status}`);
  return (await r.json()) as T;
}

/** A Tron address that has never received anything does not exist yet; its balance is 0. */
export async function trxBalance(net: TronNet, address: string): Promise<bigint> {
  const r = await tronPost<{ balance?: number }>(net, '/wallet/getaccount', { address, visible: true });
  return BigInt(r.balance ?? 0);
}

export async function tronHistory(net: TronNet, address: string): Promise<TronTxRow[]> {
  return parseTronTxs(await tronGet<unknown>(net, `/v1/accounts/${address}/transactions?limit=20`), address).slice(0, 10);
}

/** TRC-20 tokens with a known name and decimals. */
export const TRON_TOKENS: Partial<Record<TronNet, Record<string, { symbol: string; name: string; decimals: number; logo?: 'usdt' | 'usdc' }>>> = {
  nile: { TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf: { symbol: 'USDT', name: 'Tether', decimals: 6, logo: 'usdt' } },
  mainnet: { TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t: { symbol: 'USDT', name: 'Tether', decimals: 6, logo: 'usdt' } },
};
export async function tronTokens(net: TronNet, address: string): Promise<XToken[]> {
  const j = await tronGet<{ data?: { trc20?: Record<string, string>[] }[] }>(net, `/v1/accounts/${address}`);
  const list = j.data?.[0]?.trc20 ?? [];
  const known = TRON_TOKENS[net] ?? {};
  const out: XToken[] = [];
  for (const entry of list)
    for (const [contract, raw] of Object.entries(entry)) {
      const k = known[contract];
      if (!k || !/^\d+$/.test(raw) || raw === '0') continue;
      const v = BigInt(raw);
      const unit = 10n ** BigInt(k.decimals);
      const frac = (v % unit).toString().padStart(k.decimals, '0').replace(/0+$/, '');
      out.push({ id: contract, symbol: k.symbol, name: k.name, logo: k.logo, balance: `${v / unit}${frac ? `.${frac.slice(0, 4)}` : ''}` });
    }
  return out;
}

export async function prepareTron(to: string, sun: bigint) {
  const net = activeNets().trx;
  assertAllowedX(chainSettings.get(), 'trx', net);
  if (!tronAddressOk(to)) throw new Error('That is not a Tron address');
  const a = await ensureExtraAddresses();
  const from = a.trx!;
  const [bal, toAcct, block] = await Promise.all([
    trxBalance(net, from),
    tronPost<{ address?: string }>(net, '/wallet/getaccount', { address: to, visible: true }),
    tronPost<{ blockID: string; block_header: { raw_data: { number: number; timestamp: number } } }>(net, '/wallet/getnowblock', {}),
  ]);
  // a new address costs 1 TRX to create; a payment without free bandwidth burns a little TRX for it
  const newAccount = !toAcct.address;
  const reserve = newAccount ? 1_100_000n : 300_000n;
  if (sun + reserve > bal) throw new Error(newAccount ? 'Not enough TRX. Paying a new Tron address costs 1 TRX extra to create it, plus a small fee.' : 'Not enough TRX for that amount and the network fee (keep about 0.3 TRX).');
  const ref = { number: block.block_header.raw_data.number, id: block.blockID, timestamp: block.block_header.raw_data.timestamp };
  const phrase = await readPhrase();
  if (!phrase) throw new Error('No recovery words on this phone');
  const k = trxKey(phrase);
  try {
    if (k.address !== from) throw new Error('Your Tron address does not match your words');
    return { net, from, newAccount, ...signTronTransfer(k.sk, from, to, sun, ref, Date.now()) };
  } finally {
    k.sk.fill(0);
  }
}

const unhex = (h: string) => {
  try {
    return decodeURIComponent(h.replace(/(..)/g, '%$1'));
  } catch {
    return h;
  }
};
export async function broadcastTron(net: TronNet, hex: string): Promise<string> {
  const r = await tronPost<{ result?: boolean; txid?: string; code?: string; message?: string }>(net, '/wallet/broadcasthex', { transaction: hex });
  if (!r.result) throw new Error(`The Tron network refused it: ${r.message ? unhex(r.message) : r.code ?? 'no reason given'}`);
  return r.txid ?? '';
}

/** The block once the payment is in one, null while waiting. Throws if it failed. */
export async function tronTxBlock(net: TronNet, id: string): Promise<number | null> {
  const r = await tronPost<{ blockNumber?: number; result?: string; resMessage?: string }>(net, '/wallet/gettransactioninfobyid', { value: id });
  if (r.result === 'FAILED') throw new Error(`The payment failed: ${r.resMessage ? unhex(r.resMessage) : 'no reason given'}`);
  return r.blockNumber ?? null;
}
