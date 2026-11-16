import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Press } from './controls';
import type { FeedItem } from '../lib/feed-core';
import { T } from './Text';
import { Icon, type IconName } from './Icon';
import { C } from './theme';
import type { HistoryItem } from '../lib/rpc';
import { maturity } from '../lib/chain';
import type { Pending } from '../lib/data';
import { labelFor, niceLyx, timeAgo } from '../lib/format';
import { DUR, EASE_OUT } from './motion';

function Badge({ icon, wait }: { icon: IconName; wait?: boolean }) {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.fill2, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={C.text} width={2} />
      {wait && <View style={{ position: 'absolute', right: -1, bottom: -1, width: 14, height: 14, borderRadius: 7, backgroundColor: C.wait, borderWidth: 3, borderColor: C.bg }} />}
    </View>
  );
}

export function ActivityRow({ item, i = 0, hide }: { item: HistoryItem; i?: number; hide?: boolean }) {
  const icon: IconName = item.kind === 'mined' ? 'cube' : item.kind === 'received' ? 'receive' : item.kind === 'self' ? 'refresh' : 'send';
  const title =
    item.kind === 'mined' ? `Mined block ${item.height.toLocaleString('en-US')}` : item.kind === 'received' ? `From ${labelFor(item.from)}` : item.kind === 'self' ? 'To yourself' : `To ${labelFor(item.to)}`;
  const plus = item.kind === 'received' || item.kind === 'mined';
  const amount = hide ? '•••' : `${plus ? '+' : '−'}${niceLyx(item.amountLyx)}`;
  const young = item.kind === 'mined' && item.confirmations < maturity();
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(i, 8) * 30).duration(DUR.base).easing(EASE_OUT)}>
      <Press haptic={false} scaleTo={0.98} onPress={() => (item.txHash ? router.push(`/tx/${item.txHash}`) : router.push(`/block/${item.height}`))} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}>
        <Badge icon={icon} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="callout" numberOfLines={1} style={{ fontSize: 16 }}>{title}</T>
          <T v="caption" dim>{young ? `Unlocks in ${maturity() - item.confirmations} blocks` : timeAgo(item.timestamp)}</T>
        </View>
        <T v="callout" color={plus ? C.text : C.soft} style={{ fontSize: 16, fontVariant: ['tabular-nums'] }}>
          {amount}
        </T>
      </Press>
    </Animated.View>
  );
}

export function PendingRow({ p, hide }: { p: Pending; hide?: boolean }) {
  const title = p.what === 'deploy' ? 'Making a contract' : p.what === 'call' ? `Using ${labelFor(p.to)}` : `To ${labelFor(p.to)}`;
  return (
    <Animated.View entering={FadeInDown.duration(DUR.base).easing(EASE_OUT)}>
      <Press haptic={false} scaleTo={0.98} onPress={() => router.push(`/tx/${p.hash}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}>
        <Badge icon={p.what === 'send' || p.what === 'token' ? 'send' : 'cube'} wait />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="callout" numberOfLines={1} style={{ fontSize: 16 }}>{title}</T>
          <T v="caption" color={C.wait}>Waiting for a block</T>
        </View>
        <T v="callout" color={C.soft} style={{ fontSize: 16 }}>{hide ? '•••' : p.amount ? `−${p.amount}` : ''}</T>
      </Press>
    </Animated.View>
  );
}

/** A payment on another coin: same look as a LOKYX row, opens that coin's explorer. */
export function FeedRow({ item, i = 0, hide }: { item: FeedItem; i?: number; hide?: boolean }) {
  const icon: IconName = item.kind === 'received' ? 'receive' : item.kind === 'self' ? 'refresh' : 'send';
  const plus = item.kind === 'received';
  const who = item.other ? ` ${item.other.slice(0, 5)}…${item.other.slice(-4)}` : '';
  const title = item.failed ? 'Failed payment' : item.kind === 'received' ? `Received${who ? ' from' + who : ''}` : item.kind === 'self' ? 'To yourself' : `Sent${who ? ' to' + who : ''}`;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(i, 8) * 30).duration(DUR.base).easing(EASE_OUT)}>
      <Press haptic={false} scaleTo={0.98} onPress={() => item.url && Linking.openURL(item.url).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}>
        <Badge icon={icon} wait={!item.time} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="callout" numberOfLines={1} style={{ fontSize: 16 }}>{title}</T>
          <T v="caption" dim numberOfLines={1}>{`${item.unit} · ${item.net} · ${item.time ? timeAgo(item.time) : 'Pending'}`}</T>
        </View>
        <T v="callout" color={item.failed ? C.sub : plus ? C.text : C.soft} style={{ fontSize: 16, fontVariant: ['tabular-nums'] }}>
          {hide ? '•••' : `${plus ? '+' : '−'}${item.amount}`}
        </T>
      </Press>
    </Animated.View>
  );
}
