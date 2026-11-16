import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { T } from '../../ui/Text';
import { Button, Group, Note, Row, Screen, Press, success } from '../../ui/controls';
import { Qr } from '../../ui/Qr';
import { ChainRing } from '../../ui/ChainRing';
import { Segmented } from '../../ui/Segmented';
import { chainToSun } from '../../lib/chain-sun';
import { C } from '../../ui/theme';
import { ensureAddresses, btcBalance, btcHistory, ethBalance, tokenBalance, tokensFor, useAsync, useChainSettings, activeNets } from '../../lib/multichain';
import { BTC_NETS, ETH_NETS, formatBtc, formatUnits } from '../../lib/multichain-core';
import { shortAddr } from '../../lib/format';

/** One chain: its address with a QR code, balance, history, and Send. */
export default function Chain() {
  const { chain } = useLocalSearchParams<{ chain: 'btc' | 'eth' }>();
  useChainSettings();
  const nets = activeNets();
  const isBtc = chain === 'btc';
  const a = useAsync(() => ensureAddresses(), []);
  const addr = a.data ? (isBtc ? a.data.btc[nets.btc] : a.data.eth) : '';
  const meta = isBtc ? BTC_NETS[nets.btc] : ETH_NETS[nets.eth];
  const bal = useAsync(async () => {
    if (!addr) return null;
    if (isBtc) return { main: (await btcBalance(nets.btc, addr)).confirmed, tokens: [] as { symbol: string; contract: string; v: string }[] };
    const main = await ethBalance(nets.eth, addr);
    const tokens = await Promise.all(tokensFor(nets.eth).map(async (t) => ({ symbol: t.symbol, contract: t.contract, v: formatUnits(await tokenBalance(nets.eth, t, addr), t.decimals) })));
    return { main, tokens };
  }, [addr, chain], 20_000);
  const hist = useAsync(async () => (isBtc && addr ? btcHistory(nets.btc, addr) : []), [addr, chain], 30_000);
  const [view, setView] = useState<'ring' | 'qr'>('ring');
  const ringable = !!addr && !!chainToSun(isBtc ? 'btc' : 'eth', addr);
  const copy = async () => {
    await Clipboard.setStringAsync(addr);
    success();
  };

  return (
    <Screen title={meta.label} large>
      <Note>{meta.real ? 'Real money.' : 'A test network: these coins have no value.'} The address below is made from your 24 words, so the same words bring it back.</Note>
      {addr ? (
        <View style={{ alignItems: 'center', gap: 14 }}>
          {ringable && view === 'ring' ? (
            <ChainRing chain={isBtc ? 'btc' : 'eth'} address={addr} size={260} />
          ) : (
            <View style={{ padding: 10, backgroundColor: '#fff', borderRadius: 18 }}>
              <Qr value={isBtc ? `bitcoin:${addr}` : addr} />
            </View>
          )}
          {ringable && (
            <View style={{ alignSelf: 'stretch' }}>
              <Segmented<'ring' | 'qr'> value={view} onChange={setView} options={[['ring', 'Ring'], ['qr', 'QR for other wallets']]} />
            </View>
          )}
          <Press onPress={copy} style={{ flexDirection: 'row', gap: 8 }}>
            <T v="mono" color={C.soft} selectable>{addr}</T>
          </Press>
          <T v="caption" dim>{view === 'ring' && ringable ? 'The LOKYX wallet reads the ring; other wallets need the QR. Tap the address to copy it.' : 'Tap the address to copy it'}</T>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Note>{a.error ? 'Your address needs your fingerprint, face or passcode once. Then it is remembered.' : 'Preparing your address…'}</Note>
          {a.error ? <Button title="Try again" onPress={() => a.refresh()} /> : null}
        </View>
      )}
      <Group title="Balance">
        <Row title={meta.unit} detail={bal.data ? (isBtc ? formatBtc(bal.data.main) : formatUnits(bal.data.main, 18, 8)) : '…'} onPress={() => router.push(`/chain/send?chain=${chain}`)} />
        {bal.data?.tokens.map((t) => (
          <Row key={t.contract} title={t.symbol} sub={`Contract ${shortAddr(t.contract, 8, 6)}`} detail={t.v} onPress={() => router.push(`/chain/send?chain=eth&token=${t.contract}`)} />
        ))}
      </Group>
      {bal.error ? <Note>{bal.error}</Note> : null}
      <Button title={`Send ${meta.unit}`} disabled={!addr} onPress={() => router.push(`/chain/send?chain=${chain}`)} />
      {!isBtc && <Button title="Add a token by contract address" kind="line" onPress={() => router.push('/chain/add-token')} />}
      {!isBtc && <Button title="Vault protection (experimental)" kind="line" onPress={() => router.push('/ethvault')} />}
      {isBtc && hist.data && hist.data.length > 0 && (
        <Group title="Recent">
          {hist.data.slice(0, 8).map((t) => (
            <Row key={t.txid} title={t.delta >= 0n ? 'Received' : 'Sent'} sub={`${t.confirmed ? 'Confirmed' : 'Waiting for a block'} · ${shortAddr(t.txid, 8, 6)}`} detail={`${t.delta >= 0n ? '+' : ''}${formatBtc(t.delta < 0n ? -t.delta : t.delta)}`} />
          ))}
        </Group>
      )}
    </Screen>
  );
}
