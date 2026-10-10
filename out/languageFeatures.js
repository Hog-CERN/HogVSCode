"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLanguageFeatures = void 0;
const vscode = require("vscode");
const path = require("path");
const hogData_1 = require("./hogData");
const listParser_1 = require("./listParser");
const LIST_SELECTOR = { language: 'hog' };
const CONF_SELECTOR = { language: 'hog-conf' };
const SECTION_RE = /^\s*\[([\w.]+)\]\s*$/;
const PROPERTY_RE = /^\s*([A-Za-z_][\w.]*)\s*=/;
const KNOWN_MODIFIERS = new Set([
    ...Object.values(hogData_1.ALLOWED_MODIFIERS).reduce((all, mods) => all.concat(mods), []),
    ...Object.keys(hogData_1.MODIFIER_DOCS),
]);
function listExt(doc) {
    return (0, listParser_1.extensionOf)(doc.uri.fsPath);
}
function repoRoot(doc) {
    return (0, listParser_1.repoRootFromListPath)(doc.uri.fsPath) ?? vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath;
}
function resolvePath(doc, entry) {
    if (path.isAbsolute(entry)) {
        return vscode.Uri.file(entry);
    }
    const root = repoRoot(doc);
    return root ? vscode.Uri.file(path.join(root, entry)) : undefined;
}
class HogHoverProvider {
    provideHover(doc, position) {
        const line = doc.lineAt(position.line).text;
        const section = SECTION_RE.exec(line);
        if (section && hogData_1.SECTION_DOCS[section[1]]) {
            return new vscode.Hover(new vscode.MarkdownString(`**[${section[1]}]**\n\n${hogData_1.SECTION_DOCS[section[1]]}`));
        }
        const parsed = (0, listParser_1.parseListLine)(line, listExt(doc));
        if (!parsed) {
            return undefined;
        }
        for (const m of parsed.modifiers) {
            if (position.character < m.start || position.character > m.end) {
                continue;
            }
            const key = m.text.split('=')[0];
            const docs = hogData_1.MODIFIER_DOCS[key];
            if (docs) {
                return new vscode.Hover(new vscode.MarkdownString(`**${key}**\n\n${docs}`), new vscode.Range(position.line, m.start, position.line, m.end));
            }
        }
        return undefined;
    }
}
class HogCompletionProvider {
    provideCompletionItems(doc, position) {
        const prefix = doc.lineAt(position.line).text.slice(0, position.character);
        if (doc.languageId === 'hog-conf') {
            if (/^\s*\[\w*$/.test(prefix)) {
                return hogData_1.CONF_SECTIONS.map(name => {
                    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);
                    item.documentation = new vscode.MarkdownString(hogData_1.SECTION_DOCS[name]);
                    item.insertText = name + ']';
                    return item;
                });
            }
            return [];
        }
        if (/^\s*\[\w*$/.test(prefix)) {
            return ['files', 'properties'].map(name => {
                const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);
                item.documentation = new vscode.MarkdownString(hogData_1.SECTION_DOCS[name]);
                item.insertText = name + ']';
                return item;
            });
        }
        // After a file path: offer the modifiers valid for that file type.
        const parsed = (0, listParser_1.parseListLine)(prefix, listExt(doc));
        const ext = listExt(doc);
        if (!parsed || parsed.paths.length === 0 || ext === '.ext' || ext === '.ipb' || !/\s$/.test(prefix)) {
            return [];
        }
        const fileExt = (0, listParser_1.extensionOf)(parsed.paths[0].text);
        const flags = hogData_1.ALLOWED_MODIFIERS[fileExt] ?? [];
        const used = new Set(parsed.modifiers.map(m => m.text.split('=')[0]));
        const items = [];
        for (const flag of flags) {
            if (used.has(flag)) {
                continue;
            }
            const item = new vscode.CompletionItem(flag, vscode.CompletionItemKind.Keyword);
            item.documentation = new vscode.MarkdownString(hogData_1.MODIFIER_DOCS[flag] ?? '');
            items.push(item);
        }
        for (const key of hogData_1.KEY_VALUE_MODIFIERS) {
            if (used.has(key) || (key === 'topsim' && ext !== '.sim')) {
                continue;
            }
            const item = new vscode.CompletionItem(`${key}=`, vscode.CompletionItemKind.Property);
            item.insertText = new vscode.SnippetString(`${key}=\${1:name}`);
            item.documentation = new vscode.MarkdownString(hogData_1.MODIFIER_DOCS[key]);
            items.push(item);
        }
        return items;
    }
}
class HogLinkProvider {
    provideDocumentLinks(doc) {
        const links = [];
        const ext = listExt(doc);
        for (let i = 0; i < doc.lineCount; i++) {
            const parsed = (0, listParser_1.parseListLine)(doc.lineAt(i).text, ext);
            for (const p of parsed?.paths ?? []) {
                if ((0, listParser_1.isDynamicPath)(p.text)) {
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
class HogSymbolProvider {
    provideDocumentSymbols(doc) {
        const ext = listExt(doc);
        const isConf = doc.languageId === 'hog-conf';
        const roots = [];
        let section;
        const closeSection = (endLine) => {
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
                section = new vscode.DocumentSymbol(sectionMatch[1], '', vscode.SymbolKind.Namespace, doc.lineAt(i).range, doc.lineAt(i).range);
                roots.push(section);
                continue;
            }
            let symbol;
            if (isConf || PROPERTY_RE.test(text)) {
                const prop = PROPERTY_RE.exec(text);
                if (prop && !text.trim().startsWith('#')) {
                    symbol = new vscode.DocumentSymbol(prop[1], text.slice(text.indexOf('=') + 1).trim(), vscode.SymbolKind.Property, doc.lineAt(i).range, doc.lineAt(i).range);
                }
            }
            else {
                const entry = (0, listParser_1.parseListLine)(text, ext)?.paths[0];
                if (entry) {
                    symbol = new vscode.DocumentSymbol(path.basename(entry.text), path.dirname(entry.text), vscode.SymbolKind.File, doc.lineAt(i).range, doc.lineAt(i).range);
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
class HogDiagnostics {
    constructor() {
        this.collection = vscode.languages.createDiagnosticCollection('hog');
        this.timers = new Map();
    }
    async validate(doc) {
        if (doc.languageId !== 'hog') {
            return;
        }
        if (!vscode.workspace.getConfiguration('hog').get('diagnostics.enable', true)) {
            this.collection.delete(doc.uri);
            return;
        }
        const ext = listExt(doc);
        const diagnostics = [];
        const checks = [];
        for (let i = 0; i < doc.lineCount; i++) {
            const parsed = (0, listParser_1.parseListLine)(doc.lineAt(i).text, ext);
            if (!parsed) {
                continue;
            }
            const line = i;
            for (const p of parsed.paths) {
                const target = (0, listParser_1.isDynamicPath)(p.text) ? undefined : resolvePath(doc, p.text);
                if (!target) {
                    continue;
                }
                checks.push(Promise.resolve(vscode.workspace.fs.stat(target)).then(() => undefined, () => {
                    const d = new vscode.Diagnostic(new vscode.Range(line, p.start, line, p.end), `File not found: ${p.text}`, vscode.DiagnosticSeverity.Warning);
                    d.source = 'hog';
                    diagnostics.push(d);
                }));
            }
            for (const m of parsed.modifiers) {
                const isKeyValue = m.text.includes('=');
                if (isKeyValue || m.text.startsWith('--') || KNOWN_MODIFIERS.has(m.text)) {
                    continue;
                }
                const d = new vscode.Diagnostic(new vscode.Range(line, m.start, line, m.end), `Unknown Hog modifier "${m.text}"`, vscode.DiagnosticSeverity.Warning);
                d.source = 'hog';
                diagnostics.push(d);
            }
        }
        await Promise.all(checks);
        this.collection.set(doc.uri, diagnostics);
    }
    schedule(doc) {
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
    revalidateAll() {
        vscode.workspace.textDocuments.forEach(doc => this.schedule(doc));
    }
    forget(doc) {
        this.collection.delete(doc.uri);
    }
    dispose() {
        this.timers.forEach(t => clearTimeout(t));
        this.collection.dispose();
    }
}
function registerLanguageFeatures(context) {
    const diagnostics = new HogDiagnostics();
    const hover = new HogHoverProvider();
    const completion = new HogCompletionProvider();
    const symbols = new HogSymbolProvider();
    context.subscriptions.push(diagnostics, vscode.languages.registerHoverProvider([LIST_SELECTOR, CONF_SELECTOR], hover), vscode.languages.registerCompletionItemProvider([LIST_SELECTOR, CONF_SELECTOR], completion, ' ', '['), vscode.languages.registerDocumentLinkProvider(LIST_SELECTOR, new HogLinkProvider()), vscode.languages.registerDocumentSymbolProvider([LIST_SELECTOR, CONF_SELECTOR], symbols), vscode.workspace.onDidOpenTextDocument(doc => diagnostics.schedule(doc)), vscode.workspace.onDidChangeTextDocument(e => diagnostics.schedule(e.document)), vscode.workspace.onDidCloseTextDocument(doc => diagnostics.forget(doc)), vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('hog.diagnostics')) {
            diagnostics.revalidateAll();
        }
    }));
    // A referenced file appearing or disappearing changes the diagnostics of every open list file.
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    watcher.onDidCreate(() => diagnostics.revalidateAll());
    watcher.onDidDelete(() => diagnostics.revalidateAll());
    context.subscriptions.push(watcher);
    diagnostics.revalidateAll();
}
exports.registerLanguageFeatures = registerLanguageFeatures;
//# sourceMappingURL=languageFeatures.js.map