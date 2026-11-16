import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { T } from '../ui/Text';
import { Button, ErrorText, Field, Note, Press, Screen, success } from '../ui/controls';
import { Sheet } from '../ui/Sheet';
import { Avatar } from '../ui/RingCode';
import { Icon } from '../ui/Icon';
import { C } from '../ui/theme';
import { contacts, useContacts, type Contact } from '../lib/data';
import { isAddress } from '../lib/lokyx';
import { shortAddr } from '../lib/format';
import { DUR, EASE_OUT } from '../ui/motion';

export default function Contacts() {
  const list = useContacts();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Contact | null>(null);
  const [name, setName] = useState('');
  const [addr, setAddr] = useState('');
  const [err, setErr] = useState('');

  const start = (c?: Contact) => {
    setEdit(c ?? null);
    setName(c?.name ?? '');
    setAddr(c?.address ?? '');
    setErr('');
    setOpen(true);
  };
  const save = async () => {
    const a = addr.trim().toLowerCase();
    if (!name.trim()) return setErr('Give them a name');
    if (!isAddress(a)) return setErr("That isn't a LOKYX address");
    await contacts.save((x) => [...x.filter((c) => c.address !== a && c.address !== edit?.address), { name: name.trim(), address: a }].sort((p, q) => p.name.localeCompare(q.name)));
    success();
    setOpen(false);
  };

  return (
    <Screen title="People" large right={<Press onPress={() => start()} accessibilityLabel="Add someone" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={20} color={C.text} width={2} /></Press>}>
      {list.length === 0 && <Note>Save the people you pay so you see their names instead of long addresses.</Note>}
      <Animated.View layout={LinearTransition.duration(DUR.base).easing(EASE_OUT)} style={{ gap: 2 }}>
        {list.map((c, i) => (
          <Animated.View key={c.address} entering={FadeInDown.delay(i * 30).duration(DUR.base).easing(EASE_OUT)} exiting={FadeOut} layout={LinearTransition.duration(DUR.base).easing(EASE_OUT)}>
            <Press haptic={false} scaleTo={0.98} onPress={() => start(c)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}>
              <Avatar address={c.address} size={46} name={c.name} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="headline">{c.name}</T>
                <T v="caption" dim>{shortAddr(c.address)}</T>
              </View>
              <Press onPress={() => router.push(`/send?to=${c.address}`)} style={{ paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: C.fill2, justifyContent: 'center' }}>
                <T v="sub">Pay</T>
              </Press>
            </Press>
          </Animated.View>
        ))}
      </Animated.View>
      {list.length === 0 && <Button title="Add someone" icon="plus" kind="line" onPress={() => start()} />}

      <Sheet open={open} onClose={() => setOpen(false)}>
        <View style={{ gap: 14 }}>
          <T v="title">{edit ? edit.name : 'Add someone'}</T>
          <Field value={name} onChangeText={setName} placeholder="Name" autoFocus={!edit} maxLength={32} />
          <Field value={addr} onChangeText={setAddr} placeholder="lyx1…" autoCapitalize="none" autoCorrect={false} mono />
          <ErrorText>{err}</ErrorText>
          <Button title="Save" onPress={save} />
          {edit && (
            <Button
              title="Delete"
              kind="plain"
              onPress={async () => {
                await contacts.save((x) => x.filter((c) => c.address !== edit.address));
                setOpen(false);
              }}
            />
          )}
        </View>
      </Sheet>
    </Screen>
  );
}
