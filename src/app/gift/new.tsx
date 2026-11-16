import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { plainError } from '../../lib/plain-error';
import { T } from '../../ui/Text';
import { Field, Screen, ErrorText } from '../../ui/controls';
import { Segmented } from '../../ui/Segmented';
import { Keypad, typeAmount } from '../../ui/Keypad';
import { Primary } from '../../ui/Glass';
import { C, F } from '../../ui/theme';
import { makeGift } from '../../lib/gifts';
import type { GiftCoin } from '../../lib/gift-core';

const UNIT = { lyx: 'LYX', btc: 'BTC', eth: 'ETH' } as const;

/** Pick a coin and an amount. The card is made here; the coins go on it with an ordinary send, so Face ID and your limits apply. */
export default function NewGift() {
  const [coin, setCoin] = useState<GiftCoin>('lyx');
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true);
    setErr('');
    try {
      const a = amt.replace(/\.$/, '');
      const { gift } = await makeGift(coin, `${a} ${UNIT[coin]}`, note);
      router.replace(`/gift/${gift.address}`);
      router.push(coin === 'lyx' ? `/send?to=${gift.address}&amount=${a}` : `/chain/send?chain=${coin}&to=${gift.address}&amount=${a}`);
    } catch (e) {
      setErr(plainError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="New gift card" large>
      <Segmented<GiftCoin> value={coin} onChange={(c) => (setCoin(c), setAmt(''))} options={[['lyx', 'LOKYX'], ['btc', 'Bitcoin'], ['eth', 'Ethereum']]} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8, height: 70 }}>
        <T style={{ fontFamily: F.regular, fontSize: 52, letterSpacing: -2, color: amt ? C.text : C.faint }}>{amt || '0'}</T>
        <T style={{ fontFamily: F.medium, fontSize: 20, color: C.sub }}>{UNIT[coin]}</T>
      </View>
      <Keypad onKey={(k) => setAmt((a) => typeAmount(a, k, coin === 'btc' ? 8 : 18))} extra="." />
      <Field value={note} onChangeText={setNote} placeholder="A note, like Happy birthday, Maya" maxLength={60} />
      <ErrorText>{err}</ErrorText>
      <Primary title="Make the card and fund it" disabled={!amt || Number(amt) === 0} busy={busy} onPress={go} />
      <T v="caption" dim style={{ textAlign: 'center', lineHeight: 18 }}>The next screen is a normal send to the card. The network fee to claim it comes out of the gift.</T>
    </Screen>
  );
}
