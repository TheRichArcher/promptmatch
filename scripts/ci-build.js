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

let ensuredTs = hasTypescript();
if (!ensuredTs) {
	console.warn('[build] typescript not found; attempting to install locally for build...');
	const install = spawnSync('npm', ['install', 'typescript@5', '--no-save'], { stdio: 'inherit', env: process.env });
	ensuredTs = install.status === 0 && hasTypescript();
}

let moved = false;
if (!ensuredTs && fs.existsSync(tsconfigPath)) {
	console.warn('[build] still no typescript; temporarily disabling tsconfig.json for CI build');
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


