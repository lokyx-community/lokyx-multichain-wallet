import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { T } from '../ui/Text';
import { Button, ErrorText, Field, Note, Screen, success } from '../ui/controls';
import { C } from '../ui/theme';
import { isMnemonic, normalizeMnemonic } from '../lib/lokyx';
import { createFromPhrase } from '../lib/wallet';
import { markNewDevice } from '../lib/guard';
import { ScreenGuard } from '../ui/ScreenGuard';
import { OpenBackup } from '../ui/BackupSheets';

export default function Restore() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [bk, setBk] = useState(false);
  const n = normalizeMnemonic(text).split(' ').filter(Boolean).length;

  const go = async () => {
    setErr('');
    if (!isMnemonic(text)) return setErr(n === 12 || n === 24 ? "One of those words is wrong, or they're out of order." : 'Enter all 12 or 24 words, with spaces between them.');
    setBusy(true);
    try {
      await createFromPhrase(text);
      await markNewDevice();
      success();
      router.replace('/secure');
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen title="" back>
      <ScreenGuard />
      <View style={{ gap: 10, paddingTop: 8 }}>
        <T v="display">Bring your wallet back</T>
        <Note>Type the 12 or 24 words you wrote down when you made it, in order.</Note>
      </View>
      <Button title="Use an encrypted backup instead" kind="line" onPress={() => setBk(true)} />
      <OpenBackup open={bk} onClose={() => setBk(false)} kind="wallet" onSecret={setText} />
      <Field value={text} onChangeText={setText} multiline autoCapitalize="none" autoCorrect={false} autoComplete="off" spellCheck={false} placeholder="word word word…" style={{ minHeight: 180, fontSize: 18, lineHeight: 28 }} />
      <T v="caption" color={n === 12 || n === 24 ? C.text : C.sub} style={{ alignSelf: 'flex-end' }}>
        {n} {n === 1 ? 'word' : 'words'}
      </T>
      <ErrorText>{err}</ErrorText>
      <Button title={busy ? 'Opening…' : 'Continue'} busy={busy} disabled={n < 12} onPress={go} />
    </Screen>
  );
}
