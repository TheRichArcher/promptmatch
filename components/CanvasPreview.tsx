import { useEffect, useRef } from 'react';

export type ShapeSpec = {
	type: 'shape';
	shape: 'circle' | 'square';
	color: string; // css color
	background: string; // css color
	size: 'small' | 'medium' | 'large';
	position: 'center';
};

export default function CanvasPreview({
	spec,
	width = 256,
	height = 256,
	imageDataUrl,
	label,
}: {
	spec?: ShapeSpec;
	imageDataUrl?: string | null;
	width?: number;
	height?: number;
	label?: string;
}) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Clear
		ctx.clearRect(0, 0, width, height);

		// If direct image provided, draw it
		if (imageDataUrl) {
			const img = new Image();
			img.onload = () => {
				ctx.drawImage(img, 0, 0, width, height);
			};
			img.src = imageDataUrl;
			return;
		}

		// Draw based on simple spec (training levels)
		if (spec) {
			ctx.fillStyle = spec.background;
			ctx.fillRect(0, 0, width, height);

			const sizePx =
				spec.size === 'large' ? Math.min(width, height) * 0.5 : spec.size === 'medium' ? Math.min(width, height) * 0.35 : Math.min(width, height) * 0.2;

			ctx.fillStyle = spec.color;
			if (spec.shape === 'circle') {
				ctx.beginPath();
				ctx.arc(width / 2, height / 2, sizePx / 2, 0, Math.PI * 2);
				ctx.fill();
			} else if (spec.shape === 'square') {
				ctx.fillRect(width / 2 - sizePx / 2, height / 2 - sizePx / 2, sizePx, sizePx);
			}
		}
	}, [spec, width, height, imageDataUrl]);

	return (
    <div className="space-y-2">
      <canvas ref={canvasRef} width={width} height={height} className="h-64 w-64 rounded-md border border-gray-200" />
      {label ? <div className="text-center text-sm text-gray-600">{label}</div> : null}
    </div>
  );
}


