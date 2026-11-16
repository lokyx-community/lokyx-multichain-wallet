// Shared Ethereum accounts on the phone: the list (public data only), creating one on chain, reading it,
// and starting, signing and sending payments.

import { decodeFunctionResult, encodeFunctionData, getAddress, parseEther, type Hex } from 'viem';
import { getItem, setItem } from './kv';
import { store, useStore } from './store';
import { activeNets, ensureAddresses, ethBalance, ethCode, ethRead, sendEthCall, withEthKey } from './multichain';
import { ETH_NETS } from './multichain-core';
import { ABI } from './ethvault-core';
import { addSignature, createCall, execData, sharedAddress, type EthShared, type Pay } from './ethms-core';

export interface EthSharedSaved extends EthShared {
  address: Hex;
  at: number;
}
export const ethShared = store<EthSharedSaved[]>([]);
export const useEthShared = () => useStore(ethShared);
export async function loadEthShared() {
  try {
    ethShared.set(JSON.parse((await getItem('w.ethms')) ?? '[]'));
  } catch {}
}
async function save(list: EthSharedSaved[]) {
  ethShared.set(list);
  await setItem('w.ethms', JSON.stringify(list));
}

/** Remember it, and create it on chain if nobody has yet (you pay the gas). */
export async function addEthShared(name: string, owners: string[], threshold: number, create: boolean): Promise<EthSharedSaved> {
  const net = activeNets().eth;
  const s: EthShared = { name: name.trim() || 'Shared Ethereum', chainId: ETH_NETS[net].chainId, owners: owners.map((o) => getAddress(o)), threshold };
  const address = sharedAddress(s);
  if (create && (await ethCode(net, address)) === '0x') {
    const c = createCall(s);
    await sendEthCall(c.to, c.data);
  }
  const item = { ...s, address, at: Date.now() };
  await save([item, ...ethShared.get().filter((x) => x.address !== address)]);
  return item;
}
export const removeEthShared = (address: string) => save(ethShared.get().filter((x) => x.address !== address));

export async function readEthShared(s: EthSharedSaved) {
  const net = activeNets().eth;
  if ((await ethCode(net, s.address)) === '0x') return { exists: false, balance: 0n, nonce: 0n };
  const [bal, nonceHex] = await Promise.all([ethBalance(net, s.address), ethRead(net, s.address, encodeFunctionData({ abi: ABI.safe, functionName: 'nonce' }))]);
  return { exists: true, balance: bal, nonce: decodeFunctionResult({ abi: ABI.safe, functionName: 'nonce', data: nonceHex }) as bigint };
}

export async function startEthPay(s: EthSharedSaved, to: string, eth: string): Promise<Pay> {
  const r = await readEthShared(s);
  if (!r.exists) throw new Error("The shared account hasn't been created on this network yet");
  const p: Pay = { chainId: s.chainId, safe: s.address, to: getAddress(to.trim()), value: parseEther(eth.trim()).toString(), nonce: r.nonce.toString(), sigs: {} };
  return signEthPay(s, p);
}

export async function signEthPay(s: EthSharedSaved, p: Pay): Promise<Pay> {
  if (getAddress(p.safe) !== getAddress(s.address) || p.chainId !== s.chainId) throw new Error('This payment is for a different account');
  const me = (await ensureAddresses()).eth;
  if (!s.owners.some((o) => o.toLowerCase() === me.toLowerCase())) throw new Error("You aren't one of this account's owners");
  return withEthKey((sk, addr) => addSignature(p, sk, addr));
}

export async function sendEthPay(s: EthSharedSaved, p: Pay): Promise<string> {
  const { to, data } = await execData(p, s.owners, s.threshold);
  return sendEthCall(to, data);
}
