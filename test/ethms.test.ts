import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { decodeFunctionData, type Hex } from 'viem';
import { addSignature, createCall, decodePay, encodePay, execData, sharedAddress, validSigners, type Pay } from '../src/lib/ethms-core.ts';
import { ABI } from '../src/lib/ethvault-core.ts';

const keys: Hex[] = ['0x' + '11'.repeat(32), '0x' + '22'.repeat(32), '0x' + '33'.repeat(32)] as Hex[];
const who = keys.map((k) => privateKeyToAccount(k).address);

test('shared Ethereum account: same address in any order; two of three signatures, sorted', async () => {
  const a = sharedAddress({ owners: who, threshold: 2 });
  assert.equal(sharedAddress({ owners: [...who].reverse(), threshold: 2 }), a);
  assert.notEqual(sharedAddress({ owners: who, threshold: 3 }), a);
  const c = createCall({ owners: who, threshold: 2 });
  assert.equal(decodeFunctionData({ abi: ABI.factory, data: c.data }).functionName, 'createProxyWithNonce');

  let p: Pay = { chainId: 11155111, safe: a, to: '0x000000000000000000000000000000000000dEaD', value: '1000000000000000', nonce: '0', sigs: {} };
  p = await addSignature(p, keys[2], who[2]);
  p = decodePay(encodePay(p));
  assert.deepEqual(await validSigners(p, who), [who[2]]);
  await assert.rejects(execData(p, who, 2), /1 more signature/);

  // a signature from someone who isn't an owner doesn't count
  const outsider = '0x' + '44'.repeat(32) as Hex;
  const q = await addSignature(p, outsider, privateKeyToAccount(outsider).address);
  assert.equal((await validSigners(q, who)).length, 1);

  p = await addSignature(p, keys[0], who[0]);
  const ex = await execData(p, who, 2);
  const d = decodeFunctionData({ abi: ABI.safe, data: ex.data });
  assert.equal(d.functionName, 'execTransaction');
  const sig = d.args[9] as Hex;
  assert.equal((sig.length - 2) / 2, 130);
  // first signature belongs to the lower address
  const [lo] = [who[0], who[2]].sort((x, y) => (x.toLowerCase() < y.toLowerCase() ? -1 : 1));
  assert.equal(sig.slice(0, 132), p.sigs[lo].slice(0, 132));
});
