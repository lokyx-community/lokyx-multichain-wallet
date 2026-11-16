import { useMemo } from 'react';
import { usePoll, type Account } from './rpc';
import { useAccountRef, wallet } from './wallet';
import { useStore } from './store';
import { addrs as addrStore, activeNets, btcBalance, ensureAddresses, ethBalance, tokenBalance, tokensFor, useAsync, useChainSettings, useTokensStore } from './multichain';
import { BTC_NETS, ETH_NETS, formatBtc, formatUnits } from './multichain-core';
import { SOL_NETS, SOL_DECIMALS } from './sol-core';
import { TRON_NETS, TRX_DECIMALS } from './tron-core';
import { solBalance, solTokens, tronTokens, trxBalance, type XToken } from './xchains';
import { niceLyx } from './format';
import type { CardData } from '../ui/WalletCards';
import type { LogoId } from '../ui/logos';
import { logoFor } from '../ui/Logo';

export type CoinId = 'lyx' | 'btc' | 'eth';
export type XCoin = 'sol' | 'trx';

export interface Coins {
  lyx: CardData;
  btc: CardData & { logo: LogoId };
  eth: CardData & { logo: LogoId };
  /** ERC-20 tokens on the active Ethereum network, with their balances. */
  tokens: { symbol: string; name: string; contract: string; decimals: number; balance: string; raw: bigint | null; logo: LogoId | null }[];
  /** Solana and Tron, when added. `address` is empty until the words have been read once (older wallets). */
  sol: CardData & { logo: LogoId };
  trx: CardData & { logo: LogoId };
  xTokens: Record<XCoin, XToken[]>;
  extra: XCoin[];
  /** An address problem, in words, when Bitcoin or Ethereum addresses could not be made. */
  addressError: string;
  retry: () => void;
  refresh: () => Promise<void>;
}

/** Balances and addresses for every coin the wallet holds. One place, so Home and each coin's screen agree. */
export function useCoins(): Coins {
  const me = useAccountRef();
  const address = me?.address ?? '';
  const acct = usePoll<Account>('lyx_getAccount', address ? { address } : null, 5000);
  useChainSettings();
  useTokensStore();
  const nets = activeNets();
  const addrs = useAsync(async () => (wallet.get().exists ? ensureAddresses() : null), []);
  const btcAddr = addrs.data?.btc[nets.btc] ?? '';
  const ethAddr = addrs.data?.eth ?? '';
  const btcBal = useAsync(async () => (btcAddr ? btcBalance(nets.btc, btcAddr) : null), [btcAddr, nets.btc], 30_000);
  const ethBal = useAsync(async () => (ethAddr ? ethBalance(nets.eth, ethAddr) : null), [ethAddr, nets.eth], 30_000);
  const extra = useChainSettings().extra ?? [];
  const live = useStore(addrStore);
  const solAddr = extra.includes('sol') ? live?.sol ?? addrs.data?.sol ?? '' : '';
  const trxAddr = extra.includes('trx') ? live?.trx ?? addrs.data?.trx ?? '' : '';
  const solBal = useAsync(async () => (solAddr ? solBalance(nets.sol, solAddr) : null), [solAddr, nets.sol], 30_000);
  const trxBal = useAsync(async () => (trxAddr ? trxBalance(nets.trx, trxAddr) : null), [trxAddr, nets.trx], 30_000);
  const solTok = useAsync(async () => (solAddr ? solTokens(nets.sol, solAddr).catch(() => []) : []), [solAddr, nets.sol], 60_000);
  const trxTok = useAsync(async () => (trxAddr ? tronTokens(nets.trx, trxAddr).catch(() => []) : []), [trxAddr, nets.trx], 60_000);
  const tokenList = tokensFor(nets.eth);
  const tokBal = useAsync(
    async () => (ethAddr ? Promise.all(tokenList.map(async (t) => ({ t, v: await tokenBalance(nets.eth, t, ethAddr).catch(() => null) }))) : []),
    [ethAddr, nets.eth, tokenList.map((t) => t.contract).join(',')],
    30_000,
  );

  return useMemo<Coins>(
    () => ({
      lyx: { kind: 'lyx', title: 'LOKYX', sub: 'Testnet', unit: 'LYX', balance: acct.data ? niceLyx(acct.data.balanceLyx, 2) : '', address, tag: 'Tap to open' },
      btc: { kind: 'btc', logo: 'btc', title: 'Bitcoin', sub: BTC_NETS[nets.btc].label.replace(/^Bitcoin /, '').replace(/^./, (c) => c.toUpperCase()), unit: BTC_NETS[nets.btc].unit, balance: btcBal.data ? formatBtc(btcBal.data.confirmed) : '', address: btcAddr, tag: BTC_NETS[nets.btc].real ? '' : 'Test network' },
      eth: { kind: 'eth', logo: 'eth', title: 'Ethereum', sub: ETH_NETS[nets.eth].label.replace(/^Ethereum /, ''), unit: ETH_NETS[nets.eth].unit, balance: ethBal.data != null ? formatUnits(ethBal.data, 18, 4) : '', address: ethAddr, tag: ETH_NETS[nets.eth].real ? '' : 'Test network' },
      sol: { kind: 'gr', logo: 'sol', title: 'Solana', sub: SOL_NETS[nets.sol].short, unit: 'SOL', balance: solBal.data != null ? formatUnits(solBal.data, SOL_DECIMALS, 4) : '', address: solAddr, tag: SOL_NETS[nets.sol].real ? '' : 'Test network' },
      trx: { kind: 'gr', logo: 'trx', title: 'Tron', sub: TRON_NETS[nets.trx].short, unit: 'TRX', balance: trxBal.data != null ? formatUnits(trxBal.data, TRX_DECIMALS, 2) : '', address: trxAddr, tag: TRON_NETS[nets.trx].real ? '' : 'Test network' },
      xTokens: { sol: solTok.data ?? [], trx: trxTok.data ?? [] },
      extra,
      // a token shows the moment it is added, before its balance comes back
      tokens: tokenList.map((t) => {
        const v = tokBal.data?.find((x) => x.t.contract === t.contract)?.v ?? null;
        return { symbol: t.symbol, name: t.name ?? t.symbol, contract: t.contract, decimals: t.decimals, balance: v == null ? '' : formatUnits(v, t.decimals, 4), raw: v, logo: logoFor(t.symbol) };
      }),
      addressError: addrs.error,
      retry: () => addrs.refresh(),
      refresh: async () => {
        await Promise.all([acct.refresh(), btcBal.refresh(), ethBal.refresh(), tokBal.refresh(), solBal.refresh(), trxBal.refresh(), solTok.refresh(), trxTok.refresh()]);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, acct.data, btcAddr, btcBal.data, ethAddr, ethBal.data, tokBal.data, nets.btc, nets.eth, addrs.error, solAddr, trxAddr, solBal.data, trxBal.data, solTok.data, trxTok.data, nets.sol, nets.trx, extra.join(','), tokenList.map((t) => t.contract).join(',')],
  );
}
