import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { T } from '../../ui/Text';
import { Button, ErrorText, Field, Note, Press, Screen, success } from '../../ui/controls';
import { C, F } from '../../ui/theme';
import { isAddress } from '../../lib/lokyx';
import { readToken, tokens, type Token } from '../../lib/data';
import { ContractsOnly } from '../../ui/ContractsOnly';
import { DUR, EASE_OUT } from '../../ui/motion';

function AddToken() {
  const [addr, setAddr] = useState('');
  const [found, setFound] = useState<Token | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const look = async (a: string) => {
    setAddr(a);
    setFound(null);
    setErr('');
    const t = a.trim().toLowerCase();
    if (!isAddress(t)) return;
    setBusy(true);
    try {
      setFound(await readToken(t));
    } catch (e) {
      setErr((e as Error).message.includes('no contract') ? 'Nothing lives at that address' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Add a token" large>
      <Note>Paste the token's contract address. Whoever made the token can give it to you.</Note>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field value={addr} onChangeText={look} placeholder="lyx1…" autoCapitalize="none" autoCorrect={false} mono style={{ flex: 1 }} />
        <Press onPress={async () => look((await Clipboard.getStringAsync()).trim())} style={{ height: 52, paddingHorizontal: 16, borderRadius: 16, backgroundColor: C.fill, justifyContent: 'center' }}>
          <T v="callout">Paste</T>
        </Press>
      </View>
      {found && (
        <Animated.View entering={FadeInDown.duration(DUR.base).easing(EASE_OUT)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: C.fill }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontFamily: F.semibold, fontSize: 13, color: C.inkText }}>{found.symbol.slice(0, 4)}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T v="headline">{found.name}</T>
            <T v="sub" dim>{found.symbol}</T>
          </View>
        </Animated.View>
      )}
      <ErrorText>{err}</ErrorText>
      <Button
        title={found ? `Add ${found.symbol}` : 'Add'}
        busy={busy}
        disabled={!found}
        onPress={async () => {
          if (!found) return;
          await tokens.save((x) => [...x.filter((t) => t.address !== found.address), found]);
          success();
          router.back();
        }}
      />
    </Screen>
  );
}

export default function AddTokenGate() {
  return (
    <ContractsOnly>
      <AddToken />
    </ContractsOnly>
  );
}
