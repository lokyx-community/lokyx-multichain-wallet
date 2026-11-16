import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { T } from './Text';
import { Button, Field } from './controls';
import { C, F } from './theme';
import { useProtection, useTrusted, destinationNow, trustAddress } from '../lib/guard';
import { TRUST_WAIT_MS, addressBlocks, addressRisk, canPay, tailMatches, TAIL, waitText } from '../lib/guard-core';

/** An address in groups of four, with the groups that differ from `other` picked out. */
function Blocks({ addr, other }: { addr: string; other?: string }) {
  const mine = addressBlocks(addr);
  const theirs = other ? addressBlocks(other) : [];
  return (
    <T v="mono" style={{ lineHeight: 22 }}>
      {mine.map((b, i) => (
        <T key={i} v="mono" color={other && theirs[i] !== b ? C.bad : C.text} style={other && theirs[i] !== b ? { fontFamily: F.semibold } : undefined}>
          {b}{' '}
        </T>
      ))}
    </T>
  );
}

/**
 * Sits under a destination. A new address waits 24 hours on the trusted list before it can be paid, and anything
 * the person has not paid before asks for the last characters typed back. Calls `onOk` with whether sending may go on.
 */
export function DestGuard({ dest, known, onOk }: { dest: string; known: string[]; onOk: (ok: boolean) => void }) {
  useTrusted();
  useProtection();
  const [typed, setTyped] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setTyped(''), [dest]);

  const state = destinationNow(dest, known, now);
  const risk = addressRisk(dest, known);
  const payable = canPay(state);
  const needTail = risk.risk !== 'same';
  const tailOk = !needTail || tailMatches(dest, typed);
  const ok = payable && tailOk;
  useEffect(() => onOk(ok), [ok, onOk]);

  if (risk.risk === 'same' && payable) return null;

  return (
    <View style={{ gap: 12, padding: 14, borderRadius: 18, backgroundColor: C.fill, borderWidth: 0.5, borderColor: risk.risk === 'lookalike' ? C.bad : C.line2 }}>
      {risk.risk === 'lookalike' ? (
        <>
          <T v="callout" color={C.bad}>This looks like an address you know, but it is different</T>
          <T v="caption" dim>Scammers copy the start and end of an address you have used. The parts that differ are marked.</T>
          <T v="caption" dim>You are about to pay</T>
          <Blocks addr={dest} other={risk.imitates} />
          <T v="caption" dim>The one you know</T>
          <Blocks addr={risk.imitates} other={dest} />
        </>
      ) : (
        <>
          <T v="callout">{risk.risk === 'new' ? 'You have not paid this address before' : 'Check this address'}</T>
          <Blocks addr={dest} />
        </>
      )}

      {state.state === 'new' && (
        <>
          <T v="sub" dim style={{ lineHeight: 20 }}>For your safety a new address can receive from this wallet {waitText(TRUST_WAIT_MS)} after you add it. If someone else is moving your money, that gives you time to notice.</T>
          <Button title={`Add to trusted list · ${waitText(TRUST_WAIT_MS)}`} kind="line" onPress={() => trustAddress(dest)} />
        </>
      )}
      {state.state === 'waiting' && <T v="callout">On your trusted list. Ready in {waitText(state.readyAt - now)}.</T>}

      {payable && needTail && (
        <>
          <T v="sub" dim>To be sure it is the right one, type the last {TAIL} characters.</T>
          <Field value={typed} onChangeText={setTyped} placeholder={`Last ${TAIL} characters`} autoCapitalize="none" autoCorrect={false} spellCheck={false} mono maxLength={TAIL + 2} />
        </>
      )}
    </View>
  );
}
