import { useState } from 'react';
import { Share, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { formatEther } from 'viem';
import { T } from '../../../ui/Text';
import { Field, Screen, success, ErrorText } from '../../../ui/controls';
import { Label, Panel, GRow, Primary, Secondary } from '../../../ui/Glass';
import { WalletCard } from '../../../ui/WalletCards';
import { Qr } from '../../../ui/Qr';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';
import { C } from '../../../ui/theme';
import { confirmIt } from '../../../lib/auth';
import { ensureAddresses, useAsync } from '../../../lib/multichain';
import { decodePay, encodePay, validSigners, type Pay } from '../../../lib/ethms-core';
import { readEthShared, removeEthShared, sendEthPay, signEthPay, startEthPay, useEthShared } from '../../../lib/ethms';

/** A shared Ethereum account: balance, receiving, and passing a payment around until enough of you signed. */
export default function EthSharedScreen() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const s = useEthShared().find((x) => x.address.toLowerCase() === String(address).toLowerCase());
  const { width } = useWindowDimensions();
  const info = useAsync(async () => (s ? readEthShared(s) : null), [address], 20_000);
  const me = useAsync(async () => (await ensureAddresses()).eth, []);
  const [sheet, setSheet] = useState<'' | 'pay' | 'code' | 'recv'>('');
  const [to, setTo] = useState('');
  const [amt, setAmt] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  let pay: Pay | null = null;
  let err = '';
  try {
    pay = code.trim() ? decodePay(code) : null;
  } catch (e) {
    err = (e as Error).message;
  }
  const signers = useAsync(async () => (pay && s ? validSigners(pay, s.owners) : []), [code]);
  if (!s) return <Screen title="Shared Ethereum"><T v="sub" dim>That account isn't on this phone.</T></Screen>;
  const n = signers.data?.length ?? 0;
  const iSigned = !!signers.data?.some((a) => a.toLowerCase() === me.data?.toLowerCase());
  const ready = n >= s.threshold;

  const run = async (reason: string, f: () => Promise<void>) => {
    if (!(await confirmIt(reason))) return;
    setBusy(true);
    try {
      await f();
    } catch (e) {
      toast((e as Error).message, 'info');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={s.name}>
      <WalletCard c={{ kind: 'gr', logo: 'eth', title: `Shared · ${s.threshold} of ${s.owners.length}`, sub: s.name, balance: info.data ? formatEther(info.data.balance) : '', unit: 'ETH', address: s.address, tag: info.data && !info.data.exists ? 'Not created yet' : 'Test network' }} width={Math.min(width - 40, 420)} height={176} />
      <Primary title="Start a payment" onPress={() => setSheet('pay')} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Secondary title="I have a payment code" onPress={() => setSheet('code')} /></View>
        <View style={{ flex: 1 }}><Secondary title="Receive" onPress={() => setSheet('recv')} /></View>
      </View>
      <Secondary title="Send the setup to the others" onPress={() => Share.share({ message: `Add our shared Ethereum account in LOKYX (Apps › Shared accounts › Ethereum › I've been added). People:\n${s.owners.join('\n')}\nApprovals needed: ${s.threshold}\nAddress: ${s.address}` })} />
      <Label>{`People · any ${s.threshold} of ${s.owners.length}`}</Label>
      <Panel>{s.owners.map((o) => <GRow key={o} icon="person" title={o.toLowerCase() === me.data?.toLowerCase() ? 'You' : `${o.slice(0, 8)}…${o.slice(-6)}`} />)}</Panel>
      <Secondary title="Remove from this phone" onPress={async () => { await removeEthShared(s.address); router.back(); }} />

      <Sheet open={sheet === 'recv'} onClose={() => setSheet('')}>
        <View style={{ gap: 14, alignItems: 'center' }}>
          <T v="headline">Receive into the shared account</T>
          <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 20 }}><Qr value={s.address} size={220} /></View>
          <T v="mono" selectable style={{ fontSize: 13, textAlign: 'center' }}>{s.address}</T>
          <Secondary title="Copy address" onPress={async () => { await Clipboard.setStringAsync(s.address); success(); }} />
        </View>
      </Sheet>
      <Sheet open={sheet === 'pay'} onClose={() => setSheet('')}>
        <View style={{ gap: 12 }}>
          <T v="headline">Start a payment</T>
          <Field value={to} onChangeText={setTo} placeholder="To: 0x…" autoCapitalize="none" autoCorrect={false} mono />
          <Field value={amt} onChangeText={setAmt} placeholder="Amount in ETH" keyboardType="decimal-pad" />
          <Primary title="Sign and share" busy={busy} disabled={!to.trim() || !amt} onPress={() => run(`Sign a payment of ${amt} ETH`, async () => {
            const p = await startEthPay(s, to, amt);
            const c = encodePay(p);
            setCode(c);
            setSheet('code');
            await Share.share({ message: `Please approve this payment from "${s.name}" in LOKYX (Shared accounts › ${s.name} › I have a payment code):\n\n${c}` });
          })} />
        </View>
      </Sheet>
      <Sheet open={sheet === 'code'} onClose={() => setSheet('')}>
        <View style={{ gap: 12 }}>
          <T v="headline">A payment to approve</T>
          <Field value={code} onChangeText={setCode} placeholder="lokyx-eth-safe:…" autoCapitalize="none" autoCorrect={false} mono multiline />
          {!code ? <Secondary title="Paste" onPress={async () => setCode((await Clipboard.getStringAsync()).trim())} /> : null}
          <ErrorText>{err}</ErrorText>
          {pay ? (
            <Panel style={{ paddingVertical: 10 }}>
              <GRow title={`Pays ${formatEther(BigInt(pay.value))} ETH`} sub={`to ${pay.to}`} />
              <GRow title={`${n} of ${s.threshold} signatures`} sub={iSigned ? 'Yours is on it' : 'You have not signed'} />
            </Panel>
          ) : null}
          {pay && ready ? <Primary title="Send it (you pay the network fee)" busy={busy} onPress={() => run('Send this payment', async () => { await sendEthPay(s, pay!); success(); toast('Sent to Ethereum', 'send'); setCode(''); setSheet(''); info.refresh(); })} /> : null}
          {pay && !ready && !iSigned ? <Primary title="Sign it" busy={busy} onPress={() => run('Sign this payment', async () => { const next = encodePay(await signEthPay(s, pay!)); setCode(next); success(); })} /> : null}
          {pay && !ready && iSigned ? <Secondary title="Share it with the next person" onPress={() => Share.share({ message: code })} /> : null}
        </View>
      </Sheet>
    </Screen>
  );
}
