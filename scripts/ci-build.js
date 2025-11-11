/* eslint-disable no-console */
const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

function hasTypescript() {
	try {
		require.resolve('typescript');
		return true;
	} catch {
		return false;
	}
}

const root = process.cwd();
const tsconfigPath = path.join(root, 'tsconfig.json');
const tempPath = path.join(root, 'tsconfig.ci.disabled');

let moved = false;
if (!hasTypescript() && fs.existsSync(tsconfigPath)) {
	console.warn('[build] typescript not found; temporarily disabling tsconfig.json for CI build');
	fs.renameSync(tsconfigPath, tempPath);
	moved = true;
}

const res = spawnSync('next', ['build'], { stdio: 'inherit', env: process.env });

if (moved) {
	try {
		fs.renameSync(tempPath, tsconfigPath);
	} catch (e) {
		console.error('[build] failed to restore tsconfig.json:', e);
	}
}

process.exit(res.status ?? 1);


