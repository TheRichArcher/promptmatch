import { GoogleAuth } from 'google-auth-library';

export async function getGoogleAccessTokenFromEnv(): Promise<string | null> {
	try {
		const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
		if (!raw) return null;
		const credentials = JSON.parse(raw);
		const auth = new GoogleAuth({
			credentials,
			scopes: ['https://www.googleapis.com/auth/generative-language'],
		});
		const client = await auth.getClient();
		const token = await client.getAccessToken();
		return token?.token ?? null;
	} catch {
		return null;
	}
}


