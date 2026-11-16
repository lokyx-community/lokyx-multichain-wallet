import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { base64 } from '@scure/base';
import { T } from '../ui/Text';
import { Button, ErrorText, Field, Note, Screen, failure, success } from '../ui/controls';
import { BreathingMark } from '../ui/RingCode';
import { Icon } from '../ui/Icon';
import { C, F } from '../ui/theme';
import { rpc, type GasEstimate } from '../lib/rpc';
import { bytesToHex, hexToBytes } from '../lib/lokyx';
import { TOKEN_ABI, TOKEN_WASM } from '../lib/contracts';
import { currentAddress, sendContract } from '../lib/wallet';
import { addPending, amountText, parseUnits, resolveDeploy, tokens } from '../lib/data';
import { confirmIt } from '../lib/auth';
import { niceLyx, shortAddr } from '../lib/format';
import { ContractsOnly } from '../ui/ContractsOnly';
import { DUR, EASE_OUT } from '../ui/motion';

const CODE = base64.decode(TOKEN_WASM);

function MakeToken() {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('1000000');
  const [gas, setGas] = useState<GasEstimate | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState('');
  const [made, setMade] = useState('');

  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  let units = 0n;
  try {
    units = supply ? parseUnits(supply, 18) : 0n;
  } catch {
    units = 0n;
  }
  const ready = name.trim().length > 1 && sym.length >= 2 && units > 0n;
  const args = [name.trim(), sym, amountText(units)];

  // try it against the chain while they type, for the fee
  useEffect(() => {
    if (!ready) return setGas(null);
    const t = setTimeout(() => {
      rpc<GasEstimate>('lyx_estimateGas', { from: currentAddress(), code: bytesToHex(CODE), abi: TOKEN_ABI, args })
        .then((g) => {
          setGas(g);
          setErr(g.ok ? '' : g.error ?? "This token can't be made");
        })
        .catch((e) => setErr(e.message));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, sym, supply, ready]);

  // wait for the block, then follow the new token
  useEffect(() => {
    if (!tx || made) return;
    const t = setInterval(async () => {
      const a = await resolveDeploy(tx);
      if (a === '') {
        clearInterval(t);
        setErr("The network didn't accept it. Nothing was made, and only gas was used.");
        setTx('');
        setBusy(false);
      } else if (a) {
        clearInterval(t);
        await tokens.save((x) => [...x.filter((y) => y.address !== a), { address: a, name: name.trim(), symbol: sym, decimals: 18 }]);
        success();
        setMade(a);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [tx, made, name, sym]);

  const go = async () => {
    if (!gas?.ok) return;
    if (!(await confirmIt(`Make ${sym}`))) return;
    setBusy(true);
    setErr('');
    try {
      const input = await rpc<string>('lyx_encodeDeploy', { abi: TOKEN_ABI, args });
      const h = await sendContract({ kind: 'deploy', code: CODE, abi: TOKEN_ABI, input: hexToBytes(input.replace(/^0x/, '')), gas: BigInt(gas.gasLimit) }, '');
      await addPending({ hash: h, from: currentAddress(), to: '', amount: '', what: 'deploy', at: Date.now() });
      setTx(h);
    } catch (e) {
      failure();
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  if (made)
    return (
      <Screen title="" close>
        <View style={{ alignItems: 'center', gap: 22, paddingTop: 40 }}>
          <Animated.View entering={FadeIn.duration(DUR.base).easing(EASE_OUT)} style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontFamily: F.semibold, fontSize: 30, color: C.inkText, letterSpacing: -1 }}>{sym}</T>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(200).duration(DUR.base).easing(EASE_OUT)} style={{ alignItems: 'center', gap: 8 }}>
            <T v="display">{name.trim()} is live</T>
            <Note center>All {supply} {sym} are in your wallet. Send some to a friend; they add it with this address.</Note>
            <T v="mono" color={C.soft}>{shortAddr(made, 12, 8)}</T>
          </Animated.View>
        </View>
        <Button title={`Send ${sym}`} onPress={() => router.replace(`/send?token=${made}`)} style={{ marginTop: 20 }} />
        <Button title="Lock the team's share" kind="line" onPress={() => router.replace(`/token/locks?token=${made}`)} />
        <Button title="Done" kind="plain" onPress={() => router.back()} />
      </Screen>
    );

  if (tx)
    return (
      <Screen title="" back={false}>
        <View style={{ alignItems: 'center', gap: 22, paddingTop: 100 }}>
          <BreathingMark size={72} />
          <T v="title">Making {sym}</T>
          <Note center>It goes in the next block, usually within a minute. You can leave this screen; it'll show up on Home.</Note>
          <Button title="Leave it running" kind="line" onPress={() => router.back()} />
        </View>
      </Screen>
    );

  return (
    <Screen title="Make a token">
      <Animated.View entering={FadeIn} style={{ alignItems: 'center', paddingVertical: 12, gap: 12 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: sym ? C.ink : C.fill, alignItems: 'center', justifyContent: 'center' }}>
          {sym ? <T style={{ fontFamily: F.semibold, fontSize: sym.length > 4 ? 18 : 24, color: C.inkText, letterSpacing: -0.6 }}>{sym}</T> : <Icon name="plus" size={36} color={C.sub} />}
        </View>
        <T v="headline">{name.trim() || 'Your token'}</T>
      </Animated.View>
      <View style={{ gap: 10 }}>
        <Field value={name} onChangeText={setName} placeholder="Name, like Garden Club Points" maxLength={32} />
        <Field value={symbol} onChangeText={setSymbol} placeholder="Short name, like GCP" autoCapitalize="characters" autoCorrect={false} maxLength={8} />
        <Field value={supply} onChangeText={(s) => setSupply(s.replace(/[^\d.]/g, ''))} placeholder="How many to make" keyboardType="decimal-pad" />
      </View>
      <Note>All of them start in your wallet. Nobody can make more later, not even you.</Note>
      {gas?.ok && <T v="sub" dim>Network fee, at most {niceLyx(gas.maxGasFeeLyx, 6)} LYX. Unused gas comes back.</T>}
      <ErrorText>{err}</ErrorText>
      <Button title={`Make ${sym || 'it'}`} disabled={!ready || !gas?.ok} busy={busy} onPress={go} />
    </Screen>
  );
}

export default function MakeTokenGate() {
  return (
    <ContractsOnly>
      <MakeToken />
    </ContractsOnly>
  );
}
