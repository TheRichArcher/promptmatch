import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
	title: 'PromptMatch',
	description: 'Train your AI prompting skills by matching images with precision.',
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<head>
				<link rel="icon" href="/favicon.ico" />
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
			</head>
			<body className="min-h-screen antialiased">
				<div className="mx-auto max-w-6xl px-4 py-6">
					<header className="mb-6 flex items-center justify-between">
						<a href="/" className="text-xl font-semibold">
							PromptMatch
						</a>
						<nav className="text-sm text-gray-600">
							<a className="hover:text-gray-900" href="/play">
								Training
							</a>
						</nav>
					</header>
					{children}
				</div>
			</body>
		</html>
	);
}


