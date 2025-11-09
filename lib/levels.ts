import type { ShapeSpec } from '@/components/CanvasPreview';

export type Level = {
	id: string;
	title: string;
	description: string; // natural language description for embeddings
	spec: ShapeSpec;
	difficulty: 'easy' | 'medium' | 'hard';
	examplePrompt?: string;
};

export const trainingLevels: Level[] = [
	{
		id: 'tutorial-1',
		title: 'Red Dot',
		description: 'A large red sphere centered on a white background.',
		spec: {
			type: 'shape',
			shape: 'circle',
			color: '#ef4444',
			background: '#ffffff',
			size: 'large',
			position: 'center',
		},
		difficulty: 'easy',
		examplePrompt: 'A large red sphere centered on a white background.',
	},
	{
		id: 'tutorial-2',
		title: 'Blue Square',
		description: 'A medium blue square centered on a light gray background.',
		spec: {
			type: 'shape',
			shape: 'square',
			color: '#3b82f6',
			background: '#f3f4f6',
			size: 'medium',
			position: 'center',
		},
		difficulty: 'easy',
		examplePrompt: 'A medium blue square centered on a light gray background.',
	},
	{
		id: 'tutorial-3',
		title: 'Small Red Dot',
		description: 'A small red dot centered on a white background.',
		spec: {
			type: 'shape',
			shape: 'circle',
			color: '#ef4444',
			background: '#ffffff',
			size: 'small',
			position: 'center',
		},
		difficulty: 'easy',
		examplePrompt: 'A small red dot centered on a white background.',
	},
];


