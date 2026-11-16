import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { T } from '../ui/Text';
import { Button, ErrorText, Note, Press, Screen, failure, success, tick } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { C, F } from '../ui/theme';
import { newMnemonic } from '../lib/lokyx';
import { WordGrid } from '../ui/WordGrid';
import { ScreenGuard } from '../ui/ScreenGuard';
import { createFromPhrase } from '../lib/wallet';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { DUR, EASE_OUT } from '../ui/motion';
import { choices, pickChecks } from '../lib/backup-check-core';

export default function Create() {
  const phrase = useMemo(() => newMnemonic(), []);
  const words = phrase.split(' ');
  const [step, setStep] = useState<'show' | 'check'>('show');
  const [shown, setShown] = useState(false);
  const checks = useMemo(() => pickChecks(words.length), [words.length]);
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const options = useMemo(() => choices(words[checks[at]], words, wordlist), [at, checks, words]);

  const choose = async (w: string) => {
    if (w !== words[checks[at]]) {
      failure();
      setErr(`That's not word ${checks[at] + 1}. Have another look at your list.`);
      return;
    }
    setErr('');
    tick();
    if (at < 2) return setAt(at + 1);
    setBusy(true);
    try {
      await createFromPhrase(phrase);
      success();
      router.replace('/secure');
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  if (step === 'check')
    return (
      <Screen title="" back>
      <ScreenGuard />
        <View style={{ gap: 10, paddingTop: 8 }}>
          <T v="display">Check your words</T>
          <Note>So we know they're written down right.</Note>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 8 }}>
          {checks.map((c, i) => (
            <View key={c} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= at ? C.text : C.line2 }} />
          ))}
        </View>
        <Animated.View key={at} entering={FadeInDown.duration(DUR.base).easing(EASE_OUT)} exiting={FadeOut.duration(120)} style={{ gap: 16 }}>
          <T v="title">Which is word {checks[at] + 1}?</T>
          <View style={{ gap: 10 }}>
            {options.map((w) => (
              <Press key={w} onPress={() => choose(w)} disabled={busy} style={{ height: 58, borderRadius: 18, backgroundColor: C.fill, justifyContent: 'center', paddingHorizontal: 20 }}>
                <T v="headline" style={{ fontFamily: F.medium }}>{w}</T>
              </Press>
            ))}
          </View>
        </Animated.View>
        <ErrorText>{err}</ErrorText>
        {busy && <Note center>Making your keys…</Note>}
      </Screen>
    );

  return (
    <Screen title="" back>
      <ScreenGuard />
      <View style={{ gap: 10, paddingTop: 8 }}>
        <T v="display">Your 24 words</T>
        <Note>These words are your wallet. Write them on paper, in order, and keep it somewhere safe. Anyone with them can take your LYX, and nobody can give them back to you if they're lost.</Note>
      </View>

      <View>
        <WordGrid words={words} shown={shown} />
        {!shown && (
          <Animated.View exiting={FadeOut.duration(200)} style={{ position: 'absolute', inset: 0, borderRadius: 20, backgroundColor: 'rgba(10,10,12,0.94)', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
            <Animated.View entering={FadeIn.duration(DUR.base).easing(EASE_OUT)}>
              <Icon name="eyeOff" size={30} color={C.text} />
            </Animated.View>
            <T v="callout" style={{ textAlign: 'center' }}>Make sure nobody can see your screen</T>
            <Press onPress={() => setShown(true)} style={{ paddingHorizontal: 22, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line2, justifyContent: 'center' }}>
              <T v="callout">Show my words</T>
            </Press>
          </Animated.View>
        )}
      </View>

      <View style={{ gap: 10, marginTop: 6 }}>
        {[
          ['Paper, not photos', 'Screenshots end up in cloud backups.'],
          ['Never type them into a website', 'LOKYX will never ask for them.'],
        ].map(([a, b]) => (
          <Animated.View entering={FadeIn.delay(300)} key={a} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.fill2, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              <Icon name="check" size={13} color={C.text} width={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="callout">{a}</T>
              <T v="sub" dim>{b}</T>
            </View>
          </Animated.View>
        ))}
      </View>

      <Button title="I've written them down" disabled={!shown} onPress={() => setStep('check')} style={{ marginTop: 8 }} />
    </Screen>
  );
}
