import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { T } from '../ui/Text';
import { Button, ErrorText, Field, Group, Note, Row, Screen, success } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { toast } from '../ui/Toast';
import { C } from '../ui/theme';
import { addTower, alertLink, ensureTopic, registerAll, removeTower, useTowers } from '../lib/tower';
import { protectedBy, type TowerResult } from '../lib/tower-core';

/** Watchtowers: servers that watch your vault and tell you on your other devices when something you did not start is waiting. */
export default function Towers() {
  const t = useTowers();
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<TowerResult[]>([]);
  useEffect(() => {
    ensureTopic().catch(() => {});
  }, []);

  const add = async () => {
    setErr('');
    try {
      await addTower(url);
      setUrl('');
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const register = async () => {
    setBusy(true);
    try {
      const r = await registerAll();
      setRes(r);
      success();
      toast(`${protectedBy(r)} of ${r.length} registered`);
    } finally {
      setBusy(false);
    }
  };
  const failed = res.filter((r) => !r.ok);

  return (
    <Screen title="Watchtowers" large>
      <Note>A watchtower is a server that keeps an eye on your vault while your phone is off. If a withdrawal you did not start appears, it sends a message to the channel below, so you see it on a second device and can cancel it with your recovery words. It holds no key and cannot move or cancel anything. Use two or more, run by different people, so one being down does not matter.</Note>

      <Group title="Your private alert channel">
        <View style={{ padding: 16, gap: 10 }}>
          <T v="sub" dim>Install the free ntfy app on a second phone or tablet and subscribe to this topic. Anyone who knows it can read your alerts, so do not share it.</T>
          <T v="mono" selectable>{t.topic ? alertLink() : '…'}</T>
          <Button title="Copy" kind="line" onPress={async () => { await Clipboard.setStringAsync(alertLink()); toast('Copied'); }} />
        </View>
      </Group>

      <Group title="Towers">
        {t.urls.map((u) => (
          <Row key={u} title={u.replace('https://', '')} sub={res.find((r) => r.tower === u)?.ok ? 'Watching' : res.find((r) => r.tower === u)?.error ?? 'Not registered yet'} onPress={() => removeTower(u)} right={<Icon name="close" size={16} color={C.faint} width={2} />} />
        ))}
        {t.urls.length === 0 ? <T v="sub" dim style={{ padding: 16 }}>No towers yet. Add the address of one below.</T> : null}
      </Group>
      <Field value={url} onChangeText={setUrl} placeholder="https://tower.example" autoCapitalize="none" autoCorrect={false} />
      <ErrorText>{err}</ErrorText>
      <Button title="Add tower" kind="line" disabled={!url.trim()} onPress={add} />
      <Button title="Register my accounts" busy={busy} disabled={t.urls.length === 0} onPress={register} />
      {failed.length > 0 ? <Note>{`${failed.length} could not be reached or refused. Check the tower address and try again.`}</Note> : null}
      {t.urls.length === 1 ? <Note>You have one tower. If it is down, you get no alert. Add a second from someone else.</Note> : null}
      <Note>Alerts only. A tower cannot cancel a withdrawal for you yet: that needs a change to the chain (cancel tickets) that has not been made.</Note>
    </Screen>
  );
}
