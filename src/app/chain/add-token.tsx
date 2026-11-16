import { useState } from 'react';
import { router } from 'expo-router';
import { Button, ErrorText, Field, Note, Screen, success } from '../../ui/controls';
import { T } from '../../ui/Text';
import { activeNets, addToken, lookupToken } from '../../lib/multichain';
import { ethAddressOk, type EthToken } from '../../lib/multichain-core';

/** Tokens are found by contract address. The name shown is read from the contract, so check the address itself. */
export default function AddToken() {
  const [c, setC] = useState('');
  const [t, setT] = useState<EthToken | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const look = async () => {
    setErr('');
    setBusy(true);
    try {
      setT(await lookupToken(activeNets().eth, c.trim()));
    } catch (e) {
      setErr("Couldn't read a token at that address on this network.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Add a token" large>
      <Note>Paste the token's contract address from the issuer's own website. Anyone can make a token called USDC, so the address is what counts, not the name.</Note>
      <Field value={c} onChangeText={(x) => { setC(x); setT(null); }} placeholder="0x… contract address" autoCapitalize="none" autoCorrect={false} mono />
      <ErrorText>{err}</ErrorText>
      {t ? (
        <>
          <T v="callout">{t.symbol} · {t.decimals} decimals</T>
          <T v="mono" dim selectable>{t.contract}</T>
          <Button title="Add it" onPress={async () => { await addToken(t); success(); router.back(); }} />
        </>
      ) : (
        <Button title="Look it up" busy={busy} disabled={!ethAddressOk(c)} onPress={look} />
      )}
    </Screen>
  );
}
