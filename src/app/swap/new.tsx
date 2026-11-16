import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { T } from '../../ui/Text';
import { Button, ErrorText, Field, Group, Note, Row, Screen } from '../../ui/controls';
import { Segmented } from '../../ui/Segmented';
import { Icon } from '../../ui/Icon';
import { C } from '../../ui/theme';
import { confirmIt } from '../../lib/auth';
import { parseLyx } from '../../lib/lokyx';
import { parseBtc, parseUnits } from '../../lib/multichain-core';
import { makeOffer, swapId, sw, useSwapSettings } from '../../lib/swaps';

/** A new offer: what you give, what you get, and how long the refund waits if someone stops halfway. */
export default function NewSwap() {
  const cfg = useSwapSettings();
  const [dir, setDir] = useState<sw.Direction>('sell-lyx');
  const [asset, setAsset] = useState<sw.Asset>('btc');
  const [lyx, setLyx] = useState('');
  const [other, setOther] = useState('');
  const [speed, setSpeed] = useState<sw.Speed>('fast');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sym = asset === 'btc' ? 'BTC' : 'ETH';
  const h = sw.LOCK_HOURS[speed];

  const make = async () => {
    setErr('');
    try {
      const l = parseLyx(lyx);
      const o = asset === 'btc' ? parseBtc(other) : parseUnits(other, 18);
      if (l <= 0n) throw new Error('Enter how much LYX');
      if (o <= 0n) throw new Error(`Enter how much ${sym}`);
      if (!(await confirmIt('Make a swap offer'))) return;
      setBusy(true);
      const r = await makeOffer({ dir, asset, lyx: l, other: o, speed });
      router.replace(`/swap/${encodeURIComponent(swapId(r))}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen title="New offer" large>
      <Segmented<sw.Direction> value={dir} onChange={setDir} options={[['sell-lyx', 'Sell LYX'], ['buy-lyx', 'Buy LYX']]} />
      <Segmented<sw.Asset> value={asset} onChange={setAsset} options={[['btc', 'Bitcoin'], ['eth', 'Ethereum']]} />
      <View style={{ gap: 10 }}>
        <T v="sub" dim>{dir === 'sell-lyx' ? 'You give' : 'You get'}</T>
        <Field value={lyx} onChangeText={setLyx} placeholder="0 LYX" keyboardType="decimal-pad" big />
        <View style={{ alignItems: 'center' }}>
          <Icon name="swap" size={20} color={C.sub} width={2} />
        </View>
        <T v="sub" dim>{dir === 'sell-lyx' ? 'You get' : 'You give'}</T>
        <Field value={other} onChangeText={setOther} placeholder={`0 ${sym}`} keyboardType="decimal-pad" big />
        <T v="caption" dim>You and the other person agree the price between you.</T>
      </View>
      <Group title="If someone stops halfway">
        <Row title="Fast" sub={`Refunds after ${h.first === 12 ? 12 : sw.LOCK_HOURS.fast.first} h and ${sw.LOCK_HOURS.fast.second} h. Stay around for a couple of hours.`} right={speed === 'fast' ? <Icon name="check" size={18} color={C.blue} width={2.4} /> : <View />} onPress={() => setSpeed('fast')} />
        <Row title="Standard" sub={`Refunds after ${sw.LOCK_HOURS.standard.first} h and ${sw.LOCK_HOURS.standard.second} h.`} right={speed === 'standard' ? <Icon name="check" size={18} color={C.blue} width={2.4} /> : <View />} onPress={() => setSpeed('standard')} />
      </Group>
      {asset === 'btc' ? <Note>{`Bitcoin ${cfg.btcNet}. The website swaps on testnet4.`}</Note> : !cfg.ethContract ? <Note>Ethereum swaps need the swap contract on Sepolia. Set it up once in Swap settings.</Note> : null}
      <ErrorText>{err}</ErrorText>
      <Button title="Make the offer code" busy={busy} onPress={make} />
    </Screen>
  );
}
