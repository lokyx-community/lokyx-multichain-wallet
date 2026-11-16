import { Alert, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import Animated, { FadeIn } from 'react-native-reanimated';
import { T } from '../../ui/Text';
import { Group, Press, Row, success } from '../../ui/controls';
import { Avatar } from '../../ui/RingCode';
import { Icon } from '../../ui/Icon';
import { toast } from '../../ui/Toast';
import { C } from '../../ui/theme';
import { lock, useAccountRef, useWallet, wipe } from '../../lib/wallet';
import { resetCapsules } from '../../lib/capsules';
import { resetData, useContacts } from '../../lib/data';
import { useNodeUrl } from '../../lib/rpc';
import { confirmIt } from '../../lib/auth';
import { shortAddr } from '../../lib/format';

export default function You() {
  const insets = useSafeAreaInsets();
  const me = useAccountRef();
  const w = useWallet();
  const people = useContacts();
  const node = useNodeUrl();

  const remove = () => {
    const go = async () => {
      if (!(await confirmIt('Remove the wallet from this phone'))) return;
      await wipe();
      resetData();
      resetCapsules();
    };
    const msg = "Your LYX stays on the network, but this phone forgets the wallet. You'll need your 24 words to get back in.";
    if (Platform.OS === 'web') {
      if (confirm(msg)) go();
    } else
      Alert.alert('Remove this wallet?', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: go },
      ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: insets.bottom + 130, gap: 22 }}>
      <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: 12, paddingVertical: 14 }}>
        <Avatar address={me?.address} size={84} />
        <T v="title">{me?.name}</T>
        <Press
          onPress={async () => {
            await Clipboard.setStringAsync(me?.address ?? '');
            success();
            toast('Address copied', 'copy');
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: C.fill }}
        >
          <T v="mono" color={C.soft}>{shortAddr(me?.address ?? '', 10, 6)}</T>
          <Icon name="copy" size={15} color={C.sub} />
        </Press>
      </Animated.View>

      <Group>
        <Row icon="people" title="Accounts" sub="Switch or add one" detail={String(w.accounts.length)} onPress={() => router.push('/accounts')} />
        <Row icon="eye" title="Watching" sub="Follow an address, no key" onPress={() => router.push('/watch')} />
        <Row icon="person" title="People" sub="Names for addresses you use" detail={people.length ? String(people.length) : undefined} onPress={() => router.push('/contacts')} />
        <Row icon="words" title="Recovery words" sub="Your 24 words, shown once you unlock" onPress={() => router.push('/backup')} />
      </Group>

      <Group>
        <Row icon="lock" title="Vault" sub="A daily limit, a delay on big sends" onPress={() => router.push('/vault')} />
        <Row icon="globe" title="Bitcoin and Ethereum" sub="Test networks, endpoints" onPress={() => router.push('/chains-settings')} />
        <Row icon="shield" title="Security" sub="Face ID, fingerprint and passcode" onPress={() => router.push('/security')} />
        <Row icon="server" title="Network" detail={node.replace(/^https?:\/\//, '').replace(/\/rpc$/, '')} onPress={() => router.push('/node')} />
      </Group>

      <Group>
        <Row icon="lock" title="Lock now" sub="Ask for your passcode again" onPress={lock} />
        <Row icon="trash" title="Remove from this phone" sub="Your 24 words bring it back" danger onPress={remove} />
      </Group>

      <View style={{ alignItems: 'center', gap: 4, paddingTop: 6 }}>
        <T v="caption" color={C.faint}>LOKYX Wallet {Constants.expoConfig?.version ?? ''}{process.env.EXPO_PUBLIC_BUILD ? ` · build ${process.env.EXPO_PUBLIC_BUILD.slice(0, 7)}` : ''}</T>
        <T v="caption" color={C.faint}>Your keys never leave this phone.</T>
      </View>
    </ScrollView>
  );
}
