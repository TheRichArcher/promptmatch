import type { ShapeSpec } from '@/components/CanvasPreview';
import { trainingLevels, type Level } from '@/lib/levels';

export type SelectedTarget = {
	level: Level;
	imageDataUrl: string;
};

export function shapeSpecToDataUrl(spec: ShapeSpec, size = 256): string {
	// Guard for SSR / build-time prerender
	if (typeof document === 'undefined') {
		return '';
	}
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	// background
	ctx.fillStyle = spec.background;
	ctx.fillRect(0, 0, size, size);
	// shape
	const s = spec.size === 'large' ? size * 0.5 : spec.size === 'medium' ? size * 0.35 : size * 0.2;
	ctx.fillStyle = spec.color;
	if (spec.shape === 'circle') {
		ctx.beginPath();
		ctx.arc(size / 2, size / 2, s / 2, 0, Math.PI * 2);
		ctx.fill();
	} else {
		ctx.fillRect(size / 2 - s / 2, size / 2 - s / 2, s, s);
	}
	return canvas.toDataURL('image/png');
}

export function selectRandomTargets(count: number): SelectedTarget[] {
	const result: SelectedTarget[] = [];
	for (let i = 0; i < count; i++) {
		const level = trainingLevels[Math.floor(Math.random() * trainingLevels.length)];
		// Create image data URL on the fly (client-side)
		const imageDataUrl = shapeSpecToDataUrl(level.spec);
		result.push({ level, imageDataUrl });
	}
	return result;
}

export function mutateSpecSimilar(spec: ShapeSpec): ShapeSpec {
	// Create a similar but slightly varied spec for reinforcement (round 4)
	const sizeOrder: Array<ShapeSpec['size']> = ['small', 'medium', 'large'];
	const currentIdx = sizeOrder.indexOf(spec.size);
	const nextIdx = Math.min(sizeOrder.length - 1, Math.max(0, currentIdx + (Math.random() < 0.5 ? -1 : 1)));
	const tweakedSize = sizeOrder[nextIdx];
	return {
		...spec,
		size: tweakedSize,
	};
}

export function describeSpec(spec: ShapeSpec): string {
	const shapeWord = spec.shape === 'circle' ? 'sphere' : 'square';
	const sizeWord = spec.size === 'large' ? 'large' : spec.size === 'medium' ? 'medium' : 'small';
	return `A ${sizeWord} ${shapeWord} in ${spec.color} centered on a ${spec.background} background.`;
}


