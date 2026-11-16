import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Icon, type IconName } from './Icon';
import { Press } from './controls';
import { T } from './Text';
import { C, F } from './theme';
import { DUR, EASE_OUT } from './motion';

export type ActionItem = { icon: IconName; label: string; onPress: () => void };

/** Four round buttons under the main card: the things people do most, one tap away. */
export function ActionRow({ items }: { items: ActionItem[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 22 }}>
      {items.map((a, i) => (
        <Animated.View key={a.label} entering={FadeInDown.delay(90 + i * 45).duration(DUR.slow).easing(EASE_OUT)}>
          <Press onPress={a.onPress} accessibilityLabel={a.label} scaleTo={0.92} style={{ alignItems: 'center', gap: 9, width: 72 }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={a.icon} size={23} color={C.text} width={1.8} />
            </View>
            <T style={{ fontFamily: F.medium, fontSize: 12.5, color: C.soft }}>{a.label}</T>
          </Press>
        </Animated.View>
      ))}
    </View>
  );
}
