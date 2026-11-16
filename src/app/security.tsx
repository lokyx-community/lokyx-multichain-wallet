import { setLive } from '../lib/live';
import { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { T } from '../ui/Text';
import { Field, Group, Note, Press, Row, Screen, Switch, success, tick } from '../ui/controls';
import { PasscodePad } from '../ui/Passcode';
import { Icon } from '../ui/Icon';
import { toast } from '../ui/Toast';
import { C, F } from '../ui/theme';
import { askBiometric, bioName, biometricKind, confirmIt, type Bio } from '../lib/auth';
import { inDecoy, setPasscode, updateSettings, useWallet } from '../lib/wallet';
import { askProtectionOff, keepProtection, setProtectionOn, settleProtection, untrustAddress, useNewDevice, useProtection, useTrusted } from '../lib/guard';
import { TRUST_WAIT_MS, newDeviceActive, newDeviceEnds, protectionActive, waitText } from '../lib/guard-core';

const LOCKS: [string, number][] = [
  ['Right away', 0],
  ['After 1 minute', 60],
  ['After 5 minutes', 300],
  ['After 1 hour', 3600],
];

export default function Security() {
  const w = useWallet();
  const insets = useSafeAreaInsets();
  const [bio, setBio] = useState<Bio>(null);
  const [changing, setChanging] = useState<'' | 'new' | 'again'>('');
  const [first, setFirst] = useState('');
  const [limit, setLimit] = useState(w.settings.askAbove);
  const [daily, setDaily] = useState(w.settings.dailyLimit);
  useEffect(() => {
    biometricKind().then(setBio);
    settleProtection().catch(() => {});
  }, []);
  const prot = useProtection();
  const list = useTrusted();
  const nd = useNewDevice();
  const now = Date.now();
  const protOn = protectionActive(prot, now);
  const offIn = prot.on && prot.offAt !== undefined && prot.offAt > now ? prot.offAt - now : 0;

  return (
    <Screen title="Security" large>
      {bio ? (
        <Group>
          <Row
            icon={bio === 'face' ? 'face' : 'finger'}
            title={`Use ${bioName(bio)}`}
            sub="To open the wallet and approve payments"
            right={
              <Switch
                on={w.settings.biometrics}
                label={bioName(bio)}
                onChange={async (v) => {
                  if (v && !(await askBiometric(`Turn on ${bioName(bio)}`))) return;
                  await updateSettings({ biometrics: v });
                }}
              />
            }
          />
        </Group>
      ) : (
        <Note>This phone has no Face ID or fingerprint set up, so the wallet uses your passcode.</Note>
      )}

      <Group>
        <Row
          icon="lock"
          title="Change passcode"
          onPress={async () => {
            if (await confirmIt('Change your passcode')) setChanging('new');
          }}
        />
      </Group>

      <Group title="Lock the wallet">
        {LOCKS.map(([l, s]) => (
          <Row key={s} title={l} onPress={() => (tick(), updateSettings({ autoLock: s }))} right={w.settings.autoLock === s ? <Icon name="check" size={18} color={C.text} width={2.4} /> : <View />} />
        ))}
      </Group>

      <Group title="Privacy and keys">
        <Row icon="eye" title="Hide balances" sub="Show •••• until you tap a card" right={<Switch on={w.settings.hideBalance} label="Hide balances" onChange={(v) => updateSettings({ hideBalance: v })} />} />
        <Row icon="words" title="Recovery words" sub="See them again, after Face ID or fingerprint" onPress={() => router.push('/backup')} />
        <Row icon="check" title="Check my backup" sub="Prove your 24 words still work, in three questions" onPress={() => router.push('/backup-check')} />
        <Row icon="key" title="Rotate this account's key" sub="If you think someone saw your words" onPress={() => router.push('/rotate')} />
        {!inDecoy() && <Row icon="shield" title="Decoy passcode" sub="Opens a second wallet if you're forced to unlock" onPress={() => router.push('/decoy')} />}
      </Group>

      <Group title="Small payments">
        <View style={{ padding: 16, gap: 10 }}>
          <T v="sub" dim>Skip the check for payments up to this many LYX. Leave empty to be asked every time.</T>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Field value={limit} onChangeText={(s) => setLimit(s.replace(/[^\d.]/g, ''))} placeholder="Always ask" keyboardType="decimal-pad" style={{ flex: 1, backgroundColor: C.fill2 }} />
            <Press
              onPress={async () => {
                if (limit && !(await confirmIt('Change when the wallet asks'))) return;
                await updateSettings({ askAbove: limit });
                success();
                toast(limit ? `Won't ask under ${limit} LYX` : 'Will ask every time');
              }}
              style={{ height: 52, paddingHorizontal: 18, borderRadius: 16, backgroundColor: C.ink, justifyContent: 'center' }}
            >
              <T style={{ fontFamily: F.semibold, color: C.inkText }}>Save</T>
            </Press>
          </View>
        </View>
      </Group>

      <Group title="New addresses">
        <Row
          icon="shield"
          title="New addresses wait 24 hours"
          sub={offIn ? `Turning off in ${waitText(offIn)}. Tap to keep it on.` : 'An address you have not paid before has to sit on your trusted list for 24 hours before it can be paid. Turning this off takes 24 hours too.'}
          right={<Switch on={protOn} label="New addresses wait" onChange={async (v) => {
            if (!(await confirmIt(v ? 'Keep the wait for new addresses' : 'Turn off the wait for new addresses'))) return;
            if (v) await (prot.on ? keepProtection() : setProtectionOn());
            else await askProtectionOff();
            success();
            toast(v ? 'New addresses wait 24 hours' : `This turns off in ${waitText(TRUST_WAIT_MS)}`);
          }} />}
        />
        {Object.entries(list).map(([a, at]) => (
          <Row key={a} title={`${a.slice(0, 10)}…${a.slice(-6)}`} sub={at + TRUST_WAIT_MS > now ? `Ready in ${waitText(at + TRUST_WAIT_MS - now)}` : 'Ready'} onPress={async () => { if (await confirmIt('Remove this address from your trusted list')) await untrustAddress(a); }} right={<Icon name="close" size={16} color={C.faint} width={2} />} />
        ))}
        {newDeviceActive(nd, now) ? <Row icon="flash" title="New phone limit is on" sub={`You restored this wallet recently, so only a tenth of your biggest balance can leave until it ends in ${waitText(newDeviceEnds(nd) - now)}.`} /> : null}
      </Group>

      <Group title="Spending alerts and limits">
        <Row icon="flash" title="Live alerts" sub="Tells you within seconds when a vault withdrawal starts or a payment arrives. Keeps a small notice in your status bar and uses a little battery" right={<Switch on={w.settings.liveAlerts} label="Live alerts" onChange={(v) => { updateSettings({ liveAlerts: v }); setLive(v).catch(() => {}); }} />} />
        <Row icon="shield" title="Watchtowers" sub="Servers that tell your other devices if a vault withdrawal starts while your phone is off" onPress={() => router.push('/towers')} />
        <Row icon="flash" title="Tell me when money leaves" sub="A notification for every payment, even one sent from somewhere else" right={<Switch on={w.settings.sendAlerts} label="Spending alerts" onChange={(v) => updateSettings({ sendAlerts: v })} />} />
        <View style={{ padding: 16, gap: 10 }}>
          <T v="sub" dim>Daily limit. Above this many LYX in one day, a payment needs your passcode as well as Face ID. Leave empty for no limit.</T>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Field value={daily} onChangeText={(s) => setDaily(s.replace(/[^\d.]/g, ''))} placeholder="No limit" keyboardType="decimal-pad" style={{ flex: 1, backgroundColor: C.fill2 }} />
            <Press
              onPress={async () => {
                if (!(await confirmIt('Change your daily limit'))) return;
                await updateSettings({ dailyLimit: daily });
                success();
                toast(daily ? `Daily limit ${daily} LYX` : 'No daily limit');
              }}
              style={{ height: 52, paddingHorizontal: 18, borderRadius: 16, backgroundColor: C.ink, justifyContent: 'center' }}
            >
              <T style={{ fontFamily: F.semibold, color: C.inkText }}>Save</T>
            </Press>
          </View>
        </View>
      </Group>

      <Modal visible={!!changing} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setChanging('')}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 60, paddingBottom: insets.bottom + 16, paddingHorizontal: 24, justifyContent: 'space-between' }}>
          {changing === 'new' && (
            <PasscodePad
              key="n"
              title="New passcode"
              sub="Six numbers"
              onDone={(p) => {
                setFirst(p);
                setTimeout(() => setChanging('again'), 150);
                return true;
              }}
            />
          )}
          {changing === 'again' && (
            <PasscodePad
              key="a"
              title="Once more"
              sub="Type it again"
              onDone={async (p) => {
                if (p !== first) {
                  setTimeout(() => setChanging('new'), 700);
                  return "They didn't match";
                }
                await setPasscode(p);
                setTimeout(() => {
                  setChanging('');
                  toast('Passcode changed', 'lock');
                }, 200);
                return true;
              }}
            />
          )}
          <Press onPress={() => setChanging('')} style={{ alignSelf: 'center', padding: 12 }}>
            <T v="callout" dim>Cancel</T>
          </Press>
        </View>
      </Modal>
    </Screen>
  );
}
