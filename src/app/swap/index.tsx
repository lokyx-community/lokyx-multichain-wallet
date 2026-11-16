import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { T } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { Group, Note, Press, Row, Screen } from '../../ui/controls';
import { CoinLogo } from '../../ui/CoinLogo';
import { C, F } from '../../ui/theme';
import { DUR, EASE_OUT } from '../../ui/motion';
import { loadSwaps, loadSwapSettings, swapId, swapTitle, sw, useSwaps } from '../../lib/swaps';

/** Swaps: trade LYX for BTC or ETH directly with another person. No exchange, nobody holds the coins. */
export default function Swaps() {
  const list = useSwaps();
  useEffect(() => {
    void loadSwaps();
    void loadSwapSettings();
  }, []);
  return (
    <Screen title="Swap" large right={<Press onPress={() => router.push('/swap/settings')} hitSlop={10}><Icon name="more" size={22} color={C.text} /></Press>}>
      <Note>Trade directly with another person. Each side locks its coins behind the same secret: either both trades go through, or both get their coins back. Works with the LOKYX website too.</Note>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Press onPress={() => router.push('/swap/new')} scaleTo={0.97} style={{ flex: 1, height: 112, borderRadius: 22, backgroundColor: C.ink, padding: 16, justifyContent: 'space-between' }}>
          <Icon name="plus" size={22} color={C.inkText} width={2.2} />
          <T style={{ fontFamily: F.semibold, fontSize: 16, color: C.inkText }}>Make an offer</T>
        </Press>
        <Press onPress={() => router.push('/swap/take')} scaleTo={0.97} style={{ flex: 1, height: 112, borderRadius: 22, backgroundColor: C.fill2, padding: 16, justifyContent: 'space-between' }}>
          <Icon name="copy" size={22} color={C.text} width={2} />
          <T style={{ fontFamily: F.semibold, fontSize: 16 }}>I have a code</T>
        </Press>
      </View>
      <Press onPress={() => router.push('/swap/board')} scaleTo={0.98} style={{ height: 64, borderRadius: 22, backgroundColor: C.fill2, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Icon name="people" size={22} color={C.text} width={1.9} />
        <View style={{ flex: 1 }}>
          <T style={{ fontFamily: F.semibold, fontSize: 16 }}>Offer board</T>
          <T v="caption" dim>Find someone to swap with</T>
        </View>
        <Icon name="chevron" size={14} color={C.faint} width={2.2} />
      </Press>
      {list.length > 0 && (
        <Group title="Your swaps">
          {list.map((r, i) => (
            <Animated.View key={swapId(r)} entering={FadeInDown.delay(i * 40).duration(DUR.base).easing(EASE_OUT)}>
              <Row title={swapTitle(r)} sub={r.accept ? (r.role === 'initiator' ? 'You made this offer' : 'You accepted') : 'Waiting for the other person'} right={<CoinLogo chain={sw.assetOf(r.offer)} size={26} />} onPress={() => router.push(`/swap/${encodeURIComponent(swapId(r))}`)} />
            </Animated.View>
          ))}
        </Group>
      )}
      <T v="caption" dim style={{ textAlign: 'center' }}>Test networks only: Bitcoin testnet4 or signet, and Sepolia.</T>
    </Screen>
  );
}
