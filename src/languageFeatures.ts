import * as vscode from 'vscode';
import * as path from 'path';
import {
	ALLOWED_MODIFIERS, CONF_SECTIONS, KEY_VALUE_MODIFIERS, MODIFIER_DOCS, SECTION_DOCS,
} from './hogData';
import { extensionOf, isDynamicPath, parseListLine, repoRootFromListPath } from './listParser';

const LIST_SELECTOR: vscode.DocumentFilter = { language: 'hog' };
const CONF_SELECTOR: vscode.DocumentFilter = { language: 'hog-conf' };
const SECTION_RE = /^\s*\[([\w.]+)\]\s*$/;
const PROPERTY_RE = /^\s*([A-Za-z_][\w.]*)\s*=/;

const KNOWN_MODIFIERS = new Set<string>([
	...Object.values(ALLOWED_MODIFIERS).reduce((all, mods) => all.concat(mods), [] as string[]),
	...Object.keys(MODIFIER_DOCS),
]);

function listExt(doc: vscode.TextDocument): string {
	return extensionOf(doc.uri.fsPath);
}

function repoRoot(doc: vscode.TextDocument): string | undefined {
	return repoRootFromListPath(doc.uri.fsPath) ?? vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath;
}

function resolvePath(doc: vscode.TextDocument, entry: string): vscode.Uri | undefined {
	if (path.isAbsolute(entry)) {
		return vscode.Uri.file(entry);
	}
	const root = repoRoot(doc);
	return root ? vscode.Uri.file(path.join(root, entry)) : undefined;
}

class HogHoverProvider implements vscode.HoverProvider {
	provideHover(doc: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
		const line = doc.lineAt(position.line).text;

		const section = SECTION_RE.exec(line);
		if (section && SECTION_DOCS[section[1]]) {
			return new vscode.Hover(new vscode.MarkdownString(`**[${section[1]}]**\n\n${SECTION_DOCS[section[1]]}`));
		}

		const parsed = parseListLine(line, listExt(doc));
		if (!parsed) {
			return undefined;
		}
		for (const m of parsed.modifiers) {
			if (position.character < m.start || position.character > m.end) {
				continue;
			}
			const key = m.text.split('=')[0];
			const docs = MODIFIER_DOCS[key];
			if (docs) {
				return new vscode.Hover(new vscode.MarkdownString(`**${key}**\n\n${docs}`),
					new vscode.Range(position.line, m.start, position.line, m.end));
			}
		}
		return undefined;
	}
}

class HogCompletionProvider implements vscode.CompletionItemProvider {
	provideCompletionItems(doc: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
		const prefix = doc.lineAt(position.line).text.slice(0, position.character);

		if (doc.languageId === 'hog-conf') {
			if (/^\s*\[\w*$/.test(prefix)) {
				return CONF_SECTIONS.map(name => {
					const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);
					item.documentation = new vscode.MarkdownString(SECTION_DOCS[name]);
					item.insertText = name + ']';
					return item;
				});
			}
			return [];
		}

		if (/^\s*\[\w*$/.test(prefix)) {
			return ['files', 'properties'].map(name => {
				const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);
				item.documentation = new vscode.MarkdownString(SECTION_DOCS[name]);
				item.insertText = name + ']';
				return item;
			});
		}

		// After a file path: offer the modifiers valid for that file type.
		const parsed = parseListLine(prefix, listExt(doc));
		const ext = listExt(doc);
		if (!parsed || parsed.paths.length === 0 || ext === '.ext' || ext === '.ipb' || !/\s$/.test(prefix)) {
			return [];
		}
		const fileExt = extensionOf(parsed.paths[0].text);
		const flags = ALLOWED_MODIFIERS[fileExt] ?? [];
		const used = new Set(parsed.modifiers.map(m => m.text.split('=')[0]));

		const items: vscode.CompletionItem[] = [];
		for (const flag of flags) {
			if (used.has(flag)) {
				continue;
			}
			const item = new vscode.CompletionItem(flag, vscode.CompletionItemKind.Keyword);
			item.documentation = new vscode.MarkdownString(MODIFIER_DOCS[flag] ?? '');
			items.push(item);
		}
		for (const key of KEY_VALUE_MODIFIERS) {
			if (used.has(key) || (key === 'topsim' && ext !== '.sim')) {
				continue;
			}
			const item = new vscode.CompletionItem(`${key}=`, vscode.CompletionItemKind.Property);
			item.insertText = new vscode.SnippetString(`${key}=\${1:name}`);
			item.documentation = new vscode.MarkdownString(MODIFIER_DOCS[key]);
			items.push(item);
		}
		return items;
	}
}

class HogLinkProvider implements vscode.DocumentLinkProvider {
	provideDocumentLinks(doc: vscode.TextDocument): vscode.DocumentLink[] {
		const links: vscode.DocumentLink[] = [];
		const ext = listExt(doc);
		for (let i = 0; i < doc.lineCount; i++) {
			const parsed = parseListLine(doc.lineAt(i).text, ext);
			for (const p of parsed?.paths ?? []) {
				if (isDynamicPath(p.text)) {
					continue;
				}
				const target = resolvePath(doc, p.text);
				if (target) {
					links.push(new vscode.DocumentLink(new vscode.Range(i, p.start, i, p.end), target));
				}
			}
		}
		return links;
	}
}

class HogSymbolProvider implements vscode.DocumentSymbolProvider {
	provideDocumentSymbols(doc: vscode.TextDocument): vscode.DocumentSymbol[] {
		const ext = listExt(doc);
		const isConf = doc.languageId === 'hog-conf';
		const roots: vscode.DocumentSymbol[] = [];
		let section: vscode.DocumentSymbol | undefined;

		const closeSection = (endLine: number) => {
			if (section) {
				const lastLine = Math.max(section.range.start.line, endLine);
				section.range = new vscode.Range(section.range.start, doc.lineAt(lastLine).range.end);
			}
		};

		for (let i = 0; i < doc.lineCount; i++) {
			const text = doc.lineAt(i).text;
			const sectionMatch = SECTION_RE.exec(text);
			if (sectionMatch) {
				closeSection(i - 1);
				section = new vscode.DocumentSymbol(sectionMatch[1], '', vscode.SymbolKind.Namespace,
					doc.lineAt(i).range, doc.lineAt(i).range);
				roots.push(section);
				continue;
			}

			let symbol: vscode.DocumentSymbol | undefined;
			if (isConf || PROPERTY_RE.test(text)) {
				const prop = PROPERTY_RE.exec(text);
				if (prop && !text.trim().startsWith('#')) {
					symbol = new vscode.DocumentSymbol(prop[1], text.slice(text.indexOf('=') + 1).trim(),
						vscode.SymbolKind.Property, doc.lineAt(i).range, doc.lineAt(i).range);
				}
			} else {
				const entry = parseListLine(text, ext)?.paths[0];
				if (entry) {
					symbol = new vscode.DocumentSymbol(path.basename(entry.text), path.dirname(entry.text),
						vscode.SymbolKind.File, doc.lineAt(i).range, doc.lineAt(i).range);
				}
			}
			if (symbol) {
				(section ? section.children : roots).push(symbol);
			}
		}
		closeSection(doc.lineCount - 1);
		return roots;
	}
}

class HogDiagnostics implements vscode.Disposable {
	private readonly collection = vscode.languages.createDiagnosticCollection('hog');
	private readonly timers = new Map<string, NodeJS.Timeout>();

	async validate(doc: vscode.TextDocument): Promise<void> {
		if (doc.languageId !== 'hog') {
			return;
		}
		if (!vscode.workspace.getConfiguration('hog').get<boolean>('diagnostics.enable', true)) {
			this.collection.delete(doc.uri);
			return;
		}

		const ext = listExt(doc);
		const diagnostics: vscode.Diagnostic[] = [];
		const checks: Promise<void>[] = [];

		for (let i = 0; i < doc.lineCount; i++) {
			const parsed = parseListLine(doc.lineAt(i).text, ext);
			if (!parsed) {
				continue;
			}
			const line = i;

			for (const p of parsed.paths) {
				const target = isDynamicPath(p.text) ? undefined : resolvePath(doc, p.text);
				if (!target) {
					continue;
				}
				checks.push(Promise.resolve(vscode.workspace.fs.stat(target)).then(() => undefined, () => {
					const d = new vscode.Diagnostic(new vscode.Range(line, p.start, line, p.end),
						`File not found: ${p.text}`, vscode.DiagnosticSeverity.Warning);
					d.source = 'hog';
					diagnostics.push(d);
				}));
			}

			for (const m of parsed.modifiers) {
				const isKeyValue = m.text.includes('=');
				if (isKeyValue || m.text.startsWith('--') || KNOWN_MODIFIERS.has(m.text)) {
					continue;
				}
				const d = new vscode.Diagnostic(new vscode.Range(line, m.start, line, m.end),
					`Unknown Hog modifier "${m.text}"`, vscode.DiagnosticSeverity.Warning);
				d.source = 'hog';
				diagnostics.push(d);
			}
		}

		await Promise.all(checks);
		this.collection.set(doc.uri, diagnostics);
	}

	schedule(doc: vscode.TextDocument): void {
		const key = doc.uri.toString();
		const pending = this.timers.get(key);
		if (pending) {
			clearTimeout(pending);
		}
		this.timers.set(key, setTimeout(() => {
			this.timers.delete(key);
			void this.validate(doc);
		}, 300));
	}

	revalidateAll(): void {
		vscode.workspace.textDocuments.forEach(doc => this.schedule(doc));
	}

	forget(doc: vscode.TextDocument): void {
		this.collection.delete(doc.uri);
	}

	dispose(): void {
		this.timers.forEach(t => clearTimeout(t));
		this.collection.dispose();
	}
}

export function registerLanguageFeatures(context: vscode.ExtensionContext): void {
	const diagnostics = new HogDiagnostics();
	const hover = new HogHoverProvider();
	const completion = new HogCompletionProvider();
	const symbols = new HogSymbolProvider();

	context.subscriptions.push(
		diagnostics,
		vscode.languages.registerHoverProvider([LIST_SELECTOR, CONF_SELECTOR], hover),
		vscode.languages.registerCompletionItemProvider([LIST_SELECTOR, CONF_SELECTOR], completion, ' ', '['),
		vscode.languages.registerDocumentLinkProvider(LIST_SELECTOR, new HogLinkProvider()),
		vscode.languages.registerDocumentSymbolProvider([LIST_SELECTOR, CONF_SELECTOR], symbols),
		vscode.workspace.onDidOpenTextDocument(doc => diagnostics.schedule(doc)),
		vscode.workspace.onDidChangeTextDocument(e => diagnostics.schedule(e.document)),
		vscode.workspace.onDidCloseTextDocument(doc => diagnostics.forget(doc)),
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('hog.diagnostics')) {
				diagnostics.revalidateAll();
			}
		}),
	);

	// A referenced file appearing or disappearing changes the diagnostics of every open list file.
	const watcher = vscode.workspace.createFileSystemWatcher('**/*');
	watcher.onDidCreate(() => diagnostics.revalidateAll());
	watcher.onDidDelete(() => diagnostics.revalidateAll());
	context.subscriptions.push(watcher);

	diagnostics.revalidateAll();
}
