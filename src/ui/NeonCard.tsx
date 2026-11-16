import { useEffect, useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { T } from './Text';
import { Digits } from './Digits';
import { Skeleton } from './Skeleton';
import { Logo } from './Logo';
import { CoinLogo, TokenLogo } from './CoinLogo';
import { F } from './theme';
import type { LogoId } from './logos';

/** The light that runs around each card's edge, and the tint behind the number, come from the coin's own colour. */
export type Rim = { a: string; b: string };
export const RIMS: Record<string, Rim> = {
  lyx: { a: '#FFFFFF', b: '#9FA6C2' },
  btc: { a: '#FF9A3C', b: '#FFD08A' },
  eth: { a: '#7A86FF', b: '#BFC6FF' },
  sol: { a: '#9945FF', b: '#14F195' },
  trx: { a: '#FF3B30', b: '#FF9A90' },
  usdc: { a: '#2775CA', b: '#8CC0FF' },
  usdt: { a: '#26A17B', b: '#8CF0CC' },
  gr: { a: '#C9CBD6', b: '#7C7E8A' },
};

export interface NeonData {
  /** which rim colours */
  rim: keyof typeof RIMS | string;
  title: string;
  sub?: string;
  balance: string;
  unit: string;
  /** the second line: the fiat value on mainnet, or "Testnet · no market value" */
  note?: string;
  /** the whole coin mark, top right */
  mark: { kind: 'lyx' } | { kind: 'logo'; id: LogoId } | { kind: 'token'; symbol: string; seed: string };
  address?: string;
}

const R = 24;
const EDGE = 2.2;

/** A beam of light as a fan of thin slices that fade behind its tip, so it reads as a comet running along the edge. */
function Beam({ d, a, strength }: { d: number; a: string; strength: number }) {
  const c = d / 2;
  const slices = 22;
  const span = 130;
  const paths = [];
  for (let i = 0; i < slices; i++) {
    const a0 = (-i * span) / slices;
    const a1 = (-(i + 1) * span) / slices;
    const pt = (deg: number) => [c + c * Math.cos((deg * Math.PI) / 180), c + c * Math.sin((deg * Math.PI) / 180)];
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    paths.push(<Path key={i} d={`M${c} ${c}L${x0} ${y0}A${c} ${c} 0 0 0 ${x1} ${y1}Z`} fill={a} fillOpacity={strength * Math.pow(1 - i / slices, 1.7)} />);
  }
  return <>{paths}</>;
}

export function NeonCard({ c, width, height = 196, hide }: { c: NeonData; width: number; height?: number; hide?: boolean }) {
  const rim = RIMS[c.rim] ?? RIMS.gr;
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const spin = useSharedValue(0);
  const drift = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.linear }), -1);
    drift.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [spin, drift]);
  const D = Math.ceil(Math.hypot(width, height)) + 8;
  const rot = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const sheen = useAnimatedStyle(() => ({ transform: [{ translateX: -width * 0.6 + drift.value * width * 1.5 }, { skewX: '-20deg' }], opacity: 0.55 }));
  const [whole, dec] = c.balance.includes('.') ? [c.balance.slice(0, c.balance.indexOf('.')), c.balance.slice(c.balance.indexOf('.'))] : [c.balance, ''];
  const numeric = /^[\d,]+$/.test(whole) && /^(\.\d+)?$/.test(dec);
  const big = { fontFamily: F.medium, fontSize: 40, lineHeight: 48, letterSpacing: -1.8 } as const;
  const small = { fontFamily: F.regular, fontSize: 23, lineHeight: 30, letterSpacing: -0.6 } as const;
  const mark = Math.min(52, Math.round(height * 0.26));
  return (
    <View style={{ width, height, borderRadius: R }}>
      <View style={{ flex: 1, borderRadius: R, overflow: 'hidden', backgroundColor: '#050507' }}>
        {/* the light running round the edge: two beams on one turning disc, the second fainter and in the coin's second colour */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (width - D) / 2, top: (height - D) / 2, width: D, height: D }, rot]}>
          <Svg width={D} height={D}>
            <Beam d={D} a={rim.a} strength={1} />
            <G180 d={D} a={rim.b} />
          </Svg>
        </Animated.View>
        {/* the card itself sits inside the light, leaving a thin lit edge */}
        <View style={{ position: 'absolute', left: EDGE, top: EDGE, right: EDGE, bottom: EDGE, borderRadius: R - EDGE, overflow: 'hidden' }}>
          <Svg width={width - EDGE * 2} height={height - EDGE * 2} style={{ position: 'absolute' }}>
            <Defs>
              <LinearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#0E0E12" />
                <Stop offset="0.5" stopColor="#040406" />
                <Stop offset="1" stopColor="#000000" />
              </LinearGradient>
              <RadialGradient id={`t${id}`} cx="0.92" cy="0.05" r="0.85">
                <Stop offset="0" stopColor={rim.a} stopOpacity="0.17" />
                <Stop offset="1" stopColor={rim.a} stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id={`u${id}`} cx="0.05" cy="1" r="0.8">
                <Stop offset="0" stopColor={rim.b} stopOpacity="0.1" />
                <Stop offset="1" stopColor={rim.b} stopOpacity="0" />
              </RadialGradient>
              <LinearGradient id={`h${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#fff" stopOpacity="0.17" />
                <Stop offset="1" stopColor="#fff" stopOpacity="0.025" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#b${id})`} />
            <Rect width="100%" height="100%" fill={`url(#t${id})`} />
            <Rect width="100%" height="100%" fill={`url(#u${id})`} />
            <Path d={`M0 0 H${width - EDGE * 2} V${(height - EDGE * 2) * 0.3} L0 ${(height - EDGE * 2) * 0.62} Z`} fill={`url(#h${id})`} />
            <Rect width="100%" height="1" fill="#fff" opacity="0.22" />
          </Svg>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -10, bottom: -10, width: width * 0.32 }, sheen]}>
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#fff" stopOpacity="0" />
                  <Stop offset="0.5" stopColor="#fff" stopOpacity="0.16" />
                  <Stop offset="1" stopColor="#fff" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#s${id})`} />
            </Svg>
          </Animated.View>

          {/* stops short of the coin mark so a long network name never runs under it */}
          <View style={{ position: 'absolute', left: 20, top: 19, right: mark + 36 }}>
            <T numberOfLines={1} style={{ fontFamily: F.semibold, fontSize: 12, letterSpacing: 3, color: '#F5F5F7' }}>{c.title.toUpperCase()}</T>
            {c.sub ? <T numberOfLines={1} style={{ fontFamily: F.regular, fontSize: 12, color: 'rgba(245,245,247,0.55)', paddingTop: 3 }}>{c.sub}</T> : null}
          </View>
          <View style={{ position: 'absolute', right: 18, top: 16 }}>
            <View style={{ position: 'absolute', left: -10, top: -10, width: mark + 20, height: mark + 20, borderRadius: (mark + 20) / 2, backgroundColor: rim.a, opacity: 0.16 }} />
            {c.mark.kind === 'lyx' ? <CoinLogo chain="lyx" size={mark} /> : c.mark.kind === 'token' ? <TokenLogo symbol={c.mark.symbol} seed={c.mark.seed} size={mark} /> : <Logo id={c.mark.id} size={mark} />}
          </View>
          <View style={{ position: 'absolute', left: 20, right: 16, bottom: 42, flexDirection: 'row', alignItems: 'flex-end', overflow: 'hidden' }}>
            {hide ? (
              <T style={{ ...big, color: '#F5F5F7' }}>••••</T>
            ) : !c.balance ? (
              <View style={{ height: 48, justifyContent: 'center' }}><Skeleton w={150} h={30} r={10} /></View>
            ) : numeric ? (
              <>
                <Digits text={whole} intro style={big} color="#F5F5F7" />
                {dec ? <Digits text={dec} intro style={small} color="rgba(245,245,247,0.45)" /> : null}
              </>
            ) : (
              <T style={{ ...big, color: '#F5F5F7' }}>{c.balance}</T>
            )}
            <T style={{ fontFamily: F.medium, fontSize: 14, color: 'rgba(245,245,247,0.6)', paddingBottom: 10, paddingLeft: 7 }}>{c.unit}</T>
          </View>
          {c.note ? <T numberOfLines={1} style={{ position: 'absolute', left: 20, right: 16, bottom: 16, fontFamily: F.regular, fontSize: 12.5, color: 'rgba(245,245,247,0.62)' }}>{c.note}</T> : null}
        </View>
      </View>
    </View>
  );
}

/** The faint second beam on the opposite side of the disc. */
function G180({ d, a }: { d: number; a: string }) {
  return (
    <Svg width={d} height={d} style={{ position: 'absolute', transform: [{ rotate: '180deg' }] }}>
      <Beam d={d} a={a} strength={0.75} />
    </Svg>
  );
}
