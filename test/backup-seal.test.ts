import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupFileName, backupFileText, backupFromFile, backupKind, openBackup, sealBackup } from '../src/lib/backup-seal.ts';

const WORDS = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

test('backup: seals and opens with the right password', async () => {
  const b = await sealBackup(WORDS, 'correct horse', 'wallet');
  assert.match(b, /^lokyx-backup:1:wallet:[A-Za-z0-9_-]+$/);
  assert.equal(backupKind(b), 'wallet');
  assert.ok(!b.includes('abandon'));
  assert.deepEqual(await openBackup(b, 'correct horse'), { kind: 'wallet', secret: WORDS });
});

test('backup: a wrong password or a changed byte is refused, and two backups differ', async () => {
  const b = await sealBackup(WORDS, 'correct horse', 'vault');
  await assert.rejects(() => openBackup(b, 'wrong horse!'), /does not open/);
  const bad = b.slice(0, -3) + (b.endsWith('AAA') ? 'BBB' : 'AAA');
  await assert.rejects(() => openBackup(bad, 'correct horse'), /does not open|damaged/);
  assert.notEqual(b, await sealBackup(WORDS, 'correct horse', 'vault'));
});

test('backup: short passwords and non-backups are refused; the kind cannot be swapped', async () => {
  await assert.rejects(() => sealBackup(WORDS, 'short', 'wallet'), /at least 8/);
  await assert.rejects(() => openBackup('hello', 'x'), /isn't a LOKYX backup/);
  const b = await sealBackup(WORDS, 'correct horse', 'wallet');
  await assert.rejects(() => openBackup(b.replace(':wallet:', ':vault:'), 'correct horse'), /does not open/);
});

test('backup file: written and read back, and it opens with the password', async () => {
  const b = await sealBackup(WORDS, 'correct horse', 'wallet');
  const file = backupFileText(b);
  assert.ok(file.endsWith('\n') && !file.includes('abandon'));
  assert.equal(backupFromFile(file), b);
  assert.equal(backupFileName('wallet'), 'lokyx-wallet-backup.lokyx');
  assert.equal(backupFileName('vault'), 'lokyx-vault-backup.lokyx');
  assert.deepEqual(await openBackup(backupFromFile(file)!, 'correct horse'), { kind: 'wallet', secret: WORDS });
});

test('backup file: finds the backup among other lines, and refuses a file without one', async () => {
  const b = await sealBackup(WORDS, 'correct horse', 'vault');
  assert.equal(backupFromFile(`\uFEFF\r\nMy backup\r\n\r\n  ${b}  \r\nthanks\r\n`), b);
  assert.equal(backupFromFile('hello world'), null);
  assert.equal(backupFromFile(''), null);
  assert.equal(backupFromFile(b.slice(0, -3) + '!!!'), null);
});
