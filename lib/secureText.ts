import crypto from 'crypto';

function getSecretKey(): Buffer {
	const secret =
		process.env.GOLD_PROMPT_SECRET ||
		process.env.NEXTAUTH_SECRET ||
		process.env.AUTH_SECRET ||
		'promptmatch-dev-secret';
	// Derive a 32-byte key using SHA-256
	return crypto.createHash('sha256').update(secret).digest();
}

function toBase64Url(input: Buffer): string {
	return input
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
	const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
	const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
	return Buffer.from(b64 + pad, 'base64');
}

export function sealGoldPrompt(plainText: string): string {
	const iv = crypto.randomBytes(12); // GCM recommended IV size
	const key = getSecretKey();
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([cipher.update(Buffer.from(plainText, 'utf8')), cipher.final()]);
	const tag = cipher.getAuthTag();
	// token format: iv.tag.ciphertext (all base64url)
	return `${toBase64Url(iv)}.${toBase64Url(tag)}.${toBase64Url(ciphertext)}`;
}

export function unsealGoldPrompt(token: string): string {
	try {
		const [ivB64, tagB64, ctB64] = token.split('.');
		if (!ivB64 || !tagB64 || !ctB64) throw new Error('Malformed token');
		const iv = fromBase64Url(ivB64);
		const tag = fromBase64Url(tagB64);
		const ciphertext = fromBase64Url(ctB64);
		const key = getSecretKey();
		const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
		decipher.setAuthTag(tag);
		const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
		return plain.toString('utf8');
	} catch {
		throw new Error('Invalid gold token');
	}
}


