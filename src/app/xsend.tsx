import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { T } from '../ui/Text';
import { Button, ErrorText, Field, Note, Screen, failure, success } from '../ui/controls';
import { DestGuard } from '../ui/DestGuard';
import { ApproveButton } from '../ui/ApproveButton';
import { flyCoin } from '../ui/CoinFlight';
import { C } from '../ui/theme';
import { confirmIt } from '../lib/auth';
import { newDeviceGate } from '../lib/guard';
import { plainError } from '../lib/plain-error';
import { activeNets, ensureExtraAddresses, knownDestinations, rememberDestination, useChainSettings } from '../lib/multichain';
import { formatUnits } from '../lib/multichain-core';
import { SOL_DECIMALS, SOL_NETS, parseSol, solAddressOk } from '../lib/sol-core';
import { TRON_NETS, TRX_DECIMALS, parseTrx, tronAddressOk } from '../lib/tron-core';
import { broadcastSol, broadcastTron, prepareSol, prepareTron, solBalance, solTxSlot, trxBalance, tronTxBlock } from '../lib/xchains';

type Prepared = { lines: string[]; send: () => Promise<string>; watch: (id: string) => Promise<number | null>; explorer: (id: string) => string };

/** Send SOL or TRX. Same safety as the other coins: new addresses wait, the last characters are typed back, and a
 *  freshly restored phone has a lower limit for two days. */
export default function XSend() {
  const { chain: raw } = useLocalSearchParams<{ chain: string }>();
  const chain: 'sol' | 'trx' = raw === 'trx' ? 'trx' : 'sol';
  const isSol = chain === 'sol';
  useChainSettings();
  const nets = activeNets();
  const unit = isSol ? 'SOL' : 'TRX';
  const dec = isSol ? SOL_DECIMALS : TRX_DECIMALS;
  const netLabel = isSol ? SOL_NETS[nets.sol].label : TRON_NETS[nets.trx].label;
  const [to, setTo] = useState('');
  const [amt, setAmt] = useState('');
  const [known, setKnown] = useState<string[]>([]);
  const [own, setOwn] = useState('');
  const [guardOk, setGuardOk] = useState(false);
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'sending' | 'waiting' | 'done' | 'failed' | null>(null);
  const [txid, setTxid] = useState('');
  const gateRef = useRef<{ ok: true; commit: () => Promise<void> } | null>(null);

  useEffect(() => {
    knownDestinations(chain).then(setKnown);
    ensureExtraAddresses().then((a) => setOwn((isSol ? a.sol : a.trx) ?? '')).catch(() => {});
  }, [chain, isSol]);

  const dest = to.trim();
  const valid = isSol ? solAddressOk(dest) : tronAddressOk(dest);
  const mine = !!own && dest === own;

  const review = async () => {
    setErr('');
    setBusy(true);
    try {
      const value = isSol ? parseSol(amt) : parseTrx(amt);
      if (!(await confirmIt('Prepare this payment'))) return;
      const bal = isSol ? await solBalance(nets.sol, own) : await trxBalance(nets.trx, own);
      const gate = newDeviceGate(`${chain}:${isSol ? nets.sol : nets.trx}:native`, bal, value, (v) => `${formatUnits(v, dec, 6)} ${unit}`);
      if (!gate.ok) return setErr(gate.message);
      gateRef.current = gate;
      if (isSol) {
        const p = await prepareSol(dest, value);
        setPrep({
          lines: [`Send ${amt} SOL`, `To ${dest}`, `On ${SOL_NETS[p.net].label}`, `Network fee: 0.000005 SOL`, `From ${p.from}`],
          send: () => broadcastSol(p.net, p.b64),
          watch: (id) => solTxSlot(p.net, id),
          explorer: (id) => SOL_NETS[p.net].explorer('tx', id),
        });
      } else {
        const p = await prepareTron(dest, value);
        setPrep({
          lines: [`Send ${amt} TRX`, `To ${dest}`, `On ${TRON_NETS[p.net].label}`, p.newAccount ? 'This address is new on Tron: 1 TRX more is burned to create it.' : 'Network fee: free bandwidth, or up to about 0.3 TRX', `From ${p.from}`],
          send: () => broadcastTron(p.net, p.hex),
          watch: (id) => tronTxBlock(p.net, id),
          explorer: (id) => `${TRON_NETS[p.net].explorer}/transaction/${id}`,
        });
      }
    } catch (e) {
      failure();
      setErr(plainError(e, netLabel));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!prep) return false;
    setState('sending');
    try {
      const id = await prep.send();
      setTxid(id);
      await rememberDestination(chain, dest);
      await gateRef.current?.commit();
      success();
      flyCoin('out', 'eth');
      setState('waiting');
      let n = 0;
      const t = setInterval(async () => {
        if (++n > 60) return clearInterval(t);
        try {
          if ((await prep.watch(id)) != null) {
            clearInterval(t);
            setState('done');
            success();
          }
        } catch (e) {
          clearInterval(t);
          setErr(plainError(e, netLabel));
          setState('failed');
        }
      }, 4000);
      return true;
    } catch (e) {
      failure();
      setErr(plainError(e, netLabel));
      setState('failed');
      return false;
    }
  };

  if (state)
    return (
      <Screen title="" large>
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 40 }}>
          <T v="display">{`${amt} ${unit}`}</T>
          <T v="sub" dim>{`to ${dest.slice(0, 6)}…${dest.slice(-4)}`}</T>
          <T v="headline" style={{ paddingTop: 20 }}>{state === 'sending' ? 'Sending…' : state === 'waiting' ? 'Waiting for the network…' : state === 'done' ? 'Done' : 'It did not go through'}</T>
          <T v="sub" dim style={{ textAlign: 'center' }}>{state === 'done' ? 'Confirmed.' : state === 'failed' ? err || 'Nothing left your wallet.' : isSol ? 'Usually a few seconds.' : 'Usually under a minute.'}</T>
        </View>
        {txid && prep ? <Button title="Open in explorer" kind="line" onPress={() => Linking.openURL(prep.explorer(txid)).catch(() => {})} /> : null}
        {state !== 'sending' ? <Button title="Done" onPress={() => router.back()} /> : null}
      </Screen>
    );

  return (
    <Screen title={`Send ${unit}`} large>
      {!prep ? (
        <>
          <Button
            title="Paste address"
            kind="line"
            onPress={async () => {
              setTo((await Clipboard.getStringAsync()).trim());
              setPrep(null);
            }}
          />
          <Field value={to} onChangeText={(t) => { setTo(t); setPrep(null); }} placeholder={isSol ? 'Solana address' : 'Tron address (T…)'} autoCapitalize="none" autoCorrect={false} mono />
          <ErrorText>{dest && !valid ? `That is not a ${isSol ? 'Solana' : 'Tron'} address.` : mine ? 'That is your own address.' : ''}</ErrorText>
          {dest && valid && !mine ? <DestGuard dest={dest} known={[...known, ...(own ? [own] : [])]} onOk={setGuardOk} /> : null}
          <Field value={amt} onChangeText={(t) => { setAmt(t); setPrep(null); }} placeholder={`Amount in ${unit}`} keyboardType="decimal-pad" />
          <T v="caption" dim>{`On ${netLabel}.`}</T>
          <ErrorText>{err}</ErrorText>
          <Button title="Review" busy={busy} disabled={!valid || mine || !amt || !guardOk || !own} onPress={review} />
        </>
      ) : (
        <>
          <View style={{ borderRadius: 20, backgroundColor: C.fill, padding: 16, gap: 8 }}>
            {prep.lines.map((l, i) => (
              <T key={i} v={i === 0 ? 'callout' : 'sub'} dim={i > 0} style={{ lineHeight: 20 }}>{l}</T>
            ))}
          </View>
          <ErrorText>{err}</ErrorText>
          <ApproveButton reason="Send this payment" onApproved={send} />
          <Button title="Change" kind="plain" onPress={() => setPrep(null)} />
          <Note>Payments on Solana and Tron cannot be undone.</Note>
        </>
      )}
    </Screen>
  );
}
