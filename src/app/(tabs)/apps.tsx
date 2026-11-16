import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { T } from '../../ui/Text';
import { Field, Press } from '../../ui/controls';
import { Icon, type IconName } from '../../ui/Icon';
import { C, F } from '../../ui/theme';
import { siteUrl } from '../../lib/rpc';
import { sites, useSites } from '../../lib/data';
import { currentAddress } from '../../lib/wallet';
import { toUrl } from '../../lib/provider';
import { OrbitScene } from '../../ui/Orbit';
import { Aurora } from '../../ui/Aurora';
import { useBookmarks } from '../../lib/bookmarks';
import { useCapsules } from '../../lib/capsules';
import { useContractsOn } from '../../lib/chain';
import { DUR, EASE_OUT } from '../../ui/motion';

const open = (u: string) => router.push(`/browser?url=${encodeURIComponent(u)}`);

const TILE_H = 136;

function Tile({ icon, name, line, onPress, i }: { icon: IconName; name: string; line: string; onPress: () => void; i: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(i, 8) * 45).duration(DUR.base).easing(EASE_OUT)} style={{ flex: 1, height: TILE_H }}>
      <Press onPress={onPress} scaleTo={0.97} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.055)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 24, padding: 16, justifyContent: 'space-between' }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={20} color={C.text} width={1.9} />
        </View>
        <View style={{ gap: 3 }}>
          <T style={{ fontFamily: F.semibold, fontSize: 15.5, letterSpacing: -0.2 }} numberOfLines={1}>{name}</T>
          <T v="caption" dim numberOfLines={2} style={{ lineHeight: 17, minHeight: 34 }}>{line}</T>
        </View>
      </Press>
    </Animated.View>
  );
}

/** Tiles two to a row, all the same size. An odd one out gets an empty space beside it, not a stretched tile. */
function Grid({ tiles }: { tiles: (React.ReactElement | false)[] }) {
  const list = tiles.filter(Boolean) as React.ReactElement[];
  const rows: React.ReactElement[][] = [];
  for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));
  return (
    <View style={{ gap: 12 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          {r}
          {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

export default function Apps() {
  const insets = useSafeAreaInsets();
  const { width: sw } = useWindowDimensions();
  const [text, setText] = useState('');
  const me = currentAddress();
  const connected = useSites().filter((s) => s.address === me);
  const site = siteUrl();
  const capsules = useCapsules().filter((c) => !c.opened);
  const contractsOn = useContractsOn();
  const marks = useBookmarks();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
    <Aurora width={sw} height={340} strength={0.6} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: insets.bottom + 130, gap: 26 }} keyboardShouldPersistTaps="handled">
      <View style={{ gap: 16 }}>
        <T v="display">Apps</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.14)', paddingLeft: 16 }}>
          <Icon name="search" size={18} color={C.sub} width={2} />
          <Field
            value={text}
            onChangeText={setText}
            placeholder="Search or type a website"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="web-search"
            returnKeyType="go"
            onSubmitEditing={() => text.trim() && open(toUrl(text))}
            style={{ flex: 1, backgroundColor: 'transparent', height: 50 }}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {marks.map((b) => (
            <Press key={b.url} onPress={() => open(b.url)} scaleTo={0.95} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name={b.fixed ? 'globe' : 'star'} size={14} color={C.sub} width={2} />
              <T v="sub">{b.title}</T>
            </Press>
          ))}
        </View>
      </View>

      {contractsOn && (
      <Animated.View entering={FadeInDown.duration(DUR.base).easing(EASE_OUT)}>
        <Press onPress={() => router.push('/capsule')} scaleTo={0.98} style={{ borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          <View style={{ alignItems: 'center', marginTop: -18, marginBottom: -26 }}>
            <OrbitScene size={340} riders={capsules.length ? capsules.slice(0, 3).map((_, i) => 0.15 + i * 0.3) : [0.2]} planet={0.26} />
          </View>
          <View style={{ padding: 18, paddingTop: 0, gap: 3 }}>
            <T style={{ fontFamily: F.semibold, fontSize: 19, letterSpacing: -0.3 }}>Time capsule · Neptune</T>
            <T v="sub" dim>Seal LYX and a note until a day you choose</T>
          </View>
        </Press>
      </Animated.View>
      )}

      <View style={{ gap: 12 }}>
        <T v="sub" dim>Made for LOKYX</T>
        <Grid
          tiles={[
            contractsOn && <Tile key="tok" i={0} icon="plus" name="Make a token" line="Your own coin, in a minute" onPress={() => router.push('/make-token')} />,
            contractsOn && <Tile key="jar" i={1} icon="jar" name="Savings jar" line="Lock LYX away until a date" onPress={() => router.push('/jar')} />,
            <Tile key="sh" i={2} icon="people" name="Shared accounts" line="Pay when enough of you agree" onPress={() => router.push('/shared')} />,
            contractsOn && <Tile key="bd" i={3} icon="swap" name="Offer board" line="Find someone to swap with" onPress={() => router.push('/swap/board')} />,
            <Tile key="sw" i={4} icon="swap" name="Swap" line="LYX for BTC or ETH, person to person" onPress={() => router.push('/swap')} />,
            <Tile key="gf" i={5} icon="coin" name="Gift cards" line="Send coins as a link" onPress={() => router.push('/gift')} />,
            <Tile key="et" i={6} icon="plus" name="Ethereum token" line="Your own ERC-20 coin" onPress={() => router.push('/chain/make-token')} />,
            <Tile key="vl" i={7} icon="lock" name="Vault" line="A daily limit, a delay on big sends" onPress={() => router.push('/vault')} />,
            <Tile key="ev" i={8} icon="lock" name="Ethereum vault" line="Same protection for ETH" onPress={() => router.push('/ethvault')} />,
            <Tile key="mn" i={9} icon="chip" name="Mining" line="Earn LYX with your computer" onPress={() => router.push('/mining')} />,
            <Tile key="ex" i={10} icon="cube" name="Explorer" line="Every block and payment" onPress={() => open(`${site}/#/explorer`)} />,
          ]}
        />
      </View>

      {contractsOn && (
      <Animated.View layout={LinearTransition.duration(DUR.base).easing(EASE_OUT)} style={{ gap: 4 }}>
        <T v="sub" dim style={{ paddingBottom: 4 }}>Connected</T>
        {connected.length === 0 ? (
          <T v="sub" color={C.faint}>Sites you connect to show up here. You can cut them off any time.</T>
        ) : (
          connected.map((s) => (
            <Animated.View key={s.origin} exiting={FadeOut} layout={LinearTransition.duration(DUR.base).easing(EASE_OUT)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}>
              <Press onPress={() => open(s.origin)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: C.fill2, alignItems: 'center', justifyContent: 'center' }}>
                  <T style={{ fontFamily: F.semibold, fontSize: 13 }}>{s.origin.replace(/^https?:\/\/(www\.)?/, '').slice(0, 2).toUpperCase()}</T>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="callout" numberOfLines={1}>{s.origin.replace(/^https?:\/\//, '')}</T>
                  <T v="caption" dim>Can see your address</T>
                </View>
              </Press>
              <Press onPress={() => sites.save((x) => x.filter((y) => !(y.origin === s.origin && y.address === me)))} style={{ paddingHorizontal: 12, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.line2, justifyContent: 'center' }}>
                <T v="caption" style={{ fontFamily: F.medium }}>Disconnect</T>
              </Press>
            </Animated.View>
          ))
        )}
      </Animated.View>
      )}
    </ScrollView>
    </View>
  );
}
