/**
 * Client-side AES-GCM encryption for the admin PAT.
 * The encrypted PAT is stored in public/content/admin-auth.json so the admin
 * can log in with email + password instead of a raw GitHub PAT.
 *
 * Security model:
 *  - PBKDF2 (SHA-256, 200 000 iterations) derives a 256-bit AES key from the password.
 *  - AES-GCM provides authenticated encryption — tampering is detected.
 *  - Salt + IV are random per encryption; the ciphertext is useless without the password.
 */

const PBKDF2_ITERATIONS = 200_000;

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface AdminAuthConfig {
  salt: string;
  iv: string;
  encryptedPAT: string;
  /** SHA-256 hash of the admin email (lowercase) — used as a quick sanity check before decryption. */
  emailHash: string;
}

async function sha256b64(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return b64(buf);
}

/** Create an AdminAuthConfig from a plain PAT + password.  Call once during setup. */
export async function encryptPAT(pat: string, password: string, email: string): Promise<AdminAuthConfig> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(pat.trim()));
  return {
    salt: b64(salt),
    iv: b64(iv),
    encryptedPAT: b64(cipher),
    emailHash: await sha256b64(email.trim().toLowerCase()),
  };
}

/** Decrypt the PAT from the stored config. Throws if password/email is wrong. */
export async function decryptPAT(config: AdminAuthConfig, password: string, email: string): Promise<string> {
  const emailHash = await sha256b64(email.trim().toLowerCase());
  if (emailHash !== config.emailHash) throw new Error('Invalid admin email.');

  const salt = unb64(config.salt);
  const iv = unb64(config.iv);
  const key = await deriveKey(password, salt);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, unb64(config.encryptedPAT));
    return new TextDecoder().decode(plain).trim();
  } catch {
    throw new Error('Wrong password.');
  }
}
