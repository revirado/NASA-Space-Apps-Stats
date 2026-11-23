// FILE: src/lib/hash.ts
// sha256 en el navegador (SubtleCrypto) para la idempotencia de la carga
// (paso 5 del algoritmo de ingesta, sección 5 del brief). Requiere contexto
// seguro: localhost y HTTPS lo proveen.

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  if (!crypto?.subtle) {
    throw new Error('WebCrypto unavailable (secure context required)');
  }
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
