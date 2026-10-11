import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildPath, doLauncher, expandHome, findExecutable, toolDirectory } from '../../toolEnv';

suite('IDE paths', () => {
	let tmp: string;
	let bin: string;

	suiteSetup(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hog-tools-'));
		bin = path.join(tmp, 'bin');
		fs.mkdirSync(bin);
		for (const name of ['quartus', 'vivado']) {
			fs.writeFileSync(path.join(bin, name), '#!/bin/sh\n', { mode: 0o755 });
		}
		fs.writeFileSync(path.join(bin, 'libero'), 'not executable', { mode: 0o644 });
	});

	suiteTeardown(() => fs.rmSync(tmp, { recursive: true, force: true }));

	test('prepends directories without duplicates', () => {
		assert.strictEqual(buildPath(['/a', '/b'], '/b:/usr/bin', ':'), '/a:/b:/usr/bin');
		assert.strictEqual(buildPath([], '/usr/bin', ':'), '/usr/bin');
		assert.strictEqual(buildPath(['C:\\\\a'], 'C:\\\\w', ';'), 'C:\\\\a;C:\\\\w');
	});

	test('accepts a directory or the executable itself', () => {
		assert.strictEqual(toolDirectory(bin), bin);
		assert.strictEqual(toolDirectory(path.join(bin, 'vivado')), bin);
		assert.strictEqual(toolDirectory(' /missing/dir '), '/missing/dir');
	});

	test('expands the home directory', () => {
		assert.strictEqual(expandHome('~/tools'), path.join(os.homedir(), 'tools'));
		assert.strictEqual(expandHome('/abs/~x'), '/abs/~x');
	});

	test('finds executables like which', () => {
		assert.strictEqual(findExecutable('vivado', `/missing:${bin}`, 'darwin'), path.join(bin, 'vivado'));
		assert.strictEqual(findExecutable('libero', bin, 'darwin'), undefined, 'not executable');
		assert.strictEqual(findExecutable('diamond', bin, 'darwin'), undefined);
	});

	test('follows the Hog/Do search order', () => {
		// vivado comes before quartus in Hog/Do
		assert.deepStrictEqual(doLauncher(bin, 'darwin'), { name: 'vivado', path: path.join(bin, 'vivado') });
		assert.strictEqual(doLauncher('/missing', 'darwin'), undefined);
	});
});
