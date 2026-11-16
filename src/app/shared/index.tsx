import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { T } from '../../ui/Text';
import { Field, Screen, ErrorText } from '../../ui/controls';
import { Label, Panel, GRow, Primary, Secondary } from '../../ui/Glass';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { C } from '../../ui/theme';
import { useShared } from '../../lib/data';
import { addShared, resolveShared } from '../../lib/shared';
import { isAddress } from '../../lib/lokyx';
import { shortAddr } from '../../lib/format';
import { useBtcShared } from '../../lib/btcms';
import { useEthShared } from '../../lib/ethms';
import { useContractsOn } from '../../lib/chain';
import { Logo } from '../../ui/Logo';

/** Shared LYX accounts you are an owner of. */
export default function SharedList() {
  const list = useShared();
  const btcList = useBtcShared();
  const ethList = useEthShared();
  const contractsOn = useContractsOn();
  const [adding, setAdding] = useState(false);
  const [addr, setAddr] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    resolveShared();
    const t = setInterval(resolveShared, 6000);
    return () => clearInterval(t);
  }, []);
  const add = async () => {
    setBusy(true);
    try {
      await addShared(name, addr.trim().toLowerCase());
      setAdding(false);
      setAddr('');
      setName('');
    } catch (e) {
      toast((e as Error).message, 'info');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Shared accounts" large>
      <T v="sub" dim style={{ lineHeight: 20 }}>Money in a shared account moves only when enough of its owners approve. Each person keeps their own key on their own phone.</T>
      {contractsOn && <Primary title="Make a shared LYX account" onPress={() => router.push('/shared/new')} />}
      <Secondary title="Make or add a shared Bitcoin account" onPress={() => router.push('/shared/btc/new')} />
      <Secondary title="Make or add a shared Ethereum account" onPress={() => router.push('/shared/eth/new')} />
      {ethList.length > 0 && (
        <View>
          <Label>Ethereum</Label>
          <Panel>
            {ethList.map((s) => (
              <GRow key={s.address} title={s.name} sub={`${s.threshold} of ${s.owners.length} · ${shortAddr(s.address)}`} right={<Logo id="eth" size={26} />} onPress={() => router.push(`/shared/eth/${s.address}`)} />
            ))}
          </Panel>
        </View>
      )}
      {contractsOn && <Secondary title="Add a LYX one you're part of" onPress={() => setAdding(true)} />}
      {btcList.length > 0 && (
        <View>
          <Label>Bitcoin</Label>
          <Panel>
            {btcList.map((s) => (
              <GRow key={s.address} title={s.name} sub={`${s.m} of ${s.keys.length} · ${shortAddr(s.address)}`} right={<Logo id="btc" size={26} />} onPress={() => router.push(`/shared/btc/${s.address}`)} />
            ))}
          </Panel>
        </View>
      )}
      {list.length > 0 && (
        <View>
          <Label>LOKYX</Label>
          <Panel>
            {list.map((s) => (
              <GRow key={s.tx ?? s.address} icon="people" title={s.name} sub={s.address ? shortAddr(s.address) : 'Being made… (about a minute)'} onPress={s.address ? () => router.push(`/shared/${s.address}`) : undefined} />
            ))}
          </Panel>
        </View>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)}>
        <View style={{ gap: 14 }}>
          <T v="headline">Add a shared account</T>
          <T v="sub" dim>Ask whoever made it for its address. You must be one of its owners.</T>
          <Field value={addr} onChangeText={setAddr} placeholder="lyx1…" autoCapitalize="none" autoCorrect={false} mono />
          <Field value={name} onChangeText={setName} placeholder="A name for it, like Family fund" maxLength={30} />
          <ErrorText>{addr.length > 8 && !isAddress(addr.trim().toLowerCase()) ? "That isn't a LOKYX address." : ''}</ErrorText>
          <Primary title="Add it" busy={busy} disabled={!isAddress(addr.trim().toLowerCase())} onPress={add} />
        </View>
      </Sheet>
    </Screen>
  );
}
