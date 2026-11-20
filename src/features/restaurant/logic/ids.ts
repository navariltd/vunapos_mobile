// Client-generated ids (UUID v4) for order lines and idempotency keys. Hermes may
// not provide crypto.getRandomValues, so fall back to Math.random: these ids only
// need to be unique, not secret.
function defaultFill(bytes: Uint8Array<ArrayBuffer>) {
	const webCrypto = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => unknown } }).crypto;
	if (typeof webCrypto?.getRandomValues === "function") {
		webCrypto.getRandomValues(bytes);
		return;
	}
	for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
}

export function newId(fillRandom: (bytes: Uint8Array<ArrayBuffer>) => void = defaultFill): string {
	const bytes = new Uint8Array(16);
	fillRandom(bytes);
	// RFC 4122 version 4 layout.
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
