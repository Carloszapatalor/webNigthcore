const ITERATIONS = 100_000;
const SALT_LEN = 16;
const enc = new TextEncoder();

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
}

function toBase64(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const hash = await deriveKey(plain, salt);
  return `${toBase64(salt)}:${toBase64(new Uint8Array(hash))}`;
}

export async function comparePassword(plain: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(":");
  if (!saltB64 || !hashB64) return false;
  const salt = fromBase64(saltB64);
  const hash = await deriveKey(plain, salt);
  return toBase64(new Uint8Array(hash)) === hashB64;
}
