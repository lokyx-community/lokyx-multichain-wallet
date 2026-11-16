import { useEffect, useRef, useState } from 'react';
import { flyCoin } from '../../ui/CoinFlight';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Icon } from '../../ui/Icon';
import { parsePayload } from '../../lib/scan-core';
import { router, useLocalSearchParams } from 'expo-router';
import { plainError } from '../../lib/plain-error';
import { T } from '../../ui/Text';
import { Button, ErrorText, Field, Note, Press, Screen, failure, success } from '../../ui/controls';
import { DestGuard } from '../../ui/DestGuard';
import { newDeviceGate } from '../../lib/guard';
import { Segmented } from '../../ui/Segmented';
import { ApproveButton } from '../../ui/ApproveButton';
import { C, F } from '../../ui/theme';
import { confirmIt } from '../../lib/auth';
import {
  activeNets, broadcastBtc, broadcastEth, btcBalance, btcTxBlock, ethBalance, tokenBalance, ensureAddresses, ethTxBlock, knownDestinations, prepareBtc, prepareEth, rememberDestination, tokensFor, useChainSettings,
} from '../../lib/multichain';
import { BTC_NETS, ETH_NETS, KNOWN_TOKENS, btcAddressOk, describeBtc, describeEth, ethAddressOk, formatBtc, formatUnits, parseBtc, parseUnits, tokenId, type Speed } from '../../lib/multichain-core';
import { SunFills } from '../../ui/SunFills';
import { useChainSun } from '../../ui/ChainRing';
import { CoinLogo } from '../../ui/CoinLogo';
import { STAGE_TEXT, type FillStage } from '../../lib/sunfill-core';

type Prepared =
  | { kind: 'btc'; lines: string[]; net: ReturnType<typeof activeNets>['btc']; hex: string; txid: string }
  | { kind: 'eth'; lines: string[]; net: ReturnType<typeof activeNets>['eth']; raw: string };

/** Send Bitcoin, Ether or an ERC-20 token. Shows what will happen in words before it can be signed. */
export default function ChainSend() {
  const { chain, token, to: toParam, amount: amtParam, units } = useLocalSearchParams<{ chain: 'btc' | 'eth'; token?: string; to?: string; amount?: string; units?: string }>();
  useChainSettings();
  const nets = activeNets();
  const isBtc = chain === 'btc';
  // a token in the wallet, or one from the token list (a scanned request can name either)
  const chainId = ETH_NETS[nets.eth].chainId;
  const tok = !isBtc && token ? [...tokensFor(nets.eth), ...KNOWN_TOKENS].find((t) => tokenId(t) === tokenId({ chainId, contract: token })) : undefined;
  const unknownToken = !isBtc && !!token && !tok;
  const unit = isBtc ? BTC_NETS[nets.btc].unit : tok ? tok.symbol : ETH_NETS[nets.eth].unit;
  const [to, setTo] = useState(toParam ?? '');
  const [amt, setAmt] = useState(() => {
    if (tok && units && /^\d+$/.test(units)) return formatUnits(BigInt(units), tok.decimals);
    return amtParam && /^\d*\.?\d+$/.test(amtParam) ? amtParam : '';
  });
  const [speed, setSpeed] = useState<Speed>('normal');
  const [known, setKnown] = useState<string[]>([]);
  const [own, setOwn] = useState('');
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<FillStage | null>(null);
  const [block, setBlock] = useState<number | null>(null);

  useEffect(() => {
    knownDestinations(chain).then(setKnown);
    ensureAddresses().then((a) => setOwn(isBtc ? a.btc[nets.btc] : a.eth)).catch(() => {});
  }, [chain, isBtc, nets.btc]);

  const dest = to.trim();
  const valid = isBtc ? btcAddressOk(dest, nets.btc) : ethAddressOk(dest);
  const [guardOk, setGuardOk] = useState(false);
  const allKnown = [...known, ...(own ? [own] : [])];

  const gateRef = useRef<{ ok: true; commit: () => Promise<void> } | null>(null);
  /** The two-day limit after restoring on a new phone, for this coin. */
  const ndGate = async () => {
    const mine = await ensureAddresses().catch(() => null);
    if (!mine) return { ok: true as const, commit: async () => {} };
    if (isBtc) {
      const value = parseBtc(amt);
      return newDeviceGate(`btc:${nets.btc}`, (await btcBalance(nets.btc, mine.btc[nets.btc])).confirmed, value, (v) => `${formatBtc(v)} BTC`);
    }
    const dec = tok ? tok.decimals : 18;
    const value = parseUnits(amt, dec);
    const bal = tok ? await tokenBalance(nets.eth, tok, mine.eth) : await ethBalance(nets.eth, mine.eth);
    return newDeviceGate(`eth:${ETH_NETS[nets.eth].chainId}:${tok ? tok.contract.toLowerCase() : 'native'}`, bal, value, (v) => `${formatUnits(v, dec, 6)} ${unit}`);
  };

  const review = async () => {
    setErr('');
    setBusy(true);
    try {
      if (!(await confirmIt('Prepare this payment'))) return;
      const gate = await ndGate();
      if (!gate.ok) return setErr(gate.message);
      gateRef.current = gate;
      if (isBtc) {
        const sats = parseBtc(amt);
        const p = await prepareBtc(dest, sats, speed);
        setPrep({ kind: 'btc', net: p.net, hex: p.signed.hex, txid: p.signed.txid, lines: describeBtc({ plan: p.signed.plan, to: dest, from: p.from, net: p.net, rate: p.rate }) });
      } else {
        const amount = parseUnits(amt, tok ? tok.decimals : 18);
        const p = await prepareEth(dest, amount, speed, tok);
        setPrep({ kind: 'eth', net: p.net, raw: p.signed.raw, lines: describeEth({ net: p.net, to: dest, amount, token: tok, gas: p.gas, fees: p.fees }) });
      }
    } catch (e) {
      failure();
      setErr(plainError(e));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!prep) return false;
    setStage('sending');
    try {
      const id = prep.kind === 'btc' ? await broadcastBtc(prep.net, prep.hex) : await broadcastEth(prep.net, prep.raw);
      await rememberDestination(chain, dest);
      await gateRef.current?.commit();
      success();
      flyCoin('out', chain === 'btc' ? 'btc' : 'eth');
      setStage('waiting');
      watch(prep, id);
      return true;
    } catch (e) {
      failure();
      setStage('failed');
      setErr(plainError(e));
      return false;
    }
  };

  // look for the block every 15 seconds while this screen is open
  const watch = (p: Prepared, id: string) => {
    let n = 0;
    const t = setInterval(async () => {
      if (++n > 240) return clearInterval(t);
      try {
        const b = p.kind === 'btc' ? await btcTxBlock(p.net, id) : await ethTxBlock(p.net, id);
        if (b != null) {
          clearInterval(t);
          setBlock(b);
          setStage('done');
          success();
        }
      } catch (e) {
        clearInterval(t);
        setErr(plainError(e));
        setStage('failed');
      }
    }, 15_000);
  };

  const scan = () => router.replace(`/ring?mode=scan&for=${chain}${token ? `&token=${token}` : ''}`);
  const paste = async () => {
    const t = (await Clipboard.getStringAsync()).trim();
    const f = parsePayload(t);
    if (f && f.chain === chain && !(f.token && token && f.token.toLowerCase() !== token.toLowerCase())) {
      setTo(f.address);
      if (f.amount) setAmt(f.amount);
      if (f.units && tok) setAmt(formatUnits(BigInt(f.units), tok.decimals));
    } else setTo(t);
    setPrep(null);
  };

  if (unknownToken)
    return (
      <Screen title="Send a token" large>
        <Note>{`This request is for a token that is not in your wallet (${token!.slice(0, 8)}…${token!.slice(-6)}). Add it from Home › Add first, then scan again.`}</Note>
        <Button title="Add a coin" onPress={() => router.replace('/coins')} />
      </Screen>
    );

  if (stage) return <Progress chain={chain} to={dest} amount={`${amt} ${unit}`} stage={stage} block={block} err={err} isBtc={isBtc} />;

  return (
    <Screen title={`Send ${unit}`} large>
      {!prep ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Press onPress={scan} accessibilityLabel="Scan a QR code" style={{ flex: 1, height: 52, borderRadius: 26, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="scan" size={19} color={C.inkText} width={2} />
              <T style={{ fontFamily: F.semibold, fontSize: 15.5, color: C.inkText }}>Scan</T>
            </Press>
            <Press onPress={paste} accessibilityLabel="Paste an address" style={{ flex: 1, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="copy" size={18} color={C.text} width={1.9} />
              <T style={{ fontFamily: F.semibold, fontSize: 15.5 }}>Paste</T>
            </Press>
          </View>
          <Field value={to} onChangeText={(t) => { setTo(t); setPrep(null); }} placeholder={isBtc ? (nets.btc === 'mainnet' ? 'or type bc1…' : 'or type tb1…') : 'or type 0x…'} autoCapitalize="none" autoCorrect={false} mono />
          <ErrorText>{dest && !valid ? `That is not a valid ${isBtc ? BTC_NETS[nets.btc].label : ETH_NETS[nets.eth].label} address.` : ''}</ErrorText>
          {dest && valid ? <DestGuard dest={dest} known={allKnown} onOk={setGuardOk} /> : null}
          <Field value={amt} onChangeText={(t) => { setAmt(t); setPrep(null); }} placeholder={`Amount in ${unit}`} keyboardType="decimal-pad" />
          <Segmented value={speed} options={[['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']]} onChange={setSpeed} />
          <ErrorText>{err}</ErrorText>
          <Button title="Review" busy={busy} disabled={!valid || !amt || !guardOk} onPress={review} />
        </>
      ) : (
        <>
          <View style={{ borderRadius: 20, backgroundColor: C.fill, padding: 16, gap: 8 }}>
            {prep.lines.map((l, i) => (
              <T key={i} v={i === 0 ? 'callout' : 'sub'} dim={i > 0} style={{ lineHeight: 20 }}>{l}</T>
            ))}
          </View>
          <ErrorText>{err}</ErrorText>
          <ApproveButton reason="Send this payment" onApproved={send} />
          <Button title="Change" kind="plain" onPress={() => setPrep(null)} />
          <Note>Transactions on Bitcoin and Ethereum cannot be undone.</Note>
        </>
      )}
    </Screen>
  );
}

/** After the slide: the recipient's own sun fills as the payment moves, then turns green in its block. */
function Progress({ chain, to, amount, stage, block, err, isBtc }: { chain: 'btc' | 'eth'; to: string; amount: string; stage: FillStage; block: number | null; err: string; isBtc: boolean }) {
  const size = 280;
  const art = useChainSun(chain, to, size);
  const caption =
    stage === 'done' ? `In block ${block?.toLocaleString('en-US')}.` : stage === 'failed' ? err || 'It did not go through. Nothing left your wallet.' : stage === 'waiting' ? `Accepted by the network. ${isBtc ? 'Usually about 10 minutes.' : 'Usually under a minute.'}` : '';
  return (
    <Screen title="" large>
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 8 }}>
        <T v="sub" dim>Sending to {to.slice(0, 8)}…{to.slice(-4)}</T>
        <T v="display">{amount}</T>
      </View>
      <View style={{ alignItems: 'center', paddingVertical: 12 }}>
        {art ? (
          <SunFills rays={art.each} frame={art.frame} frameStroke={art.frameStroke} stroke={art.stroke} size={size} stage={stage} centre={<CoinLogo chain={chain} size={size * 0.3} />} />
        ) : (
          <CoinLogo chain={chain} size={size * 0.4} />
        )}
      </View>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <T v="headline">{STAGE_TEXT[stage]}</T>
        <T v="sub" dim style={{ textAlign: 'center' }}>{caption}</T>
      </View>
      {(stage === 'done' || stage === 'failed' || stage === 'waiting') && <Button title="Done" kind={stage === 'waiting' ? 'line' : 'solid'} onPress={() => router.back()} />}
    </Screen>
  );
}
