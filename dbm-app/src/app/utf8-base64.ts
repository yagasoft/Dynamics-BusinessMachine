export function encodeUtf8Base64(value: string): string
{
	if (typeof TextEncoder !== 'undefined')
	{
		const bytes = new TextEncoder().encode(value);
		let binary = '';
		for (const byte of bytes)
		{
			binary += String.fromCharCode(byte);
		}

		return btoa(binary);
	}

	return btoa(unescape(encodeURIComponent(value)));
}

export function decodeUtf8Base64(value: string): string
{
	if (typeof TextDecoder !== 'undefined')
	{
		const binary = atob(value);
		const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	}

	return decodeURIComponent(escape(atob(value)));
}
