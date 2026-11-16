import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { T } from '../../../ui/Text';
import { Field, Press, Screen } from '../../../ui/controls';
import { Label, Panel, GRow, Primary } from '../../../ui/Glass';
import { Segmented } from '../../../ui/Segmented';
import { Icon } from '../../../ui/Icon';
import { toast } from '../../../ui/Toast';
import { C, F } from '../../../ui/theme';
import { confirmIt } from '../../../lib/auth';
import { ensureAddresses } from '../../../lib/multichain';
import { ethAddressOk } from '../../../lib/multichain-core';
import { sharedAddress } from '../../../lib/ethms-core';
import { addEthShared } from '../../../lib/ethms';

/** A shared Ethereum account (a Safe). One person creates it on chain; the others add the same people and number. */
export default function NewEthShared() {
  const [me, setMe] = useState('');
  const [name, setName] = useState('');
  const [others, setOthers] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [need, setNeed] = useState(2);
  const [mode, setMode] = useState<'make' | 'add'>('make');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    ensureAddresses().then((a) => setMe(a.eth), () => {});
  }, []);
  const owners = me ? [me, ...others] : others;
  const n = owners.length;
  const t = Math.min(Math.max(1, need), Math.max(1, n));
  const add = (x: string) => {
    const a = x.trim();
    if (!ethAddressOk(a)) return toast("That isn't an Ethereum address", 'info');
    if (owners.some((o) => o.toLowerCase() === a.toLowerCase())) return toast('Already on the list', 'info');
    setOthers((o) => [...o, a]);
    setTyped('');
  };
  let preview = '';
  try {
    preview = n >= 2 ? sharedAddress({ owners: owners as `0x${string}`[], threshold: t }) : '';
  } catch {}
  return (
    <Screen title="Shared Ethereum account" large>
      <Segmented value={mode} onChange={setMode} options={[['make', 'Make one'], ['add', "I've been added"]]} />
      <T v="sub" dim style={{ lineHeight: 20 }}>{mode === 'make' ? 'You create it on chain and pay the network fee once. Then send the others its people and number so they can add it.' : 'Enter the same people and number as whoever made it. The address must match theirs.'}</T>
      <Field value={name} onChangeText={setName} placeholder="Name, like Team fund" maxLength={30} />
      <Label>People (their Ethereum addresses)</Label>
      <Panel>
        {me ? <GRow icon="person" title="You" sub={`${me.slice(0, 8)}…${me.slice(-6)}`} /> : null}
        {others.map((a) => <GRow key={a} icon="person" title={`${a.slice(0, 8)}…${a.slice(-6)}`} right={<Press onPress={() => setOthers((o) => o.filter((x) => x !== a))} hitSlop={10}><Icon name="close" size={16} color={C.sub} /></Press>} />)}
      </Panel>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field value={typed} onChangeText={setTyped} placeholder="0x…" autoCapitalize="none" autoCorrect={false} mono /></View>
        <Press onPress={async () => (typed ? add(typed) : add(await Clipboard.getStringAsync()))} style={{ height: 52, paddingHorizontal: 16, borderRadius: 16, backgroundColor: C.ink, justifyContent: 'center' }}>
          <T style={{ fontFamily: F.semibold, fontSize: 15, color: C.inkText }}>{typed ? 'Add' : 'Paste'}</T>
        </Press>
      </View>
      <Label>Approvals needed</Label>
      <Panel style={{ paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Press onPress={() => setNeed(Math.max(1, t - 1))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 22 }}>−</T></Press>
          <T style={{ flex: 1, textAlign: 'center', fontFamily: F.regular, fontSize: 30 }}>{`${t} `}<T v="sub" dim>{`of ${n}`}</T></T>
          <Press onPress={() => setNeed(Math.min(n, t + 1))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 22 }}>+</T></Press>
        </View>
      </Panel>
      {preview ? <Panel style={{ paddingVertical: 12 }}><T v="caption" dim>Its address</T><T v="mono" selectable style={{ fontSize: 13, paddingTop: 4 }}>{preview}</T></Panel> : null}
      <Primary
        title={mode === 'make' ? 'Create it' : 'Add it'}
        busy={busy}
        disabled={!me || n < 2}
        onPress={async () => {
          if (mode === 'make' && !(await confirmIt('Create the shared account (network fee)'))) return;
          setBusy(true);
          try {
            const s = await addEthShared(name, owners, t, mode === 'make');
            router.replace(`/shared/eth/${s.address}`);
          } catch (e) {
            toast((e as Error).message, 'info');
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
