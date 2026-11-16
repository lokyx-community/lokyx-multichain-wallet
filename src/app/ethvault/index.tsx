import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { toast } from "../../ui/Toast";
import { plainError } from '../../lib/plain-error';
import { T } from "../../ui/Text";
import { C, F } from "../../ui/theme";
import { VaultRing } from "../../ui/VaultRing";
import { Button, ErrorText, Group, Note, Row, Screen } from "../../ui/controls";
import { Segmented } from "../../ui/Segmented";
import { SlideToPay } from "../../ui/SlideToPay";
import { confirmIt } from "../../lib/auth";
import { useStore } from "../../lib/store";
import { useAsync } from "../../lib/multichain";
import {
  NETS,
  checkEthVaults,
  executeReady,
  loadVaults,
  phoneCancel,
  snapshot,
  tokensOn,
  vaults,
  type Snapshot,
} from "../../lib/ethvault";
import {
  VAULT_NETS,
  describeCall,
  itemState,
  type VaultNet,
} from "../../lib/ethvault-core";
import { shortAddr } from "../../lib/format";

const eth = (w: bigint, d = 18, f = 6) => {
  const s = w.toString().padStart(d + 1, "0");
  const fr = s
    .slice(s.length - d)
    .slice(0, f)
    .replace(/0+$/, "");
  return fr ? `${s.slice(0, s.length - d)}.${fr}` : s.slice(0, s.length - d);
};
const waitText = (s: number) =>
  s >= 172800
    ? `${Math.round(s / 86400)} days`
    : `${Math.round(s / 3600)} hours`;
const left = (t: number) => {
  const s = Math.max(0, t - Math.floor(Date.now() / 1000));
  return s >= 7200
    ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
    : `${Math.max(1, Math.ceil(s / 60))} min`;
};

/** The Ethereum vault, one network at a time: the same vault address has separate settings on each network. */
export default function EthVault() {
  const p = useLocalSearchParams<{ net?: VaultNet }>();
  const [net, setNet] = useState<VaultNet>(
    p.net && NETS.includes(p.net) ? p.net : NETS[0],
  );
  const all = useStore(vaults);
  useEffect(() => {
    loadVaults();
  }, []);
  const v = all[net];
  const snap = useAsync<Snapshot | null>(
    async () => (v ? snapshot(v) : null),
    [net, v?.state],
    20_000,
  );
  const [err, setErr] = useState("");
  const s = snap.data;
  const copy = async (text: string, what: string) => {
    await Clipboard.setStringAsync(text);
    toast(`${what} copied`, "copy");
  };
  const done = () => {
    checkEthVaults().catch(() => {});
    snap.refresh();
  };

  return (
    <Screen title="Ethereum vault (experimental)" large>
      <Note>
        Test coins only: this vault runs on test networks and has not been used
        with real money. Your vault address is the same on every network, but
        each network has its own settings.
      </Note>
      <Segmented<VaultNet>
        value={net}
        onChange={setNet}
        options={NETS.map(
          (n) => [n, VAULT_NETS[n].label] as [VaultNet, string],
        )}
      />
      {!v ? (
        <>
          <T v="sub" dim style={{ paddingHorizontal: 4, lineHeight: 20 }}>
            {`A vault keeps your coins safe even if your phone is lost or stolen. Three things to know before you start on ${VAULT_NETS[net].label}:`}
          </T>
          {[
            ["1", "Coins wait in the open", "Small daily amounts leave at once. Anything bigger waits, and you can cancel it while it does."],
            ["2", "12 words are your way back", "You write them down once. They can cancel a withdrawal or move everything to a safe address."],
            ["3", "Your phone can't be forced", "Even someone who gets into your phone is held to the same daily limit and the same wait."],
          ].map(([n, t, d]) => (
            <View
              key={n}
              style={{ flexDirection: "row", gap: 14, padding: 16, borderRadius: 22, backgroundColor: C.fill, borderWidth: 0.5, borderColor: C.line2 }}
            >
              <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.good, alignItems: "center", justifyContent: "center" }}>
                <T style={{ fontFamily: F.semibold, fontSize: 14, color: C.good }}>{n}</T>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <T style={{ fontFamily: F.semibold, fontSize: 15.5 }}>{t}</T>
                <T v="sub" dim style={{ lineHeight: 19 }}>{d}</T>
              </View>
            </View>
          ))}
          <Button
            title={`Set up a vault on ${VAULT_NETS[net].label}`}
            onPress={() => router.push(`/ethvault/setup?net=${net}`)}
          />
        </>
      ) : (
        <>
          {s &&
            s.issues
              .filter((i) => i.level === "danger")
              .map((i) => <Note key={i.text}>{`Warning: ${i.text}`}</Note>)}
          {s &&
            s.issues
              .filter(
                (i) =>
                  i.level === "warn" && !/item\(s\) are waiting/.test(i.text),
              )
              .map((i) => <Note key={i.text}>{i.text}</Note>)}
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 20, padding: 20, borderRadius: 28, backgroundColor: C.raised, borderWidth: 0.5, borderColor: C.line2 }}
          >
            <VaultRing
              size={112}
              frac={s && s.issues.some((i) => i.level === "danger") ? 0.35 : 1}
              color={s && s.issues.some((i) => i.level === "danger") ? C.bad : C.good}
              breathe
            >
              <T style={{ fontFamily: F.semibold, fontSize: 21, letterSpacing: -0.6 }}>{s ? eth(s.eth, 18, 4) : "…"}</T>
              <T v="caption" dim>ETH</T>
            </VaultRing>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s && s.issues.some((i) => i.level === "danger") ? C.bad : C.good }} />
                <T style={{ fontFamily: F.semibold, fontSize: 17 }}>
                  {!s ? "Checking…" : s.issues.some((i) => i.level === "danger") ? "Needs a look" : "Protected"}
                </T>
              </View>
              <T v="sub" dim style={{ lineHeight: 20 }}>
                {s
                  ? `${[`${eth(s.eth, 18, 4)} ETH`, ...s.tokens.filter((t) => t.amount > 0n).map((t) => `${eth(t.amount, t.token.decimals, 2)} ${t.token.symbol}`)].join(" and ")} in your vault on ${VAULT_NETS[net].label}.`
                  : "Reading the vault from the network…"}
              </T>
            </View>
          </View>
          {s && s.items.length > 0 && (
            <View style={{ gap: 12 }}>
              {s.items.map((i) => {
                const st = itemState(i, Math.floor(Date.now() / 1000), s.live.delay.txNonce);
                if (st === "cancelled") return null;
                const d = describeCall(i, tokensOn(net), { safe: s.expected.safe });
                const frac = Math.max(0.04, Math.min(1, 1 - (i.readyAt - Math.floor(Date.now() / 1000)) / Math.max(1, v.wait)));
                return (
                  <View key={String(i.nonce)} style={{ padding: 16, gap: 14, borderRadius: 24, backgroundColor: C.fill, borderWidth: 0.5, borderColor: C.line2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                      <VaultRing size={46} stroke={5} frac={st === "waiting" ? frac : 1} color={d.level === "danger" ? C.bad : C.text} />
                      <View style={{ flex: 1 }}>
                        <T style={{ fontFamily: F.semibold, fontSize: 15.5 }} color={d.level === "danger" ? C.bad : undefined}>{d.line}</T>
                        <T v="caption" dim>
                          {st === "waiting" ? `Runs in ${left(i.readyAt)}` : st === "ready" ? "Ready to run" : "Expired: it can no longer run"}
                        </T>
                      </View>
                    </View>
                    {st === "ready" && (
                      <Button
                        title="Run it now"
                        kind="line"
                        onPress={async () => {
                          try {
                            await executeReady(v, i);
                            done();
                          } catch (e) {
                            setErr(plainError(e, VAULT_NETS[net].label));
                          }
                        }}
                      />
                    )}
                  </View>
                );
              })}
              {s.items.some((i) => itemState(i, Math.floor(Date.now() / 1000), s.live.delay.txNonce) === "waiting") && (
                <SlideToPay
                  label="Slide to cancel all waiting"
                  onSlide={async () => {
                    if (!(await confirmIt("Cancel everything waiting in your Ethereum vault"))) return false;
                    try {
                      await phoneCancel(v, s);
                      done();
                      return true;
                    } catch (e) {
                      setErr(plainError(e, VAULT_NETS[net].label));
                      return false;
                    }
                  }}
                />
              )}
            </View>
          )}
          <Button
            title="Send from vault"
            onPress={() => router.push(`/ethvault/send?net=${net}`)}
          />
          <Group title="Settings">
            <Row
              title="Wait on bigger withdrawals"
              detail={waitText(v.wait)}
              onPress={() => router.push(`/ethvault/settings?net=${net}`)}
            />
            {v.allowances.map((a) => {
              const l = s?.today.find(
                (t) => t.token.toLowerCase() === a.token.toLowerCase(),
              )?.left;
              return (
                <Row
                  key={a.token}
                  title={`Daily allowance ${a.symbol}`}
                  detail={`${eth(BigInt(a.amount), a.decimals, 4)}`}
                  sub={l == null ? undefined : `${eth(l, a.decimals, 4)} left today`}
                  onPress={() => router.push(`/ethvault/settings?net=${net}`)}
                />
              );
            })}
            <Row
              title="Vault address"
              sub="Tap to copy. Send coins here to protect them"
              detail={shortAddr(s?.expected.safe ?? "", 6, 4)}
              onPress={s ? () => copy(s.expected.safe, "Vault address") : undefined}
            />
          </Group>
          <Group title="How it works">
            <View style={{ padding: 14, gap: 8 }}>
              <T v="sub" dim style={{ lineHeight: 20 }}>
                The vault address is a separate account that holds your
                protected coins. Coins sent there are not spent from your
                everyday address.
              </T>
              <T
                v="sub"
                dim
                style={{ lineHeight: 20 }}
              >{`Your phone can move the daily allowance straight away. Anything bigger waits ${waitText(v.wait)} in the open, and you can cancel it in that time. A thief who gets into your phone is held to the same limits.`}</T>
              <T v="sub" dim style={{ lineHeight: 20 }}>
                The recovery address belongs to the 12 words you wrote down.
                Those words can cancel a waiting withdrawal or move everything
                to your safe address. It holds a little ETH only to pay the fee
                for that.
              </T>
            </View>
          </Group>
          <Group title="Recovery">
            <Row
              title="Recovery address"
              sub="Tap to copy"
              detail={shortAddr(v.recovery, 6, 4)}
              onPress={() => copy(v.recovery, "Recovery address")}
            />
            <Row
              title="Safe address"
              sub="Where a sweep sends everything. Tap to copy"
              detail={shortAddr(v.sweepTo, 6, 4)}
              onPress={() => copy(v.sweepTo, "Safe address")}
            />
          </Group>
          {s?.recoveryGas.low && (
            <Note>{`Low fuel on your recovery address ${shortAddr(v.recovery, 8, 6)}: it has ${eth(s.recoveryGas.have, 18, 6)} ETH and a cancel or sweep needs about ${eth(s.recoveryGas.needed, 18, 6)}. Send a little ETH there: the recovery key sends its own transactions, so without fuel it cannot cancel or sweep.`}</Note>
          )}
          {s && !s.recoveryGas.low && (
            <T
              v="caption"
              dim
            >{`Recovery address ${shortAddr(v.recovery, 8, 6)} holds ${eth(s.recoveryGas.have, 18, 6)} ETH for fees.`}</T>
          )}
          <ErrorText>{err || snap.error}</ErrorText>
          <Button
            title="Use my recovery key"
            kind="line"
            onPress={() => router.push(`/ethvault/recover?net=${net}`)}
          />
          {s && (
            <Note>
              Each time you open the app, the vault's owners, modules, guard,
              wait and allowances are read from the network and compared with
              what you set up. Anything different is shown above and sent as an
              alert.
            </Note>
          )}
        </>
      )}
    </Screen>
  );
}
