import { useEffect, useState } from 'react';

export default function PromptInput({
	onSubmit,
	isGenerating,
	defaultPrompt,
}: {
	onSubmit: (prompt: string) => void | Promise<void>;
	isGenerating?: boolean;
	defaultPrompt?: string;
}) {
	const [value, setValue] = useState<string>(defaultPrompt ?? '');
	useEffect(() => {
		setValue(defaultPrompt ?? '');
	}, [defaultPrompt]);
	return (
		<form
			className="space-y-3"
			onSubmit={async (e) => {
				e.preventDefault();
				if (!value.trim()) return;
				await onSubmit(value.trim());
			}}
		>
			<textarea
				className="input min-h-[96px]"
				placeholder="Describe the image you see…"
				value={value}
				onChange={(e) => setValue(e.target.value)}
			/>
			<div className="flex items-center gap-3">
				<button type="submit" className="btn" disabled={isGenerating}>
					{isGenerating ? 'Generating…' : 'Generate & Score'}
				</button>
				<span className="text-xs text-gray-500">Tip: mention color, size, position, and background.</span>
			</div>
		</form>
	);
}


