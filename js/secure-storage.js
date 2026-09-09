/* ─── Secure vault: encrypted localStorage envelope + session management ───
 * Storage format (versioned):
 *   localStorage['poolham_vault'] = {
 *     "version": 2,
 *     "encrypted": true,
 *     "kdf": { "algo": "PBKDF2", "hash": "SHA-256", "iterations": 310000, "salt": "<b64>" },
 *     "iv": "<b64>",           // fresh IV per write
 *     "ciphertext": "<b64>"    // AES-GCM(payload) — payload = sensitive data JSON
 *   }
 * The PIN is NEVER stored (correct PIN = the only key that decrypts).
 * Every write is verified (read-back + decrypt + compare) BEFORE any plaintext
 * data is removed — migration is lossless, idempotent and interruption-safe. */

import * as crypto from './crypto.js';

export const VAULT_KEY = 'poolham_vault';
const VAULT_NEXT_KEY = 'poolham_vault_next';
export const LEGACY_PIN_KEY = 'poolham_pin'; // plaintext PIN of the OLD version
export const SENSITIVE_KEYS = [
    'poolham_cards',
    'poolham_transactions',
    'poolham_debts',
    'poolham_cheques',
    'poolham_birthdays',
    'poolham_budgets',
    'poolham_default_template'
];

let session = null; // { key: CryptoKey, kdf: {...} } — lives only in memory

export function vaultExists() { return !!localStorage.getItem(VAULT_KEY); }
export function hasSession() { return !!session; }
export function setSession(key, kdf) { session = key ? { key, kdf } : null; }

function readEnvelope(keyName) {
    try {
        const e = JSON.parse(localStorage.getItem(keyName));
        return (e && e.encrypted && e.ciphertext && e.iv && e.kdf) ? e : null;
    } catch (e) { return null; }
}

export function currentEnvelope() { return readEnvelope(VAULT_KEY); }

async function deriveFromEnvelope(env, pin) {
    const salt = crypto.b64Decode(env.kdf.salt);
    const key = await crypto.deriveKey(pin, salt, env.kdf.iterations);
    return key;
}

/* Try to decrypt the vault with a PIN. Throws on wrong PIN / corrupted vault. */
export async function unlockVault(pin) {
    const env = currentEnvelope();
    if (!env) throw new Error('no-vault');
    const key = await deriveFromEnvelope(env, pin);
    const payload = await crypto.decryptJSON(key, env.iv, env.ciphertext); // throws on wrong PIN
    setSession(key, env.kdf);
    return payload;
}

/* Verified write: encrypt → write → read back → decrypt → deep-compare.
 * Writes to a temp key first so an interruption can never destroy the vault. */
async function verifiedWrite(pin, payload) {
    const salt = crypto.randomBytes(16);
    const key = await crypto.deriveKey(pin, salt);
    const kdf = { algo: crypto.KDF_PARAMS.algo, hash: crypto.KDF_PARAMS.hash, iterations: crypto.KDF_PARAMS.iterations, salt: crypto.b64Encode(salt) };
    const { iv, ciphertext } = await crypto.encryptJSON(key, payload);
    const env = { version: 2, encrypted: true, kdf, iv, ciphertext };

    localStorage.setItem(VAULT_NEXT_KEY, JSON.stringify(env));

    // verify what actually landed in storage
    const back = readEnvelope(VAULT_NEXT_KEY);
    if (!back) throw new Error('vault-write-failed');
    const backKey = await deriveFromEnvelope(back, pin);
    const check = await crypto.decryptJSON(backKey, back.iv, back.ciphertext);
    if (JSON.stringify(check) !== JSON.stringify(payload)) throw new Error('vault-verify-failed');

    return { env, key: backKey, kdf: back.kdf };
}

/* Create a new vault from plaintext data (first PIN / migration). */
export async function createVault(pin, payload) {
    const { env, key, kdf } = await verifiedWrite(pin, payload);
    localStorage.setItem(VAULT_KEY, JSON.stringify(env));
    localStorage.removeItem(VAULT_NEXT_KEY);
    setSession(key, kdf);
}

/* Change PIN: re-encrypt payload with a NEW salt + key, verified replace.
 * The old vault stays intact until the new one is verified. */
export async function changePin(newPin, payload) {
    return createVault(newPin, payload);
}

/* Re-encrypt the current payload with the session key + fresh IV (every save). */
export async function secureSave(payload) {
    if (!session) throw new Error('locked-session');
    const { iv, ciphertext } = await crypto.encryptJSON(session.key, payload);
    const env = { version: 2, encrypted: true, kdf: session.kdf, iv, ciphertext };
    localStorage.setItem(VAULT_KEY, JSON.stringify(env));

    // cheap verification (no KDF — session key directly)
    const back = readEnvelope(VAULT_KEY);
    const check = await crypto.decryptJSON(session.key, back.iv, back.ciphertext);
    if (JSON.stringify(check) !== JSON.stringify(payload)) throw new Error('vault-verify-failed');
}

/* Delete ALL plaintext sensitive keys (after vault was written & verified). */
export function clearPlaintextData() {
    SENSITIVE_KEYS.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(LEGACY_PIN_KEY);
}

/* Remove stale plaintext duplicates after a successful unlock
 * (e.g. an interrupted migration left both copies). The vault copy was
 * already verified, so the plaintext duplicates are redundant. */
export function clearStalePlaintextData() {
    if (vaultExists()) clearPlaintextData();
}

/* Tear the vault down: caller writes plaintext back first, then calls this. */
export function destroyVault() {
    localStorage.removeItem(VAULT_KEY);
    localStorage.removeItem(VAULT_NEXT_KEY);
    setSession(null, null);
}

/* ─── Encrypted backup (versioned, same encryption model) ─── */
export async function buildEncryptedBackup(prefs, payload) {
    if (!session) throw new Error('locked-session');
    const { iv, ciphertext } = await crypto.encryptJSON(session.key, payload);
    return {
        format: 'poolham-backup',
        version: 2,
        encrypted: true,
        app: 'poolhamko',
        exportedAt: new Date().toISOString(),
        prefs,                                          // non-sensitive prefs (plaintext)
        vault: { version: 2, encrypted: true, kdf: session.kdf, iv, ciphertext }
    };
}

/* Decrypt an encrypted backup file with the PIN it was encrypted with.
 * Returns { payload, key, kdf } — does NOT touch current storage. */
export async function importEncryptedBackup(backup, pin) {
    const env = backup && backup.vault;
    if (!env || !env.encrypted || !env.ciphertext || !env.iv || !env.kdf) throw new Error('bad-backup');
    const key = await deriveFromEnvelope(env, pin);
    const payload = await crypto.decryptJSON(key, env.iv, env.ciphertext); // throws on wrong PIN
    return { payload, key, kdf: env.kdf };
}

/* Adopt a verified backup envelope as the active vault (restore flow). */
export function adoptVault(env, key, kdf) {
    localStorage.setItem(VAULT_KEY, JSON.stringify(env));
    setSession(key, kdf);
}
