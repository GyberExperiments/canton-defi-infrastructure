/**
 * Type definitions for crypto libraries
 */

declare module 'tweetnacl' {
  export function encodeBase64(data: Uint8Array): string;
  export function decodeBase64(data: string): Uint8Array;
}

declare module 'tweetnacl-util' {
  export function encodeBase64(data: Uint8Array): string;
  export function decodeBase64(data: string): Uint8Array;
}

declare module 'libsodium-wrappers' {
  interface Sodium {
    ready: Promise<void>;
    crypto_box_seal(message: Uint8Array, publicKey: Uint8Array): Uint8Array;
  }
  
  const sodium: Sodium;
  export { sodium };
  const libsodium: { sodium: Sodium };
  export default libsodium;
}
