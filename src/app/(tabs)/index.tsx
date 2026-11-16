import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { ActionRow } from "../../ui/ActionRow";
import { T } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Press, success } from "../../ui/controls";
import { MarkDraw } from "../../ui/Intro";
import { NeonCard, type NeonData } from "../../ui/NeonCard";
import { CardCarousel } from "../../ui/CardCarousel";
import { EthNets, netName } from "../../ui/ChainGroup";
import { Logo } from "../../ui/Logo";
import { TokenLogo } from "../../ui/CoinLogo";
import { Sheet } from "../../ui/Sheet";
import { ActivityRow } from "../../ui/ActivityRow";
import { unreadCount, useInbox } from "../../lib/inbox";
import { C, F } from "../../ui/theme";
import { usePoll, type History } from "../../lib/rpc";
import { useAccountRef, useWallet } from "../../lib/wallet";
import { refreshChain, useChain } from "../../lib/chain";
import { toast } from "../../ui/Toast";
import { addInbox } from "../../lib/inbox";
import { flyCoin } from "../../ui/CoinFlight";
import { CapsuleShape, PLANET } from "../../ui/Orbit";
import { useCapsules } from "../../lib/capsules";
import { useContractsOn } from "../../lib/chain";
import { markReceiptsSeen } from "../../lib/watch";
import { newReceipts, receiptKey } from "../../lib/watch-core";
import { niceLyx, shortAddr } from "../../lib/format";
import { useBackupDue } from "../../lib/backup-check";
import { useCoins } from "../../lib/coins";
import {
  activeNets,
  btcHistory,
  updateChains,
  useAsync,
  useChainSettings,
} from "../../lib/multichain";
import { ethNetChoices, formatBtc, formatUnits } from "../../lib/multichain-core";
import { solHistory, tronHistory } from "../../lib/xchains";
import { SOL_DECIMALS } from "../../lib/sol-core";
import { TRX_DECIMALS } from "../../lib/tron-core";
import { timeAgo } from "../../lib/format";

/** One payment row under a card: who, when, and the amount in green when it came in. */
function PayRow({ title, when, amount, unit, incoming, failed, hide }: { title: string; when: string; amount: string; unit: string; incoming: boolean; failed?: boolean; hide: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 58, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: C.line }}>
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: F.medium, fontSize: 15.5 }} numberOfLines={1}>{failed ? "Failed" : title}</T>
        <T v="caption" dim>{when}</T>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <T style={{ fontFamily: F.medium, fontSize: 15.5, fontVariant: ["tabular-nums"], color: failed ? C.sub : incoming ? C.good : C.text }}>{hide ? "•••" : `${incoming ? "+" : "−"}${amount}`}</T>
        <T v="caption" dim>{unit}</T>
      </View>
    </View>
  );
}

function TokenRow({ name, symbol, balance, logo, seed, hide, onPress }: { name: string; symbol: string; balance: string; logo?: import("../../ui/logos").LogoId | null; seed: string; hide: boolean; onPress?: () => void }) {
  return (
    <Press onPress={onPress} disabled={!onPress} haptic={false} scaleTo={0.985} accessibilityLabel={name} style={{ flexDirection: "row", alignItems: "center", gap: 13, height: 60, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: C.line }}>
      {logo ? <Logo id={logo} size={36} /> : <TokenLogo symbol={symbol} seed={seed} size={36} />}
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: F.medium, fontSize: 15.5 }} numberOfLines={1}>{name}</T>
        <T v="caption" dim>{symbol}</T>
      </View>
      <T style={{ fontFamily: F.medium, fontSize: 15.5, fontVariant: ["tabular-nums"] }}>{hide ? "•••" : balance || "–"}</T>
    </Press>
  );
}
import { DUR, EASE_OUT } from "../../ui/motion";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5
    ? "Good night"
    : h < 12
      ? "Good morning"
      : h < 17
        ? "Good afternoon"
        : "Good evening";
};

function Banner({
  title,
  sub,
  onPress,
  tint,
}: {
  title: string;
  sub: string;
  onPress: () => void;
  tint?: string;
}) {
  return (
    <Press
      onPress={onPress}
      scaleTo={0.985}
      style={{
        marginTop: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: 14,
        borderRadius: 20,
        backgroundColor: C.fill2,
        borderWidth: 0.5,
        borderColor: C.line2,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontFamily: F.semibold, fontSize: 15.5 }}>{title}</T>
        <T v="caption" dim color={tint}>
          {sub}
        </T>
      </View>
      <Icon name="chevron" size={16} color={C.faint} width={2.2} />
    </Press>
  );
}

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingBottom: 8, paddingHorizontal: 6 }}>
      <T style={{ flex: 1, fontFamily: F.semibold, fontSize: 12, letterSpacing: 1.6, color: C.sub }}>{title}</T>
      {action ? (
        <Press onPress={onAction} hitSlop={10}>
          <T style={{ fontFamily: F.medium, fontSize: 14.5 }}>{action}</T>
        </Press>
      ) : null}
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { width: sw } = useWindowDimensions();
  const cw = Math.min(sw - 32, 420);
  const me = useAccountRef();
  const w = useWallet();
  const hide = w.settings.hideBalance;
  const address = me?.address ?? "";
  const coins = useCoins();
  const chainCfg = useChainSettings();
  const ethNet = activeNets().eth;
  const hist = usePoll<History>(
    "lyx_getAddressHistory",
    address ? { address, limit: 6 } : null,
    8000,
  );
  const contractsOn = useContractsOn();
  const allCaps = useCapsules();
  const backupDue = useBackupDue();
  const readyCaps = contractsOn
    ? allCaps.filter(
        (c) =>
          c.address &&
          !c.opened &&
          c.to === address &&
          Date.now() / 1000 >= c.opens,
      )
    : [];
  const { error: chainError } = useChain();
  const [pulling, setPulling] = useState(false);

  // Depth: scrolling up sends the card back (smaller, softer); pulling down brings it forward.
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const cardDepth = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 220], [1, 0.55], "clamp"),
    transform: [
      { translateY: interpolate(y.value, [-160, 0, 220], [-8, 0, 46], "clamp") },
      { scale: interpolate(y.value, [-160, 0, 220], [1.05, 1, 0.92], "clamp") },
    ],
  }));

  const refresh = useCallback(async () => {
    setPulling(true);
    await Promise.all([hist.refresh(), refreshChain(), coins.refresh()]);
    setPulling(false);
  }, [hist, coins]);

  // A payment that lands while the wallet is open: a toast, once (the background check skips it after).
  const known = useRef<{ addr: string; keys: Set<string> } | null>(null);
  useEffect(() => {
    if (!hist.data || !address) return;
    if (!known.current || known.current.addr !== address) {
      known.current = {
        addr: address,
        keys: new Set(hist.data.items.map((i) => receiptKey(address, i))),
      };
      return;
    }
    const fresh = newReceipts(address, hist.data.items, known.current.keys);
    if (!fresh.length) return;
    fresh.forEach((i) => known.current!.keys.add(receiptKey(address, i)));
    success();
    flyCoin('in', 'lyx', fresh.length === 1 ? `+${niceLyx(fresh[0].amountLyx)} LYX` : undefined);
    toast(
      fresh.length === 1
        ? `Received ${niceLyx(fresh[0].amountLyx)} LYX`
        : `Received ${fresh.length} payments`,
      "receive",
    );
    markReceiptsSeen(fresh.map((i) => receiptKey(address, i))).catch(() => {});
    fresh.forEach((i) => addInbox({ id: `rx:${receiptKey(address, i)}`, kind: "receive", title: `Received ${niceLyx(i.amountLyx)} LYX`, body: i.from ? `From ${shortAddr(i.from, 10, 6)}.` : "A payment arrived.", route: "/(tabs)/activity" }).catch(() => {}));
  }, [hist.data, address]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (id: string) => router.push(id === "sol" || id === "trx" ? `/xcoin/${id}` : `/coin/${id}`);
  const [front, setFront] = useState(0);
  const [add, setAdd] = useState(false);
  const unread = unreadCount(useInbox());
  const ethNetCount = ethNetChoices(chainCfg.allowMainnet).length;
  const note = (tag?: string) => (tag ? "Testnet · no market value" : "");
  const deck: { id: string; c: NeonData }[] = [
    { id: "lyx", c: { rim: "lyx", title: "LOKYX", sub: coins.lyx.sub, balance: coins.lyx.balance, unit: coins.lyx.unit, note: "Testnet · no market value", mark: { kind: "lyx" } } },
    { id: "btc", c: { rim: "btc", title: "Bitcoin", sub: coins.btc.sub, balance: coins.btc.balance, unit: coins.btc.unit, note: note(coins.btc.tag), mark: { kind: "logo", id: "btc" } } },
    { id: "eth", c: { rim: "eth", title: "Ethereum", sub: `${netName(ethNet)} · ${ethNetCount} networks`, balance: coins.eth.balance, unit: coins.eth.unit, note: note(coins.eth.tag), mark: { kind: "logo", id: "eth" } } },
    ...coins.extra.map((x) => ({ id: x, c: { rim: x, title: coins[x].title, sub: coins[x].address ? coins[x].sub : "Tap to set up", balance: coins[x].address ? coins[x].balance : "—", unit: coins[x].unit, note: note(coins[x].tag || "t"), mark: { kind: "logo" as const, id: x } } })),
  ];
  const frontId = deck[Math.min(front, deck.length - 1)].id;
  const nets = activeNets();
  const btcH = useAsync(async () => (frontId === "btc" && coins.btc.address ? btcHistory(nets.btc, coins.btc.address) : null), [frontId, coins.btc.address, nets.btc], 60_000);
  const xH = useAsync(
    async () => (frontId === "sol" && coins.sol.address ? (await solHistory(nets.sol, coins.sol.address, 4)).map((r) => ({ ...r, other: "" })) : frontId === "trx" && coins.trx.address ? tronHistory(nets.trx, coins.trx.address) : null),
    [frontId, coins.sol.address, coins.trx.address, nets.sol, nets.trx],
    60_000,
  );
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: 16,
        }}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={refresh}
            tintColor={C.sub}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            height: 52,
            paddingHorizontal: 4,
          }}
        >
          <Press
            onPress={() => router.push("/accounts")}
            accessibilityLabel="Switch account"
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <MarkDraw size={34} delay={250} />
            <View>
              <T v="caption" dim>
                {greeting()}
              </T>
              <T
                style={{
                  fontFamily: F.semibold,
                  fontSize: 17,
                  letterSpacing: -0.3,
                }}
              >
                {me?.name}
              </T>
            </View>
          </Press>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Press
              onPress={() => router.push("/(tabs)/notifications")}
              accessibilityLabel="Notifications"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.08)",
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.14)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="bell" size={19} color={C.text} width={1.9} />
              {unread > 0 ? <View style={{ position: "absolute", top: 8, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: C.bad, borderWidth: 1.5, borderColor: C.bg }} /> : null}
            </Press>
            <Press
              onPress={() => setAdd(true)}
              accessibilityLabel="Add a blockchain"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.08)",
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.14)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="plus" size={19} color={C.text} width={1.9} />
            </Press>
          </View>
        </View>

        <Animated.View style={[{ marginTop: 6, zIndex: 2 }, cardDepth]}>
          <CardCarousel
            width={cw - 24}
            height={196}
            index={front}
            onIndex={setFront}
            cards={deck.map((d) => (
              <Press key={d.id} onPress={() => open(d.id)} scaleTo={0.985} accessibilityLabel={`${d.c.title} card`}>
                <NeonCard c={d.c} width={cw - 24} height={196} hide={hide} />
              </Press>
            ))}
          />
        </Animated.View>

        <ActionRow
          items={[
            { icon: "send", label: "Send", onPress: () => router.push(frontId === "lyx" ? "/send" : frontId === "sol" || frontId === "trx" ? (coins[frontId].address ? `/xsend?chain=${frontId}` : `/xcoin/${frontId}`) : `/chain/send?chain=${frontId}`) },
            { icon: "receive", label: "Receive", onPress: () => router.push(frontId === "lyx" ? "/ring" : frontId === "sol" || frontId === "trx" ? `/xcoin/${frontId}` : `/receive?coin=${frontId}`) },
            { icon: "scan", label: "Scan", onPress: () => router.push("/ring?mode=scan") },
            { icon: "swap", label: "Swap", onPress: () => router.push("/swap") },
          ]}
        />

        {chainError ? (
          <Animated.View
            entering={FadeInDown.duration(DUR.base).easing(EASE_OUT)}
            style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: C.fill, borderWidth: 0.5, borderColor: C.line2 }}
          >
            <Icon name="info" size={18} color={C.sub} width={1.9} />
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: F.semibold, fontSize: 14.5 }}>You're offline</T>
              <T v="caption" dim>Balances may be out of date. They update when you're back.</T>
            </View>
          </Animated.View>
        ) : null}
        {coins.addressError ? (
          <Banner
            title="Your Bitcoin and Ethereum addresses are not ready"
            sub={`${coins.addressError}. Tap to try again.`}
            onPress={coins.retry}
          />
        ) : null}
        {backupDue && (
          <Banner
            title="Check your backup"
            sub="Three questions to prove your 24 words still work."
            onPress={() => router.push("/backup-check")}
          />
        )}
        {readyCaps.length > 0 && (
          <Press
            onPress={() => router.push(`/capsule/${readyCaps[0].address}`)}
            scaleTo={0.985}
            style={{
              marginTop: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              padding: 14,
              borderRadius: 20,
              backgroundColor: "#101633",
              borderWidth: 1,
              borderColor: "#24306A",
            }}
          >
            <View style={{ transform: [{ rotate: "-18deg" }] }}>
              <CapsuleShape w={36} h={17} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontFamily: F.semibold, fontSize: 15.5 }}>
                A time capsule is ready
              </T>
              <T v="caption" color={PLANET.light}>
                Today's the day. Tap to open it.
              </T>
            </View>
          </Press>
        )}

        {frontId === "lyx" ? (
          <View style={{ paddingTop: 26 }}>
            <SectionHead title="RECENT" action="See all" onAction={() => router.push("/(tabs)/activity")} />
            {(hist.data?.items ?? []).slice(0, 3).map((it, i) => (
              <ActivityRow key={i} item={it} i={i} hide={hide} />
            ))}
            {!(hist.data?.items ?? []).length ? <T v="caption" dim style={{ paddingHorizontal: 6, paddingTop: 6 }}>Nothing yet. Payments you send and receive show here.</T> : null}
          </View>
        ) : null}
        {frontId === "btc" ? (
          <View style={{ paddingTop: 26 }}>
            <SectionHead title="RECENT" action="See all" onAction={() => open("btc")} />
            {(btcH.data ?? []).slice(0, 4).map((r) => (
              <PayRow key={r.txid} title={r.delta >= 0n ? "Received" : "Sent"} when={r.time ? timeAgo(r.time) : "Waiting for a block"} amount={formatBtc(r.delta < 0n ? -r.delta : r.delta)} unit={coins.btc.unit} incoming={r.delta >= 0n} hide={hide} />
            ))}
            {!(btcH.data ?? []).length ? <T v="caption" dim style={{ paddingHorizontal: 6, paddingTop: 6 }}>{btcH.error ? "Can't reach the Bitcoin network right now." : btcH.data ? "Nothing yet. Bitcoin you send and receive shows here." : "Loading…"}</T> : null}
          </View>
        ) : null}
        {frontId === "eth" || frontId.startsWith("0x") ? (
          <View style={{ paddingTop: 26 }}>
            <SectionHead title="NETWORKS · ONE ADDRESS" />
            <EthNets net={ethNet} allowMainnet={chainCfg.allowMainnet} onNet={(n) => updateChains({ ethNet: n })} />
            <View style={{ paddingTop: 26 }}>
              <SectionHead title={`ON ${netName(ethNet).toUpperCase()}`} action="Add token" onAction={() => router.push("/coins")} />
              {coins.tokens.map((t) => (
                <TokenRow key={t.contract} name={t.name} symbol={t.symbol} balance={t.balance} logo={t.logo} seed={t.contract} hide={hide} onPress={() => open(t.contract)} />
              ))}
              {!coins.tokens.length ? <T v="caption" dim style={{ paddingHorizontal: 6 }}>No tokens yet. Add USDC, USDT or any token on this network.</T> : null}
            </View>
          </View>
        ) : null}
        {frontId === "sol" || frontId === "trx" ? (
          coins[frontId].address ? (
            <View style={{ paddingTop: 26 }}>
              <SectionHead title={`TOKENS ON ${coins[frontId].title.toUpperCase()}`} action="Open" onAction={() => open(frontId)} />
              {coins.xTokens[frontId].map((t) => (
                <TokenRow key={t.id} name={t.name} symbol={t.symbol} balance={t.balance} logo={t.logo} seed={t.id} hide={hide} />
              ))}
              {!coins.xTokens[frontId].length ? <T v="caption" dim style={{ paddingHorizontal: 6, paddingBottom: 4 }}>{frontId === "sol" ? "Tokens you hold on Solana show here." : "USDT and other tokens you hold on Tron show here."}</T> : null}
              <View style={{ paddingTop: 26 }}>
                <SectionHead title="RECENT" action="See all" onAction={() => open(frontId)} />
                {(xH.data ?? []).slice(0, 4).map((r) => (
                  <PayRow key={r.id} title={r.delta >= 0n ? (r.other ? `From ${shortAddr(r.other, 4, 4)}` : "Received") : r.other ? `To ${shortAddr(r.other, 4, 4)}` : "Sent"} when={r.time ? timeAgo(r.time) : "Pending"} amount={formatUnits(r.delta < 0n ? -r.delta : r.delta, frontId === "sol" ? SOL_DECIMALS : TRX_DECIMALS, 4)} unit={coins[frontId].unit} incoming={r.delta >= 0n} failed={r.failed} hide={hide} />
                ))}
                {!(xH.data ?? []).length ? <T v="caption" dim style={{ paddingHorizontal: 6, paddingTop: 6 }}>{xH.error ? "Can't reach the network right now." : xH.data ? "Nothing yet." : "Loading…"}</T> : null}
              </View>
            </View>
          ) : (
            <View style={{ paddingTop: 26, paddingHorizontal: 6, gap: 12 }}>
              <T v="sub" dim style={{ lineHeight: 21 }}>{`Your ${coins[frontId].title} address comes from the same 24 words. Set it up once to see your balance.`}</T>
              <Press onPress={() => open(frontId)} style={{ height: 50, borderRadius: 25, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
                <T style={{ fontFamily: F.semibold, fontSize: 15.5, color: C.inkText }}>{`Set up ${coins[frontId].title}`}</T>
              </Press>
            </View>
          )
        ) : null}
      </Animated.ScrollView>
      <Sheet open={add} onClose={() => setAdd(false)}>
        <View style={{ gap: 6 }}>
          <T v="headline">Add a blockchain</T>
          <T v="caption" dim style={{ paddingBottom: 10 }}>Each blockchain becomes a card on Home. Ethereum-style networks like Base, Arbitrum, Polygon and BNB live inside the Ethereum card.</T>
          {([{ id: "sol", n: "Solana", s: "SOL · devnet" }, { id: "trx", n: "Tron", s: "TRX · Nile testnet" }] as const).map((b) => {
            const on = coins.extra.includes(b.id);
            return (
              <Press key={b.id} haptic={false} onPress={() => updateChains({ extra: on ? coins.extra.filter((x) => x !== b.id) : [...coins.extra, b.id] })} style={{ flexDirection: "row", alignItems: "center", gap: 14, height: 58 }}>
                <Logo id={b.id} size={38} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: F.medium, fontSize: 16 }}>{b.n}</T>
                  <T v="caption" dim>{b.s}</T>
                </View>
                <T style={{ fontFamily: F.medium, fontSize: 14.5, color: on ? C.sub : C.text }}>{on ? "On Home · Remove" : "Add"}</T>
              </Press>
            );
          })}
          <Press onPress={() => { setAdd(false); router.push("/coins"); }} scaleTo={0.985} style={{ flexDirection: "row", alignItems: "center", gap: 14, height: 58 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.fill2, alignItems: "center", justifyContent: "center" }}>
              <Icon name="plus" size={18} color={C.text} width={2} />
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: F.medium, fontSize: 16 }}>Add a coin or token</T>
              <T v="caption" dim>USDC, USDT or another token</T>
            </View>
            <Icon name="chevron" size={16} color={C.faint} width={2.2} />
          </Press>
        </View>
      </Sheet>
    </View>
  );
}
