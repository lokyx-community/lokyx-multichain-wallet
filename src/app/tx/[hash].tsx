import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Svg, { Circle } from 'react-native-svg';
import Animated, { Easing, FadeInDown, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { T } from '../../ui/Text';
import { Group, Line, Press, Row, Screen, success } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { toast } from '../../ui/Toast';
import { C, F } from '../../ui/theme';
import { siteUrl, usePoll, type TxInfo } from '../../lib/rpc';
import { currentAddress } from '../../lib/wallet';
import { labelFor, niceLyx, shortAddr } from '../../lib/format';
import { sunLevels, sunPaths } from '../../lib/sun';
import { addressToBytes } from '../../lib/lokyx';
import { SunFills } from '../../ui/SunFills';
import { Signet } from '../../ui/Signet';
import type { FillStage } from '../../lib/sunfill-core';
import { DUR, EASE_OUT } from '../../ui/motion';

const SETTLED = 6;
const ACircle = Animated.createAnimatedComponent(Circle);

/** Fills a little with each block on top, until the payment is settled. */
function ConfirmRing({ n, pending }: { n: number; pending: boolean }) {
  const k = useSharedValue(0);
  const R = 46;
  const L = 2 * Math.PI * R;
  useEffect(() => {
    k.value = withTiming(pending ? 0.04 : Math.min(1, n / SETTLED), { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [n, pending, k]);
  const p = useAnimatedProps(() => ({ strokeDashoffset: L * (1 - k.value) }));
  const done = n >= SETTLED;
  return (
    <View style={{ width: 108, height: 108, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={108} height={108} style={{ position: 'absolute' }}>
        <Circle cx={54} cy={54} r={R} stroke={C.fill2} strokeWidth={6} fill="none" />
        <ACircle cx={54} cy={54} r={R} stroke={pending ? C.wait : done ? C.text : C.soft} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={`${L} ${L}`} animatedProps={p} rotation={-90} origin="54,54" />
      </Svg>
      {done ? <Icon name="check" size={38} color={C.text} width={2.6} /> : <T style={{ fontFamily: F.semibold, fontSize: 26, letterSpacing: -0.8 }}>{pending ? '…' : `${n}/${SETTLED}`}</T>}
    </View>
  );
}

/** The other side's sun, filling as the payment waits and settles (the same animation as sending). */
function TxSun({ who, pending, conf, failed }: { who?: string; pending: boolean; conf: number; failed: boolean }) {
  const size = 168;
  const art = useMemo(() => {
    try {
      return who ? sunPaths(sunLevels(addressToBytes(who)), size) : null;
    } catch {
      return null;
    }
  }, [who]);
  if (!art || !who) return <ConfirmRing n={conf} pending={pending} />;
  const stage: FillStage = failed ? 'failed' : pending ? 'waiting' : conf >= SETTLED ? 'done' : 'sending';
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <SunFills rays={art.each} frame={art.frame} frameStroke={art.frameStroke} stroke={art.stroke} size={size} stage={stage} centre={<Signet of={who} size={size * 0.36} bare />} />
      {!pending && !failed && conf < SETTLED && <T v="caption" dim>{`${conf} of ${SETTLED} blocks on top`}</T>}
    </View>
  );
}

export default function TxScreen() {
  const { hash } = useLocalSearchParams<{ hash: string }>();
  const tx = usePoll<TxInfo>('lyx_getTransaction', { hash }, 4000);
  const t = tx.data;
  const me = currentAddress();
  const out = t?.from === me;
  const pending = t?.status === 'pending';
  const conf = t?.confirmations ?? 0;
  const call = t?.contract;
  const status = !t ? '' : pending ? 'Waiting for a block' : conf >= SETTLED ? 'Settled' : `In block ${t.blockHeight?.toLocaleString('en-US')}`;
  const failed = t?.receipt && !t.receipt.ok;

  return (
    <Screen title="">
      {!t ? (
        <View style={{ paddingTop: 80, alignItems: 'center', gap: 12 }}>
          {tx.error ? <T v="sub" dim>{tx.error.message}</T> : <ActivityIndicator color={C.sub} />}
        </View>
      ) : (
        <>
          <Animated.View entering={FadeInDown.duration(DUR.base).easing(EASE_OUT)} style={{ alignItems: 'center', gap: 14, paddingBottom: 8 }}>
            <TxSun who={out ? t.to : t.from} pending={pending} conf={conf} failed={!!failed} />
            <View style={{ alignItems: 'center', gap: 4 }}>
              <T v="callout" dim>{call ? (call.kind === 'deploy' ? 'Made a contract' : `Called ${call.method ?? 'a contract'}`) : out ? `Sent to ${labelFor(t.to)}` : `From ${labelFor(t.from)}`}</T>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <T style={{ fontFamily: F.semibold, fontSize: 44, letterSpacing: -1.8, lineHeight: 54 }}>
                  {out ? '−' : '+'}
                  {niceLyx(t.valueLyx, 6)}
                </T>
                <T style={{ fontFamily: F.medium, fontSize: 20, color: C.sub }}>LYX</T>
              </View>
              <T v="sub" color={failed ? C.bad : pending ? C.wait : C.soft}>{failed ? `Didn't go through: ${t.receipt?.error ?? 'the contract said no'}` : status}</T>
            </View>
          </Animated.View>

          <Group>
            <Line label="From" value={labelFor(t.from)} />
            <Line label="To" value={labelFor(t.to)} />
            <Line label="Network fee" value={`${niceLyx(t.receipt?.feeLyx ?? t.feeLyx, 8)} LYX`} />
            {!pending && <Line label="Blocks on top" value={conf.toLocaleString('en-US')} />}
            {t.receipt && <Line label="Gas used" value={t.receipt.gasUsed.toLocaleString('en-US')} />}
          </Group>

          <Group>
            <Row
              icon="copy"
              title="Copy transaction ID"
              sub={shortAddr(t.hash, 12, 8)}
              onPress={async () => {
                await Clipboard.setStringAsync(t.hash);
                success();
                toast('Copied');
              }}
            />
            <Row icon="globe" title="Open in explorer" onPress={() => router.push(`/browser?url=${encodeURIComponent(`${siteUrl()}/#/tx/${t.hash}`)}`)} />
            {!out && t.from && <Row icon="send" title="Send back" onPress={() => router.push(`/send?to=${t.from}`)} />}
          </Group>
          {pending && (
            <Press onPress={() => tx.refresh()} style={{ alignSelf: 'center' }}>
              <T v="caption" dim>Blocks come about once a minute on testnet.</T>
            </Press>
          )}
        </>
      )}
    </Screen>
  );
}
