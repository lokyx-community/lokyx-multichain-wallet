import { useState } from 'react';
import { T } from '../ui/Text';
import { Field, Group, Note, Row, Screen, Switch } from '../ui/controls';
import { Segmented } from '../ui/Segmented';
import { updateChains, useChainSettings } from '../lib/multichain';
import { BTC_NETS, ETH_NETS, ethNetChoices, type BtcNet, type EthNet } from '../lib/multichain-core';

export default function ChainsSettings() {
  const s = useChainSettings();
  const [e1, setE1] = useState(s.esplora[s.btcNet] ?? '');
  const [e2, setE2] = useState(s.ethRpc[s.ethNet] ?? '');
  return (
    <Screen title="Bitcoin and Ethereum" large>
      <Note>This is a testnet beta. Bitcoin and Ethereum run on test networks only, with coins that have no value.</Note>
      <T v="headline">Bitcoin network</T>
      <Segmented value={s.btcNet} options={(['signet', 'testnet4', 'testnet'] as BtcNet[]).map((k) => [k, BTC_NETS[k].label.replace('Bitcoin ', '')] as [BtcNet, string])} onChange={(k) => { updateChains({ btcNet: k }); setE1(s.esplora[k] ?? ''); }} />
      <Field value={e1} onChangeText={(t) => { setE1(t); updateChains({ esplora: { ...s.esplora, [s.btcNet]: t.trim() } }); }} placeholder={BTC_NETS[s.btcNet].esplora} autoCapitalize="none" autoCorrect={false} />
      <Note>Block explorer API (Esplora). Leave blank for the default. No key needed.</Note>
      <T v="headline">Ethereum network</T>
      <Segmented value={s.ethNet} options={ethNetChoices(s.allowMainnet).map((k) => [k, ETH_NETS[k].short] as [EthNet, string])} onChange={(k) => { updateChains({ ethNet: k }); setE2(s.ethRpc[k] ?? ''); }} />
      <Field value={e2} onChangeText={(t) => { setE2(t); updateChains({ ethRpc: { ...s.ethRpc, [s.ethNet]: t.trim() } }); }} placeholder={ETH_NETS[s.ethNet].rpc} autoCapitalize="none" autoCorrect={false} />
      <Note>JSON-RPC endpoint for the network above. Leave blank for the default. The wallet checks that it really is that network. The same address works on all of them.</Note>
      <Group title="Developer">
        <Row title="Real-money networks" sub="Bitcoin and Ethereum mainnet. Off in this beta." right={<Switch on={s.allowMainnet} label="Real-money networks" onChange={(v) => updateChains({ allowMainnet: v, ...(v ? {} : { btcNet: s.btcNet === 'mainnet' ? 'signet' : s.btcNet, ethNet: 'sepolia' as EthNet }) })} />} />
      </Group>
      <Note>Turning this on lets the wallet send real money. Do not use it until this wallet has been reviewed and released for it.</Note>
    </Screen>
  );
}
