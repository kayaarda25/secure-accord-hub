/**
 * End-to-End Encryption utilities using Web Crypto API.
 *
 * Key exchange model:
 * - Each user generates an ECDH key pair on first use.
 * - Private key stays in IndexedDB (never leaves the browser).
 * - Public key is stored in Supabase for other participants to fetch.
 * - Messages are encrypted with a random AES-GCM key.
 * - The AES key is wrapped with each recipient's public key.
 */

const DB_NAME = "e2e_keys";
const STORE_NAME = "keys";
const KEY_ID = "user_keypair";

// ──────────────────────────────────────────────────────────────────────────────
// IndexedDB helpers
// ──────────────────────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredKeyPair(): Promise<CryptoKeyPair | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(KEY_ID);
    req.onsuccess = () => resolve(req.result?.keyPair ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function storeKeyPair(keyPair: CryptoKeyPair): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ id: KEY_ID, keyPair });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Key generation
// ──────────────────────────────────────────────────────────────────────────────

const ECDH_PARAMS: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };

export async function getOrCreateKeyPair(): Promise<CryptoKeyPair> {
  let kp = await getStoredKeyPair();
  if (kp) return kp;

  kp = await crypto.subtle.generateKey(ECDH_PARAMS, true, ["deriveKey", "deriveBits"]);
  await storeKeyPair(kp);
  return kp;
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("spki", publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("spki", binary, ECDH_PARAMS, true, []);
}

// ──────────────────────────────────────────────────────────────────────────────
// Derive shared AES key from ECDH
// ──────────────────────────────────────────────────────────────────────────────

async function deriveAesKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Encrypt / Decrypt message
// ──────────────────────────────────────────────────────────────────────────────

export interface EncryptedPayload {
  iv: string; // base64
  ciphertext: string; // base64
}

export async function encryptMessage(
  plaintext: string,
  myPrivateKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<EncryptedPayload> {
  const aesKey = await deriveAesKey(myPrivateKey, recipientPublicKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encoded);

  return {
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  };
}

export async function decryptMessage(
  payload: EncryptedPayload,
  myPrivateKey: CryptoKey,
  senderPublicKey: CryptoKey
): Promise<string> {
  const aesKey = await deriveAesKey(myPrivateKey, senderPublicKey);
  const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(payload.ciphertext), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ciphertext);
  return new TextDecoder().decode(decrypted);
}
