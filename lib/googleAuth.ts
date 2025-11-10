import { GoogleAuth } from 'google-auth-library';

export async function getGoogleAccessTokenFromEnv(): Promise<string | null> {
	try {
		const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
		if (!raw) return null;
		const credentials = JSON.parse(raw);
		const auth = new GoogleAuth({
			credentials,
			// Include both Generative Language and Cloud Platform scopes so we can call Vertex AI endpoints
			scopes: [
				'https://www.googleapis.com/auth/generative-language',
				'https://www.googleapis.com/auth/cloud-platform',
			],
		});
		const client = await auth.getClient();
		const token = await client.getAccessToken();
		return token?.token ?? null;
	} catch {
		return null;
	}
}


