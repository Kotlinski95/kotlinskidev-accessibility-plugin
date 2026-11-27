import { generateKeyPairSync, verify, createPublicKey } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(__dirname, '../../bin/sign-release.mjs');

const pair = (): { pem: string; raw: string } => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    pem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    raw: publicKey.export({ type: 'spki', format: 'der' }).subarray(12).toString('base64'),
  };
};

const lib = resolve(__dirname, '../../bin/lib-sign.mjs');

const runSign = (pem: string, pinned: string | null): { status: number | null; stdout: string; stderr: string } => {
  const code = `import { signPackage, PINNED_PUBLIC_KEY } from ${JSON.stringify(lib)};
process.stdout.write(signPackage(Buffer.from('zip-bytes'), process.env.PEM, ${pinned === null ? 'PINNED_PUBLIC_KEY' : 'process.env.PINNED'}));`;
  const result = spawnSync('node', ['--input-type=module', '-e', code], { env: { ...process.env, PEM: pem, PINNED: pinned ?? '' }, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

describe('sign-release', () => {
  it('signs bytes so the raw public key verifies them', () => {
    const keys = pair();
    const bytes = Buffer.from('zip-bytes');
    const run = runSign(keys.pem, keys.raw);
    expect(run.status).toBe(0);
    const signature = Buffer.from(run.stdout, 'base64');
    const publicKey = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(keys.raw, 'base64')]), format: 'der', type: 'spki' });
    expect(signature).toHaveLength(64);
    expect(verify(null, bytes, publicKey, signature)).toBe(true);
    expect(verify(null, Buffer.from('tampered'), publicKey, signature)).toBe(false);
  });

  it('rejects a key that does not match the pinned public key', () => {
    const run = runSign(pair().pem, null);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('does not match');
  });

  it('rejects an empty or non Ed25519 key', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    expect(runSign('', null).stderr).toContain('not set');
    expect(runSign(rsa, null).stderr).toContain('not an Ed25519 key');
  });

  it('exits non-zero and writes no signature when the secret is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ka11y-sign-'));
    const zip = join(dir, 'p.zip');
    writeFileSync(zip, 'zip');
    const env = { ...process.env };
    delete env.RELEASE_SIGNING_KEY;
    const result = spawnSync('node', [script, zip], { env, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('RELEASE_SIGNING_KEY is not set');
    expect(existsSync(`${zip}.sig`)).toBe(false);
  });

  it('exits non-zero for a wrong key without writing a signature', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ka11y-sign-'));
    const zip = join(dir, 'p.zip');
    writeFileSync(zip, 'zip');
    const result = spawnSync('node', [script, zip], { env: { ...process.env, RELEASE_SIGNING_KEY: pair().pem }, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(existsSync(`${zip}.sig`)).toBe(false);
    expect(readFileSync(zip, 'utf8')).toBe('zip');
  });
});
