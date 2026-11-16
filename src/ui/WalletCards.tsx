import { useEffect, useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop, SvgXml } from 'react-native-svg';
import { LOGOS } from './logos';
import Animated, { Easing, type SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { T } from './Text';
import { Logo } from './Logo';
import { Press } from './controls';
import { Digits } from './Digits';
import { Skeleton } from './Skeleton';
import { F } from './theme';
import type { LogoId } from './logos';

export type CardKind = 'lyx' | 'bk' | 'gr' | 'btc' | 'eth' | 'usdt' | 'usdc';

type Surf = { stops: [string, number][]; ink: string; sub: string; edge: string; glow: number; mark: number };

// Each coin wears a deep, aged version of its own colour (never the flat brand swatch): light comes in from
// the top-left and falls off into a near-black corner, like anodised metal. Coins not in the wallet stay graphite.
const SURFACE: Record<CardKind, Surf> = {
  lyx: { stops: [['#F4F4F6', 0], ['#CFD0D6', 0.4], ['#E9EAEE', 0.58], ['#AEB0B9', 1]], ink: '#101012', sub: 'rgba(16,16,18,0.55)', edge: 'rgba(255,255,255,0.85)', glow: 0.5, mark: 0 },
  bk: { stops: [['#2A2A2E', 0], ['#0D0D0F', 0.55], ['#000000', 1]], ink: '#F5F5F7', sub: 'rgba(245,245,247,0.55)', edge: 'rgba(255,255,255,0.18)', glow: 0.16, mark: 0.17 },
  gr: { stops: [['#4B4B52', 0], ['#25252A', 0.55], ['#131316', 1]], ink: '#F5F5F7', sub: 'rgba(245,245,247,0.58)', edge: 'rgba(255,255,255,0.2)', glow: 0.16, mark: 0.17 },
  btc: { stops: [['#BF722B', 0], ['#8F470D', 0.36], ['#4E2605', 0.78], ['#221002', 1]], ink: '#FFF7EE', sub: 'rgba(255,240,222,0.68)', edge: 'rgba(255,214,160,0.34)', glow: 0.22, mark: 0.2 },
  eth: { stops: [['#6670BD', 0], ['#3A428C', 0.36], ['#1D2256', 0.78], ['#0B0D28', 1]], ink: '#F4F5FF', sub: 'rgba(226,229,255,0.66)', edge: 'rgba(196,204,255,0.32)', glow: 0.2, mark: 0.2 },
  usdt: { stops: [['#38987E', 0], ['#196C56', 0.36], ['#0A3B2E', 0.78], ['#031A14', 1]], ink: '#F0FFF9', sub: 'rgba(214,255,240,0.66)', edge: 'rgba(170,240,214,0.3)', glow: 0.2, mark: 0.2 },
  usdc: { stops: [['#467DC2', 0], ['#225495', 0.36], ['#0F2E5A', 0.78], ['#05132A', 1]], ink: '#F1F7FF', sub: 'rgba(214,232,255,0.66)', edge: 'rgba(176,206,255,0.3)', glow: 0.2, mark: 0.2 },
};
const COLOURED: Partial<Record<LogoId, CardKind>> = { btc: 'btc', eth: 'eth', usdt: 'usdt', usdc: 'usdc' };
/** The card a coin wears once it is in the wallet: its own colour if it has one, graphite if not. */
export const kindFor = (logo: LogoId | null | undefined): CardKind => (logo && COLOURED[logo]) || 'gr';
export const inkOf = (k: CardKind) => SURFACE[k].ink;

/** A band of light that drifts over the card now and then, like light moving over metal. */
function Sheen({ w, h, strength }: { w: number; h: number; strength: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: -w * 0.7 + t.value * w * 1.6 }, { skewX: '-18deg' }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -10, bottom: -10, width: w * 0.5 }, a]}>
      <Svg width={w * 0.5} height={h + 20}>
        <Defs>
          <LinearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#fff" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#fff" stopOpacity={strength} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width={w * 0.5} height={h + 20} fill={`url(#s${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** The LOKYX mark pressed into the metal: light edge up-left, shadow down-right, a soft metal fill. */
function Engraved({ size }: { size: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ring = 'M50 16A34 34 0 1 0 84 50';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={`m${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8D8F98" />
          <Stop offset="0.5" stopColor="#C9CACF" />
          <Stop offset="1" stopColor="#7C7E87" />
        </LinearGradient>
      </Defs>
      <G transform="translate(0.9 1.1)" opacity={0.4}>
        <Path d={ring} stroke="#000" strokeWidth={16} strokeLinecap="round" fill="none" />
        <Circle cx={74} cy={26} r={8.5} fill="#000" />
      </G>
      <G transform="translate(-0.6 -0.8)" opacity={0.95}>
        <Path d={ring} stroke="#fff" strokeWidth={16} strokeLinecap="round" fill="none" />
        <Circle cx={74} cy={26} r={8.5} fill="#fff" />
      </G>
      <Path d={ring} stroke={`url(#m${id})`} strokeWidth={16} strokeLinecap="round" fill="none" />
      <Circle cx={74} cy={26} r={8.5} fill={`url(#m${id})`} />
    </Svg>
  );
}


/** A coin's own mark pressed into its coloured card: only the white glyph and the coin's rim, faint, with a dark offset under them. */
function Embossed({ id, size, strength }: { id: LogoId; size: number; strength: number }) {
  // drop the coin's coloured disc and keep its white drawing
  const glyph = useMemo(() => LOGOS[id].replace(/#[0-9A-Fa-f]{6}\b/g, (m) => (/^#F{6}$/i.test(m) ? '#FFFFFF' : 'none')), [id]);
  const dark = useMemo(() => glyph.replace(/#FFFFFF|#FFF\b|#fff\b/g, '#000000'), [glyph]);
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: 1, top: 1.2, opacity: strength * 0.55 }}>
        <SvgXml xml={dark} width={size} height={size} />
      </View>
      <View style={{ position: 'absolute', left: 0, top: 0, opacity: strength * 0.9 }}>
        <SvgXml xml={glyph} width={size} height={size} />
      </View>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Circle cx={50} cy={50} r={49} stroke="#fff" strokeOpacity={strength * 0.9} strokeWidth={0.8} fill="none" />
      </Svg>
    </View>
  );
}

function Surface({ kind, w, h, radius, badge, logo, peek }: { kind: CardKind; w: number; h: number; radius: number; badge: number; logo?: LogoId; peek?: SharedValue<number> }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const s = SURFACE[kind];
  const badgeFade = useAnimatedStyle(() => ({ opacity: peek ? 1 - peek.value : 1 }));
  return (
    <>
      <Svg style={StyleSheet.absoluteFill} width={w} height={h}>
        <Defs>
          <LinearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            {s.stops.map(([c, o]) => <Stop key={o} offset={o} stopColor={c} />)}
          </LinearGradient>
          <LinearGradient id={`t${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={s.glow} />
            <Stop offset="0.22" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id={`o${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={kind === 'lyx' ? 0.35 : 0.13} />
            <Stop offset="0.55" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id={`r${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.85} />
            <Stop offset="0.45" stopColor="#fff" stopOpacity={0.06} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0.32} />
          </LinearGradient>
          <RadialGradient id={`v${id}`} cx="1" cy="1" r="1.1">
            <Stop offset="0" stopColor="#000" stopOpacity={0.45} />
            <Stop offset="0.7" stopColor="#000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={w} height={h} fill={`url(#g${id})`} />
        <Rect width={w} height={h * 0.55} fill={`url(#o${id})`} />
        <Rect width={w} height={h} fill={`url(#t${id})`} />
        {kind !== 'lyx' && <Rect width={w} height={h} fill={`url(#v${id})`} />}
        {/* a lit rim: bright where the light hits (top left), faint along the middle, a little back at the bottom right */}
        <Rect x={0.6} y={0.6} width={w - 1.2} height={h - 1.2} rx={radius - 0.6} fill="none" stroke={`url(#r${id})`} strokeWidth={1.2} strokeOpacity={kind === 'lyx' ? 0.9 : 0.5} />
      </Svg>
      {/* every card wears its coin's whole mark, pressed into the surface in the same place and size */}
      {badge > 0 ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', right: 20, top: 18 }, badgeFade]}>
          {kind === 'lyx' ? <Engraved size={badge} /> : logo ? <Embossed id={logo} size={badge} strength={kind === 'bk' || kind === 'gr' ? 0.55 : 0.8} /> : null}
        </Animated.View>
      ) : null}
      <Sheen w={w} h={h} strength={kind === 'lyx' ? 0.5 : kind === 'bk' || kind === 'gr' ? 0.16 : 0.14} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: s.edge }} />
    </>
  );
}

export interface CardData {
  kind: CardKind;
  logo?: LogoId;
  title: string;
  sub?: string;
  balance: string;
  unit: string;
  address?: string;
  tag?: string;
}

/** The big card: the LOKYX hero on Home, and each coin's own card on its screen. */
export function WalletCard({ c, width, height = 176, hide, onPress, grey, peek }: { c: CardData; width: number; height?: number; hide?: boolean; onPress?: () => void; grey?: boolean; peek?: SharedValue<number> }) {
  const kind: CardKind = grey && c.kind !== 'lyx' ? 'gr' : c.kind;
  const s = SURFACE[kind];
  const full = useAnimatedStyle(() => ({ opacity: peek ? 1 - peek.value : 1 }));
  const strip = useAnimatedStyle(() => ({ opacity: peek ? peek.value : 0 }));
  const body = (
    <View style={{ width, height, borderRadius: 26, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 12 }}>
      <Surface kind={kind} w={width} h={height} radius={26} badge={Math.round(Math.min(height * 0.36, 62))} logo={c.logo} peek={peek} />
      <Animated.View style={[StyleSheet.absoluteFill, full]}>
      <View style={{ position: 'absolute', left: 22, top: 20 }}>
        <T style={{ fontFamily: F.semibold, fontSize: 12, letterSpacing: 3, color: s.ink }}>{c.title.toUpperCase()}</T>
        {c.sub ? <T style={{ fontFamily: F.regular, fontSize: 12, color: s.sub, paddingTop: 3 }}>{c.sub}</T> : null}
      </View>
      <View style={{ position: 'absolute', left: 22, bottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          {!hide && /^[\d,.]+$/.test(c.balance || '') ? (
            // the number rolls up from zero when the card appears, and again whenever the balance changes
            <Digits text={c.balance} intro style={{ fontFamily: F.regular, fontSize: 34, lineHeight: 42, letterSpacing: -1.2 }} color={s.ink} />
          ) : !hide && !c.balance ? (
            <View style={{ height: 42, justifyContent: 'center' }}><Skeleton w={150} h={28} r={10} /></View>
          ) : (
            <T style={{ fontFamily: F.regular, fontSize: 34, lineHeight: 42, letterSpacing: -1.2, color: s.ink, fontVariant: ['tabular-nums'] }}>{hide ? '••••' : c.balance}</T>
          )}
          <T style={{ fontFamily: F.medium, fontSize: 14, color: s.sub, paddingBottom: 8 }}>{c.unit}</T>
        </View>
      </View>
      <View style={{ position: 'absolute', left: 22, right: 22, bottom: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <T style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 0.6, color: s.sub }}>{c.address ? `${c.address.slice(0, 8)}…${c.address.slice(-6)}` : ''}</T>
        {c.tag ? <T style={{ fontFamily: F.semibold, fontSize: 10, letterSpacing: 1.4, color: s.sub }}>{c.tag.toUpperCase()}</T> : null}
      </View>
      </Animated.View>
      {peek ? (
        // when the card sits behind others only its top strip shows: name on the left, balance and a small mark on the right
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, strip]}>
          <T style={{ position: 'absolute', left: 22, top: 20, fontFamily: F.semibold, fontSize: 12, letterSpacing: 3, color: s.ink }}>{c.title.toUpperCase()}</T>
          <T style={{ position: 'absolute', right: 66, top: 17, fontFamily: F.medium, fontSize: 17, letterSpacing: -0.3, color: s.ink, fontVariant: ['tabular-nums'] }}>{hide ? '••••' : `${c.balance || '–'} ${c.unit}`}</T>
          <View style={{ position: 'absolute', right: 20, top: 14 }}>
            {kind === 'lyx' ? <Engraved size={30} /> : c.logo ? <Embossed id={c.logo} size={30} strength={0.85} /> : null}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
  return onPress ? <Press onPress={onPress} scaleTo={0.985} accessibilityLabel={`${c.title} card`}>{body}</Press> : body;
}

/** A coin in the list: one slim card with the coin's real logo on the left. */
export function CoinRow({ c, width, hide, onPress, grey, mark }: { c: CardData; width: number; hide?: boolean; onPress?: () => void; grey?: boolean; mark?: React.ReactNode }) {
  const kind: CardKind = grey ? 'gr' : c.kind === 'lyx' ? 'bk' : c.kind;
  const s = SURFACE[kind];
  const h = 66;
  return (
    <Press onPress={onPress} scaleTo={0.985} accessibilityLabel={c.title}>
      <View style={{ width, height: h, borderRadius: 22, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
        <Surface kind={kind} w={width} h={h} radius={22} badge={0} logo={c.logo} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13, paddingLeft: 13, paddingRight: 16 }}>
          {mark ?? (c.logo ? <Logo id={c.logo} size={36} grey={grey} /> : null)}
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: F.semibold, fontSize: 15.5, letterSpacing: -0.2, color: s.ink }} numberOfLines={1}>{c.title}</T>
            <T style={{ fontFamily: F.regular, fontSize: 12, color: s.sub, paddingTop: 1 }} numberOfLines={1}>{c.sub}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {!hide && !c.balance ? <Skeleton w={52} h={15} r={6} /> : <T style={{ fontFamily: F.medium, fontSize: 15.5, color: s.ink, fontVariant: ['tabular-nums'] }}>{hide ? '•••' : c.balance}</T>}
            <T style={{ fontFamily: F.regular, fontSize: 11.5, color: s.sub, paddingTop: 1 }}>{c.unit}</T>
          </View>
        </View>
      </View>
    </Press>
  );
}
