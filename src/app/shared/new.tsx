import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { T } from '../../ui/Text';
import { Field, Press, Screen } from '../../ui/controls';
import { Label, Panel, GRow, Primary } from '../../ui/Glass';
import { Icon } from '../../ui/Icon';
import { toast } from '../../ui/Toast';
import { C, F } from '../../ui/theme';
import { confirmIt } from '../../lib/auth';
import { useContacts } from '../../lib/data';
import { currentAddress } from '../../lib/wallet';
import { isAddress } from '../../lib/lokyx';
import { labelFor, shortAddr } from '../../lib/format';
import { makeShared } from '../../lib/shared';

/** Name it, add the people, pick how many must approve. You are always one of the owners. */
export default function NewShared() {
  const me = currentAddress();
  const people = useContacts();
  const [name, setName] = useState('');
  const [owners, setOwners] = useState<string[]>([me]);
  const [typed, setTyped] = useState('');
  const [need, setNeed] = useState(2);
  const [start, setStart] = useState('');
  const [busy, setBusy] = useState(false);
  const add = (a: string) => {
    const x = a.trim().toLowerCase();
    if (!isAddress(x)) return toast("That isn't a LOKYX address", 'info');
    if (owners.includes(x)) return toast('Already on the list', 'info');
    if (owners.length >= 10) return toast('Up to 10 people', 'info');
    setOwners((o) => [...o, x]);
    setTyped('');
  };
  const n = owners.length;
  const t = Math.min(Math.max(1, need), n);
  const create = async () => {
    if (!(await confirmIt('Make the shared account'))) return;
    setBusy(true);
    try {
      await makeShared(name, owners, t, start);
      toast('Being made. It shows up in about a minute.', 'info');
      router.replace('/shared');
    } catch (e) {
      toast((e as Error).message, 'info');
      setBusy(false);
    }
  };
  const lost = t === n ? 'If any one person loses their phone and words, the money is stuck. Pick fewer approvals than people.' : `If ${n - t === 1 ? 'one person loses' : `up to ${n - t} people lose`} their phone and words, the rest can still spend. ${t === 1 ? 'Any one person alone can spend, too.' : `Fewer than ${t} together can't.`}`;
  return (
    <Screen title="New shared account" large>
      <Field value={name} onChangeText={setName} placeholder="Name, like Family fund" maxLength={30} />
      <Label>People</Label>
      <Panel>
        {owners.map((a) => (
          <GRow key={a} icon="person" title={a === me ? 'You' : labelFor(a)} sub={shortAddr(a)} right={a === me ? undefined : <Press onPress={() => setOwners((o) => o.filter((x) => x !== a))} hitSlop={10}><Icon name="close" size={16} color={C.sub} /></Press>} />
        ))}
      </Panel>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field value={typed} onChangeText={setTyped} placeholder="Their lyx1… address" autoCapitalize="none" autoCorrect={false} mono />
        </View>
        <Press onPress={async () => (typed ? add(typed) : setTyped((await Clipboard.getStringAsync()).trim()))} style={{ height: 52, paddingHorizontal: 16, borderRadius: 16, backgroundColor: C.ink, justifyContent: 'center' }}>
          <T style={{ fontFamily: F.semibold, fontSize: 15, color: C.inkText }}>{typed ? 'Add' : 'Paste'}</T>
        </Press>
      </View>
      {people.filter((p) => !owners.includes(p.address)).length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {people.filter((p) => !owners.includes(p.address)).slice(0, 8).map((p) => (
            <Press key={p.address} onPress={() => add(p.address)} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', justifyContent: 'center' }}>
              <T v="sub">{`+ ${p.name}`}</T>
            </Press>
          ))}
        </View>
      )}
      <Label>Approvals needed</Label>
      <Panel style={{ paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Press onPress={() => setNeed(Math.max(1, t - 1))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontSize: 22 }}>−</T>
          </Press>
          <T style={{ flex: 1, textAlign: 'center', fontFamily: F.regular, fontSize: 30 }}>{`${t} `}<T v="sub" dim>{`of ${n}`}</T></T>
          <Press onPress={() => setNeed(Math.min(n, t + 1))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontSize: 22 }}>+</T>
          </Press>
        </View>
      </Panel>
      <T v="caption" dim style={{ lineHeight: 18 }}>{lost} The people and the number can't be changed later; you'd make a new account.</T>
      <Field value={start} onChangeText={setStart} placeholder="LYX to put in now (optional)" keyboardType="decimal-pad" />
      <Primary title="Make it" busy={busy} disabled={n < 2} onPress={create} />
      {n < 2 ? <T v="caption" dim style={{ textAlign: 'center' }}>Add at least one more person.</T> : null}
    </Screen>
  );
}
