// Centralized environment variables for server-side usage
// Do not import this file in client components
export const env = {
	GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ?? '',
	NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL ?? '',
};


