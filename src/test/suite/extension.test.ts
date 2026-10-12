import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { configuredDirectories, toolReport } from '../../tools';

const WORKSPACE = path.resolve(__dirname, '../../../src/test/fixtures/workspace');
const LIST_FILE = vscode.Uri.file(path.join(WORKSPACE, 'Top/demo/list/demo.src'));

function demoProject() {
	return {
		name: 'demo',
		dir: vscode.Uri.file(path.join(WORKSPACE, 'Top/demo')),
		root: vscode.Uri.file(WORKSPACE),
	};
}

async function waitFor<T>(probe: () => Thenable<T> | T, ok: (value: T) => boolean, timeoutMs = 5000): Promise<T> {
	const end = Date.now() + timeoutMs;
	let value = await probe();
	while (!ok(value) && Date.now() < end) {
		await new Promise(resolve => setTimeout(resolve, 100));
		value = await probe();
	}
	return value;
}

suite('Extension (integration)', () => {
	let doc: vscode.TextDocument;

	suiteSetup(async () => {
		doc = await vscode.workspace.openTextDocument(LIST_FILE);
		await vscode.window.showTextDocument(doc);
		const extension = vscode.extensions.getExtension('DavideCieri.hog');
		assert.ok(extension, 'extension not found');
		await extension.activate();
	});

	test('list files get the hog language', () => {
		assert.strictEqual(doc.languageId, 'hog');
	});

	test('reports missing files and unknown modifiers', async () => {
		const diagnostics = await waitFor(
			() => vscode.languages.getDiagnostics(LIST_FILE),
			d => d.length >= 2);
		const messages = diagnostics.map(d => d.message);
		assert.ok(messages.some(m => m.includes('File not found: src/missing.vhd')), messages.join('\n'));
		assert.ok(messages.some(m => m.includes('Unknown Hog modifier "bogusflag"')), messages.join('\n'));
		assert.ok(!messages.some(m => m.includes('src/demo.vhd')), 'existing file flagged as missing');
	});

	test('hover documents modifiers', async () => {
		const position = new vscode.Position(1, doc.lineAt(1).text.indexOf('top=') + 1);
		const hovers = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', LIST_FILE, position);
		const text = hovers.flatMap(h => h.contents.map(c => (c as vscode.MarkdownString).value ?? String(c))).join('\n');
		assert.ok(text.includes('top'), text);
	});

	test('outline lists the files', async () => {
		const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', LIST_FILE);
		assert.deepStrictEqual(symbols.map(s => s.name), ['demo.vhd', 'missing.vhd', 'demo.vhd']);
	});

	test('paths are links', async () => {
		const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>('vscode.executeLinkProvider', LIST_FILE);
		assert.strictEqual(links.length, 3);
	});

	test('build errors appear in the Problems panel', async () => {
		const project = demoProject();
		const source = vscode.Uri.file(path.join(WORKSPACE, 'src/demo.vhd'));
		const conf = vscode.Uri.file(path.join(WORKSPACE, 'Top/demo/hog.conf'));
		// Runs the fake Hog/Do of the fixture, which prints messages and exits with 1
		await vscode.commands.executeCommand('hog.checklist', { project });

		const onSource = await waitFor(() => vscode.languages.getDiagnostics(source), d => d.length > 0);
		assert.strictEqual(onSource.length, 1, 'plain warnings are hidden by default');
		assert.strictEqual(onSource[0].message, "module 'fifo' not found");
		assert.strictEqual(onSource[0].range.start.line, 3);
		assert.strictEqual(onSource[0].severity, vscode.DiagnosticSeverity.Error);
		assert.strictEqual(onSource[0].source, 'Synth');

		const onConf = vscode.languages.getDiagnostics(conf);
		assert.deepStrictEqual(onConf.map(d => d.message), ['CRITICAL WARNING: list file is out of date']);

		await vscode.commands.executeCommand('hog.clearProblems');
		assert.strictEqual(vscode.languages.getDiagnostics(source).length, 0);
	});

	test('configured IDE directories reach Hog/Do', async () => {
		const toolDir = path.resolve(WORKSPACE, '../tools/bin');
		const config = vscode.workspace.getConfiguration('hog.tools');
		await config.update('vivado', toolDir, vscode.ConfigurationTarget.Global);
		try {
			const report = toolReport();
			const vivado = report.tools.find(t => t.tool.id === 'vivado')!;
			assert.strictEqual(vivado.found, path.join(toolDir, 'vivado'));
			assert.strictEqual(vivado.misconfigured, false);
			assert.deepStrictEqual(report.launcher, { name: 'vivado', path: path.join(toolDir, 'vivado') });

			// The fake Hog/Do reports `command -v vivado` as an error on hog.conf
			const conf = vscode.Uri.file(path.join(WORKSPACE, 'Top/demo/hog.conf'));
			await vscode.commands.executeCommand('hog.checksyntax', { project: demoProject() });
			const diagnostics = await waitFor(() => vscode.languages.getDiagnostics(conf), d => d.some(x => x.message.startsWith('vivado=')));
			assert.ok(diagnostics.some(d => d.message === `vivado=${path.join(toolDir, 'vivado')}`), diagnostics.map(d => d.message).join('\n'));
		} finally {
			await config.update('vivado', undefined, vscode.ConfigurationTarget.Global);
		}
	});

	test('a full hog.vivadoPath also reaches Hog/Do', async () => {
		const vivado = path.resolve(WORKSPACE, '../tools/bin/vivado');
		const config = vscode.workspace.getConfiguration('hog');
		await config.update('vivadoPath', vivado, vscode.ConfigurationTarget.Global);
		try {
			assert.ok(configuredDirectories().includes(path.dirname(vivado)));
			const conf = vscode.Uri.file(path.join(WORKSPACE, 'Top/demo/hog.conf'));
			await vscode.commands.executeCommand('hog.checksyntax', { project: demoProject() });
			const diagnostics = await waitFor(() => vscode.languages.getDiagnostics(conf), d => d.some(x => x.message === `vivado=${vivado}`));
			assert.ok(diagnostics.some(d => d.message === `vivado=${vivado}`), diagnostics.map(d => d.message).join('\n'));
		} finally {
			await config.update('vivadoPath', undefined, vscode.ConfigurationTarget.Global);
		}
	});

	test('a wrong IDE directory is reported', async () => {
		const config = vscode.workspace.getConfiguration('hog.tools');
		await config.update('quartus', '/nonexistent/quartus/bin', vscode.ConfigurationTarget.Global);
		try {
			const quartus = toolReport().tools.find(t => t.tool.id === 'quartus')!;
			assert.strictEqual(quartus.misconfigured, true);
		} finally {
			await config.update('quartus', undefined, vscode.ConfigurationTarget.Global);
		}
	});

	test('commands are registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		for (const id of ['hog.createproject', 'hog.workflow', 'hog.hierarchy', 'hog.refresh', 'hog.stop', 'hog.configureTools', 'hog.checkTools']) {
			assert.ok(commands.includes(id), id);
		}
		await vscode.commands.executeCommand('hog.refresh');
	});
});
