import * as fs from 'fs';
import * as path from 'path';

import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// Workspace with a minimal Hog project for the integration tests
		const workspace = path.resolve(__dirname, '../../src/test/fixtures/workspace');

		// VS Code version to test against, e.g. VSCODE_TEST_VERSION=1.85.0 for the minimum supported one
		const version = process.env.VSCODE_TEST_VERSION || 'stable';
		let vscodeExecutablePath = await downloadAndUnzipVSCode(version);
		// Recent macOS builds renamed Contents/MacOS/Electron to Contents/MacOS/Code
		const renamed = path.join(path.dirname(vscodeExecutablePath), 'Code');
		if (!fs.existsSync(vscodeExecutablePath) && fs.existsSync(renamed)) {
			vscodeExecutablePath = renamed;
		}

		await runTests({
			vscodeExecutablePath,
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [workspace, '--disable-extensions'],
		});
	} catch (err) {
		console.error('Failed to run tests', err);
		process.exit(1);
	}
}

main();
