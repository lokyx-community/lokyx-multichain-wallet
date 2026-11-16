import { useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withTiming, cancelAnimation } from 'react-native-reanimated';
import { T } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { IconButton, Press, success, tap, ErrorText } from '../ui/controls';
import { Logo, logoFor } from '../ui/Logo';
import { TokenLogo } from '../ui/CoinLogo';
import { WalletCard, kindFor } from '../ui/WalletCards';
import { C, F } from '../ui/theme';
import { DUR, EASE_OUT } from '../ui/motion';
import { activeNets, addToken, lookupToken, useTokensStore, tokensFor } from '../lib/multichain';
import { ETH_NETS, KNOWN_TOKENS, ethAddressOk, searchKnown, tokenId, type EthToken } from '../lib/multichain-core';
import { useCoins } from '../lib/coins';

type Verdict = { kind: 'known' } | { kind: 'lookalike'; real: EthToken } | { kind: 'unlisted' };

/** A token that copies a known one's symbol with another contract is a copy. One nobody listed is only unfamiliar. */
function judge(t: EthToken): Verdict {
  if (KNOWN_TOKENS.some((k) => tokenId(k) === tokenId(t))) return { kind: 'known' };
  const same = KNOWN_TOKENS.find((k) => k.chainId === t.chainId && k.symbol.toUpperCase() === t.symbol.toUpperCase());
  return same ? { kind: 'lookalike', real: same } : { kind: 'unlisted' };
}

const nameOf = (t: EthToken) => t.name ?? KNOWN_TOKENS.find((k) => tokenId(k) === tokenId(t))?.name ?? t.symbol;

function Mark({ t, size, grey }: { t: EthToken; size: number; grey?: boolean }) {
  const l = logoFor(t.symbol);
  if (l) return <Logo id={l} size={size} grey={grey} />;
  return <View style={{ opacity: grey ? 0.6 : 1 }}><TokenLogo symbol={t.symbol} seed={t.contract} size={size} /></View>;
}

/** The card slot: dashed and empty, then the coin's card in graphite, then (once added) in its own colour. */
function Slot({ tok, lit, width, busy }: { tok: EthToken | null; lit: boolean; width: number; busy: boolean }) {
  const h = Math.round(width * 0.53);
  const grey = useSharedValue(1);
  useEffect(() => {
    grey.value = withTiming(lit ? 0 : 1, { duration: 450, easing: EASE_OUT });
  }, [lit, grey]);
  const top = useAnimatedStyle(() => ({ opacity: grey.value }));
  if (!tok)
    return (
      <View style={{ height: h, borderRadius: 26, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={20} color={C.sub} width={1.9} />
        </View>
        <T v="sub" dim>{busy ? 'Looking it up…' : 'Your next card appears here'}</T>
      </View>
    );
  const logo = logoFor(tok.symbol);
  const net = ETH_NETS[activeNets().eth];
  const data = { kind: kindFor(logo), logo: logo ?? undefined, title: nameOf(tok), sub: `${tok.symbol} on ${net.label}`, unit: tok.symbol, balance: '0', tag: net.real ? '' : 'Test network' };
  return (
    <Animated.View entering={FadeIn.duration(DUR.slow).easing(EASE_OUT)} style={{ height: h }}>
      <WalletCard c={data} width={width} height={h} />
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0 }, top]}>
        <WalletCard c={data} width={width} height={h} grey />
      </Animated.View>
      <View pointerEvents="none" style={{ position: 'absolute', right: 20, top: 18 }}>
        <Mark t={tok} size={34} grey={!lit} />
      </View>
    </Animated.View>
  );
}

/** "Add it anyway" needs a three-second hold, so a copy can't be added by a quick tap. */
function HoldToAdd({ label, onDone }: { label: string; onDone: () => void }) {
  const p = useSharedValue(0);
  const bar = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <Press
      haptic={false}
      scaleTo={0.99}
      delayLongPress={3000}
      onPressIn={() => {
        tap();
        p.value = withTiming(1, { duration: 3000 });
      }}
      onPressOut={() => {
        cancelAnimation(p);
        p.value = withTiming(0, { duration: DUR.fast, easing: EASE_OUT });
      }}
      onLongPress={onDone}
      style={{ marginTop: 10, height: 50, borderRadius: 25, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}
    >
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,92,92,0.22)' }, bar]} />
      <T style={{ fontFamily: F.semibold, fontSize: 14.5, color: C.sub }}>{label}</T>
    </Press>
  );
}

function Chip({ t, onPress }: { t: EthToken; onPress: () => void }) {
  return (
    <Press onPress={onPress} scaleTo={0.97} accessibilityLabel={`Add ${nameOf(t)}`} style={{ height: 44, paddingLeft: 6, paddingRight: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' }}>
      <Mark t={t} size={32} grey />
      <T style={{ fontFamily: F.semibold, fontSize: 14 }}>{nameOf(t)}</T>
    </Press>
  );
}

const Panel = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <View style={[{ borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, overflow: 'hidden' }, style]}>{children}</View>
);
const Line = ({ k, v, mono }: { k: string; v: string; mono?: boolean }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 }}>
    <T v="sub" dim style={{ flex: 1 }}>{k}</T>
    <T style={{ fontFamily: mono ? F.mono : F.medium, fontSize: mono ? 13 : 15 }}>{v}</T>
  </View>
);

/**
 * Add a coin. One field takes a name, a symbol or a pasted contract. The card slot at the top fills in as
 * you go: graphite while you decide, then the coin's own colour once it is in the wallet.
 */
export default function AddCoin() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cw = Math.min(width - 32, 420);
  const coins = useCoins();
  useTokensStore();
  const net = activeNets().eth;
  const chainId = ETH_NETS[net].chainId;
  const netLabel = ETH_NETS[net].label;
  const [text, setText] = useState('');
  const [tok, setTok] = useState<EthToken | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const seq = useRef(0);
  const verdict = tok ? judge(tok) : null;
  const held = tokensFor(net);
  const inWallet = (t: EthToken) => held.some((x) => tokenId(x) === tokenId(t));
  const popular = KNOWN_TOKENS.filter((k) => k.chainId === chainId && !inWallet(k));
  const matches = !tok && text.trim() && !text.trim().startsWith('0x') ? searchKnown(chainId, text) : [];

  const reset = () => {
    setTok(null);
    setErr('');
    setDone(false);
  };
  const pick = (t: EthToken) => {
    tap();
    reset();
    setText(t.symbol);
    setTok(t);
  };
  const look = async (v: string) => {
    reset();
    const a = v.trim();
    if (!a.startsWith('0x')) return;
    if (!ethAddressOk(a)) {
      if (a.length >= 42) setErr("That isn't a valid contract address.");
      return;
    }
    const known = KNOWN_TOKENS.find((k) => tokenId(k) === tokenId({ chainId, contract: a }));
    if (known) return setTok(known);
    const n = ++seq.current;
    setBusy(true);
    try {
      const t = await lookupToken(net, a);
      if (n === seq.current) setTok(t);
    } catch {
      if (n === seq.current) setErr(`No token at that address on ${netLabel}. Check the address and the network.`);
    } finally {
      if (n === seq.current) setBusy(false);
    }
  };
  const paste = async () => {
    const v = (await Clipboard.getStringAsync()).trim();
    setText(v);
    look(v);
  };
  const add = async (t: EthToken) => {
    await addToken(t);
    success();
    setTok(t);
    setDone(true);
  };
  const already = tok ? inWallet(tok) && !done : false;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 52 }}>
          <T style={{ flex: 1, fontFamily: F.semibold, fontSize: 22, letterSpacing: -0.5, paddingLeft: 4 }}>{done ? '' : 'Add a coin'}</T>
          <IconButton name="close" label="Close" onPress={() => router.back()} />
        </View>

        {done && tok ? (
          <Animated.View entering={FadeIn.duration(DUR.base).easing(EASE_OUT)}>
            <T style={{ textAlign: 'center', fontFamily: F.semibold, fontSize: 12.5, letterSpacing: 1.6, color: C.sub, paddingBottom: 14 }}>ADDED</T>
            <Slot tok={tok} lit width={cw} busy={false} />
            <Animated.View entering={FadeInDown.delay(250).duration(DUR.slow).easing(EASE_OUT)} style={{ alignItems: 'center', paddingTop: 26, gap: 8 }}>
              <T style={{ fontFamily: F.semibold, fontSize: 24, letterSpacing: -0.5 }}>{`${nameOf(tok)} is in your wallet`}</T>
              <T v="sub" dim style={{ textAlign: 'center', lineHeight: 20 }}>{`Ready to receive on ${netLabel}.\nIt sits under Ethereum on Home.`}</T>
            </Animated.View>
            <Press onPress={() => router.replace(`/receive?coin=eth&token=${tok.contract}`)} style={{ marginTop: 28, height: 56, borderRadius: 28, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ fontFamily: F.semibold, fontSize: 17, color: C.inkText }}>{`Receive ${tok.symbol}`}</T>
            </Press>
            <Press onPress={() => router.back()} style={{ marginTop: 10, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ fontFamily: F.semibold, fontSize: 16 }}>Done</T>
            </Press>
          </Animated.View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 27, borderWidth: 1, borderColor: text ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.04)', paddingLeft: 18, paddingRight: 8, gap: 10, marginTop: 6 }}>
              <Icon name="search" size={19} color={C.sub} width={1.9} />
              <TextInput
                value={text}
                onChangeText={(x) => {
                  setText(x);
                  look(x);
                }}
                placeholder="Paste a contract or type a name"
                placeholderTextColor={C.faint}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={C.text}
                keyboardAppearance="dark"
                style={{ flex: 1, fontFamily: text.startsWith('0x') ? F.mono : F.regular, fontSize: text.startsWith('0x') ? 14 : 15.5, color: C.text, height: 54 }}
              />
              {text ? (
                <Press onPress={() => (setText(''), reset())} accessibilityLabel="Clear" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={16} color={C.text} width={2.2} />
                </Press>
              ) : (
                <Press onPress={paste} style={{ height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: C.ink, justifyContent: 'center' }}>
                  <T style={{ fontFamily: F.semibold, fontSize: 13.5, color: C.inkText }}>Paste</T>
                </Press>
              )}
            </View>

            {matches.length > 0 ? (
              <Animated.View entering={FadeIn.duration(DUR.fast)} exiting={FadeOut.duration(DUR.fast)} style={{ marginTop: 12 }}>
                <Panel>
                  {matches.map((m) => (
                    <Press key={m.contract} haptic={false} scaleTo={0.99} onPress={() => pick(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
                      <Mark t={m} size={34} grey={!inWallet(m)} />
                      <View style={{ flex: 1 }}>
                        <T style={{ fontFamily: F.medium, fontSize: 15.5 }}>{nameOf(m)}</T>
                        <T v="caption" dim>{`${m.symbol} · ${netLabel}`}</T>
                      </View>
                      {inWallet(m) ? <Icon name="check" size={17} color={C.text} width={2.4} /> : <Icon name="plus" size={17} color={C.sub} width={2} />}
                    </Press>
                  ))}
                </Panel>
              </Animated.View>
            ) : null}
            {!tok && text.trim() && !text.trim().startsWith('0x') && matches.length === 0 ? (
              <T v="sub" dim style={{ paddingTop: 12, paddingHorizontal: 6, lineHeight: 19 }}>{`Nothing on the token list by that name on ${netLabel}. To add another token, paste its contract address from the issuer's own website.`}</T>
            ) : null}

            <View style={{ marginTop: 18 }}>
              <Slot tok={tok} lit={false} width={cw} busy={busy} />
              <ErrorText>{err}</ErrorText>
            </View>

            {tok && verdict?.kind === 'lookalike' ? (
              <Animated.View entering={FadeInDown.duration(DUR.base).easing(EASE_OUT)}>
                <View style={{ marginTop: 16, padding: 18, borderRadius: 24, backgroundColor: C.ink }}>
                  <T style={{ fontFamily: F.semibold, fontSize: 16.5, color: C.inkText }}>{`This is not the real ${nameOf(verdict.real)}`}</T>
                  <T v="sub" style={{ color: '#3A3A3C', paddingTop: 6, lineHeight: 20 }}>It uses the name of a well-known coin, but the contract is different from the one on the token list. Copies like this are a common scam.</T>
                </View>
                <Panel style={{ marginTop: 10 }}>
                  <Line k="On the token list" v="No" />
                  <Line k={`Real ${verdict.real.symbol} contract`} v={`${verdict.real.contract.slice(0, 6)}…${verdict.real.contract.slice(-4)}`} mono />
                </Panel>
                <Press onPress={() => pick(verdict.real)} style={{ marginTop: 16, height: 56, borderRadius: 28, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <T style={{ fontFamily: F.semibold, fontSize: 17, color: C.inkText }}>{`Use the real ${nameOf(verdict.real)}`}</T>
                </Press>
                <HoldToAdd label="Add it anyway (hold 3 seconds)" onDone={() => add(tok)} />
              </Animated.View>
            ) : tok ? (
              <Animated.View entering={FadeInDown.duration(DUR.base).easing(EASE_OUT)}>
                <T style={{ fontFamily: F.semibold, fontSize: 12, letterSpacing: 1.6, color: C.sub, paddingTop: 22, paddingBottom: 10, paddingHorizontal: 6 }}>ADD IT ON</T>
                <Panel>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
                    <Logo id="eth" size={34} />
                    <View style={{ flex: 1 }}>
                      <T style={{ fontFamily: F.medium, fontSize: 15.5 }}>{netLabel}</T>
                      <T v="caption" dim>Your 0x address</T>
                    </View>
                    <Icon name="check" size={17} color={C.text} width={2.4} />
                  </View>
                </Panel>
                <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' }}>
                  <Icon name={verdict?.kind === 'known' ? 'shield' : 'info'} size={18} color={C.text} width={1.9} />
                  <T v="sub" dim style={{ flex: 1, lineHeight: 19 }}>
                    {verdict?.kind === 'known'
                      ? 'Matches the token list in the app: the real contract, symbol and decimals.'
                      : "Not on the app's token list. The name comes from the token itself, and anyone can pick any name. Check the contract on the issuer's own website."}
                  </T>
                </View>
                <Press onPress={() => add(tok)} disabled={already} style={{ marginTop: 16, height: 56, borderRadius: 28, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <T style={{ fontFamily: F.semibold, fontSize: 17, color: C.inkText }}>{already ? `${tok.symbol} is already in your wallet` : `Add ${nameOf(tok)}`}</T>
                </Press>
              </Animated.View>
            ) : (
              <>
                {popular.length > 0 && (
                  <>
                    <T style={{ fontFamily: F.semibold, fontSize: 12, letterSpacing: 1.6, color: C.sub, paddingTop: 24, paddingBottom: 10, paddingHorizontal: 6 }}>POPULAR ON YOUR NETWORKS</T>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {popular.map((t) => <Chip key={t.contract} t={t} onPress={() => pick(t)} />)}
                    </View>
                  </>
                )}
                <T style={{ fontFamily: F.semibold, fontSize: 12, letterSpacing: 1.6, color: C.sub, paddingTop: 24, paddingBottom: 10, paddingHorizontal: 6 }}>IN YOUR WALLET</T>
                <Panel>
                  {[
                    { k: 'btc', m: <Logo id="btc" size={34} />, t: 'Bitcoin', s: coins.btc.sub },
                    { k: 'eth', m: <Logo id="eth" size={34} />, t: 'Ethereum', s: coins.eth.sub },
                    ...held.map((x) => ({ k: x.contract, m: <Mark t={x} size={34} />, t: nameOf(x), s: `${x.symbol} · ${netLabel}` })),
                  ].map((r) => (
                    <View key={r.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }}>
                      {r.m}
                      <View style={{ flex: 1 }}>
                        <T style={{ fontFamily: F.medium, fontSize: 15.5 }}>{r.t}</T>
                        <T v="caption" dim>{r.s}</T>
                      </View>
                      <Icon name="check" size={17} color={C.text} width={2.4} />
                    </View>
                  ))}
                </Panel>
                <Press onPress={() => router.push('/chains-settings')} scaleTo={0.985} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="globe" size={17} color={C.text} width={1.9} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontFamily: F.medium, fontSize: 15.5 }}>All coins and networks</T>
                    <T v="caption" dim>Test or real networks for Bitcoin and Ethereum</T>
                  </View>
                  <Icon name="chevron" size={14} color={C.faint} width={2.2} />
                </Press>
                <T v="caption" dim style={{ paddingTop: 16, paddingHorizontal: 6, lineHeight: 18 }}>Grey means not in your wallet yet. A coin takes its colour when you add it. Solana, Tron, Dogecoin and Litecoin come later: each needs its own signing code.</T>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
