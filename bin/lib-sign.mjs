import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export const PINNED_PUBLIC_KEY = 'VYTnLpqp3zx/95mQ4PTijnxTElnhd4VgiRjLToXqku4=';

const SPKI_ED25519_PREFIX_LENGTH = 12;

export const rawPublicKey = (privateKey) => {
  const der = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  return der.subarray(SPKI_ED25519_PREFIX_LENGTH).toString('base64');
};

export const signPackage = (zipBytes, pem, pinnedPublicKey = PINNED_PUBLIC_KEY) => {
  if (!pem || !pem.trim()) {
    throw new Error('RELEASE_SIGNING_KEY is not set');
  }
  const privateKey = createPrivateKey(pem);
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('RELEASE_SIGNING_KEY is not an Ed25519 key');
  }
  if (rawPublicKey(privateKey) !== pinnedPublicKey) {
    throw new Error('RELEASE_SIGNING_KEY does not match the public key pinned in the plugin');
  }
  const signature = sign(null, zipBytes, privateKey);
  if (!verify(null, zipBytes, createPublicKey(privateKey), signature)) {
    throw new Error('Signature self-check failed');
  }
  return signature.toString('base64');
};
