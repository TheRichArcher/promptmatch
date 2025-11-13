'use client';

import React from 'react';

type LoadingOverlayProps = {
	isLoading: boolean;
	message?: string;
	className?: string;
};

export default function LoadingOverlay({ isLoading, message, className }: LoadingOverlayProps) {
	if (!isLoading) return null;
	return (
		<div
			className={`fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm ${className || ''}`}
			aria-live="polite"
			aria-busy="true"
			role="status"
		>
			<div className="flex flex-col items-center gap-3">
				<div className="h-10 w-10 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
				<p className="text-sm text-gray-700">{message || 'Loading next level…'}</p>
			</div>
		</div>
	);
}


