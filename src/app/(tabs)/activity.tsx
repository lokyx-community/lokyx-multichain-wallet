import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../ui/Text';
import { Segmented } from '../../ui/Segmented';
import { ActivityRow, FeedRow, PendingRow } from '../../ui/ActivityRow';
import { Press } from '../../ui/controls';
import { C, F } from '../../ui/theme';
import { SkeletonRows } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/EmptyState';
import { rpc, type History, type HistoryItem } from '../../lib/rpc';
import { useAccountRef, useWallet } from '../../lib/wallet';
import { usePending } from '../../lib/data';
import { dayLabel } from '../../lib/format';
import { useOtherFeed } from '../../lib/feed';
import { FEED_COINS, type FeedCoin, type FeedItem } from '../../lib/feed-core';

type Filter = 'all' | 'sent' | 'received' | 'mined';
type Row = { k: 'lyx'; it: HistoryItem; time: number } | { k: 'x'; it: FeedItem; time: number };
const kindOk = (kind: string, f: Filter) => f === 'all' || (f === 'sent' ? kind === 'sent' || kind === 'self' : kind === f);

export default function Activity() {
  const insets = useSafeAreaInsets();
  const me = useAccountRef();
  const hide = useWallet().settings.hideBalance;
  const pend = usePending();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [coin, setCoin] = useState<FeedCoin | 'all'>('all');
  const [pulling, setPulling] = useState(false);
  const other = useOtherFeed();

  const load = useCallback(
    async (before?: number) => {
      if (!me) return;
      setBusy(true);
      try {
        const h = await rpc<History>('lyx_getAddressHistory', { address: me.address, limit: 40, ...(before ? { before } : {}) });
        setItems((x) => (before ? [...x, ...h.items] : h.items));
        setNext(h.nextBefore);
        setErr('');
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [me],
  );

  useEffect(() => {
    setItems([]);
    load();
    const t = setInterval(() => load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  const sections = useMemo(() => {
    const rows: Row[] = [];
    if (coin === 'all' || coin === 'lyx') for (const it of items) if (kindOk(it.kind, filter)) rows.push({ k: 'lyx', it, time: it.timestamp });
    for (const it of other.data ?? []) if ((coin === 'all' || coin === it.coin) && kindOk(it.kind, filter)) rows.push({ k: 'x', it, time: it.time });
    rows.sort((a, b) => (b.time || Infinity) - (a.time || Infinity));
    const out: { title: string; data: Row[] }[] = [];
    for (const r of rows) {
      const d = r.time ? dayLabel(r.time) : 'Waiting';
      if (out.at(-1)?.title !== d) out.push({ title: d, data: [] });
      out.at(-1)!.data.push(r);
    }
    return out;
  }, [items, other.data, filter, coin]);
  const loading = busy || (!other.data && !other.error);
  const anyItems = items.length > 0 || (other.data ?? []).length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, gap: 16, paddingBottom: 8 }}>
        <T v="display">Activity</T>
        <Segmented<Filter> value={filter} onChange={setFilter} options={[['all', 'All'], ['sent', 'Sent'], ['received', 'Received'], ['mined', 'Mined']]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -20 }} contentInset={{ left: 20, right: 20 }}>
          <View style={{ width: 12 }} />
          {([{ id: 'all', name: 'All coins' }, ...FEED_COINS] as { id: FeedCoin | 'all'; name: string }[]).map((c) => (
            <Press key={c.id} onPress={() => setCoin(c.id)} accessibilityLabel={c.name} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: coin === c.id ? C.ink : C.fill2 }}>
              <T style={{ fontFamily: F.medium, fontSize: 13.5, color: coin === c.id ? C.inkText : C.soft }}>{c.name}</T>
            </Press>
          ))}
          <View style={{ width: 12 }} />
        </ScrollView>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(r, i) => (r.k === 'x' ? r.it.id : `${r.it.txHash ?? r.it.blockHash}${r.it.kind}${i}`)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 130 }}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            tintColor={C.sub}
            onRefresh={async () => {
              setPulling(true);
              await Promise.all([load(), other.refresh()]);
              setPulling(false);
            }}
          />
        }
        ListHeaderComponent={
          (coin === 'all' || coin === 'lyx') && (filter === 'all' || filter === 'sent') ? (
            <View>
              {pend.length > 0 && <T v="sub" dim style={{ paddingTop: 18, paddingBottom: 4 }}>Waiting</T>}
              {pend.map((p) => (
                <PendingRow key={p.hash} p={p} hide={hide} />
              ))}
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => <T v="sub" dim style={{ paddingTop: 22, paddingBottom: 4 }}>{section.title}</T>}
        renderItem={({ item, index }) => (item.k === 'lyx' ? <ActivityRow item={item.it} i={index} hide={hide} /> : <FeedRow item={item.it} i={index} hide={hide} />)}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (next && !busy && (coin === 'all' || coin === 'lyx')) load(next);
        }}
        ListFooterComponent={busy && anyItems ? <ActivityIndicator color={C.sub} style={{ padding: 20 }} /> : null}
        ListEmptyComponent={
          loading ? (
            <SkeletonRows />
          ) : err && !(other.data ?? []).length ? (
            <EmptyState icon="info" title="Can't reach the network" body="Check your connection. Pull down to try again." />
          ) : (
            <EmptyState icon="receive" title="No activity yet" body="Payments you send and receive will show up here." />
          )
        }
      />
    </View>
  );
}
