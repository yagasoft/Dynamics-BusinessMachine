function toBinaryString(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return binary;
}

export function encodeUtf8Base64(text: string): string {
  return btoa(toBinaryString(new TextEncoder().encode(text)));
}

export function decodeUtf8Base64(encoded: string): string {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
