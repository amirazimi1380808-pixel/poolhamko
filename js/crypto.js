/* ─── Web Crypto primitives: PBKDF2 + AES-GCM ───
 * Real client-side encryption for the PIN vault (phase 2).
 * - Key derivation: PBKDF2-HMAC-SHA-256, 310,000 iterations
 *   (OWASP-recommended range for PBKDF2-SHA256; keeps unlock well under
 *   ~0.5s on mid-range mobile devices — choice documented in PHASE2-REPORT.md)
 * - Encryption: AES-GCM-256 (authenticated; decryption failure = wrong key/PIN)
 * - Salt: 16 random bytes per envelope (crypto.getRandomValues)
 * - IV: 12 fresh random bytes per encryption operation — never reused
 * The PIN itself is never stored anywhere in any form. */

export const KDF_PARAMS = { algo: 'PBKDF2', hash: 'SHA-256', iterations: 310000 };
const AES_PARAMS = { name: 'AES-GCM', length: 256 };
const IV_BYTES = 12;
const SALT_BYTES = 16;

export function randomBytes(n) {
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return b;
}

export function b64Encode(bytes) {
    let s = '';
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
}

export function b64Decode(str) {
    const s = atob(str);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
}

/* Derive an AES-GCM key from a PIN + salt */
export async function deriveKey(pin, saltU8, iterations = KDF_PARAMS.iterations) {
    const base = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(String(pin)),
        'PBKDF2',
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: KDF_PARAMS.hash, salt: saltU8, iterations },
        base,
        AES_PARAMS,
        false,
        ['encrypt', 'decrypt']
    );
}

/* Encrypt a JSON-serializable object with a fresh random IV */
export async function encryptJSON(key, obj) {
    const iv = randomBytes(IV_BYTES);
    const plaintext = new TextEncoder().encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    return { iv: b64Encode(iv), ciphertext: b64Encode(ct) };
}

/* Decrypt; throws (OperationError) on wrong key/corrupted data */
export async function decryptJSON(key, ivB64, ctB64) {
    const iv = b64Decode(ivB64);
    const ct = b64Decode(ctB64);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(pt));
}
