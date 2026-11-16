import { View } from 'react-native';
import { router } from 'expo-router';
import { T } from '../../ui/Text';
import { Screen } from '../../ui/controls';
import { Label, Panel, GRow, Primary, Secondary } from '../../ui/Glass';
import { Logo } from '../../ui/Logo';
import { useGifts } from '../../lib/gifts';

const NAMES = { lyx: 'LOKYX', btc: 'Bitcoin', eth: 'Ethereum' } as const;

/** Gift cards you made, and the way in to make or claim one. */
export default function Gifts() {
  const list = useGifts();
  const open = list.filter((g) => !g.closed);
  const old = list.filter((g) => g.closed);
  return (
    <Screen title="Gift cards" large>
      <T v="sub" dim style={{ lineHeight: 20 }}>Put LYX, Bitcoin or Ethereum on a card and send it as a link or QR. Whoever has it can move the coins into their own wallet. Until they do, you can take them back.</T>
      <Primary title="Make a gift card" onPress={() => router.push('/gift/new')} />
      <Secondary title="Claim a gift card" onPress={() => router.push('/gift/claim')} />
      {open.length > 0 && (
        <View>
          <Label>Cards you made</Label>
          <Panel>
            {open.map((g) => (
              <GRow key={g.address} title={g.note || `${NAMES[g.coin]} gift`} sub={`${g.amount} · ${new Date(g.made).toLocaleDateString()}`} right={g.coin === 'lyx' ? undefined : <Logo id={g.coin} size={26} />} onPress={() => router.push(`/gift/${g.address}`)} />
            ))}
          </Panel>
        </View>
      )}
      {old.length > 0 && (
        <View>
          <Label>Claimed or taken back</Label>
          <Panel>
            {old.map((g) => (
              <GRow key={g.address} title={g.note || `${NAMES[g.coin]} gift`} sub={g.amount} onPress={() => router.push(`/gift/${g.address}`)} />
            ))}
          </Panel>
        </View>
      )}
    </Screen>
  );
}
