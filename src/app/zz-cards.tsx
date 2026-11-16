import { View } from 'react-native';
import { NeonCard, type NeonData } from '../ui/NeonCard';

const cards: NeonData[] = [
  { rim: 'lyx', title: 'LOKYX', sub: 'Testnet', balance: '0.00', unit: 'LYX', note: 'Testnet · no market value', mark: { kind: 'lyx' } },
  { rim: 'btc', title: 'Bitcoin', sub: 'Signet', balance: '0.0412', unit: 'sBTC', note: 'Testnet · no market value', mark: { kind: 'logo', id: 'btc' } },
  { rim: 'eth', title: 'Ethereum', sub: 'Ethereum · 10 networks', balance: '1.2048', unit: 'SepoliaETH', note: 'Testnet · no market value', mark: { kind: 'logo', id: 'eth' } },
  { rim: 'sol', title: 'Solana', sub: 'Devnet', balance: '12.48', unit: 'SOL', note: 'Testnet · no market value', mark: { kind: 'logo', id: 'sol' } },
  { rim: 'trx', title: 'Tron', sub: 'Nile', balance: '2210.5', unit: 'TRX', note: 'Testnet · no market value', mark: { kind: 'logo', id: 'trx' } },
];
export default function ZZ() {
  return (
    <View style={{ flex: 1, backgroundColor: 'transparent', padding: 20, gap: 30 }}>
      {cards.map((c, i) => (
        <View key={i} nativeID={`zc${i}`} style={{ width: 366, height: 214 }}><NeonCard c={c} width={366} height={214} /></View>
      ))}
    </View>
  );
}
