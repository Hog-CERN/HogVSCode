"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HogProjectsProvider = exports.findProjects = exports.workspaceRoot = exports.LIST_EXTENSIONS = void 0;
const vscode = require("vscode");
const path = require("path");
const listParser_1 = require("./listParser");
exports.LIST_EXTENSIONS = ['.src', '.sim', '.con', '.lst', '.ext', '.ipb', '.sub', '.prop'];
const PROJECT_FILE_EXTENSIONS = ['.xpr', '.qpf', '.ppr', '.ldf', '.prjx'];
const MAX_DEPTH = 5;
function workspaceRoot() {
    return vscode.workspace.workspaceFolders?.[0]?.uri;
}
exports.workspaceRoot = workspaceRoot;
async function readDirectory(uri) {
    try {
        return await vscode.workspace.fs.readDirectory(uri);
    }
    catch {
        return [];
    }
}
async function exists(uri) {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    }
    catch {
        return false;
    }
}
/** Finds every `Top/**\/hog.conf` project of the workspace, flagging the ones already created. */
async function findProjects(root) {
    const top = vscode.Uri.joinPath(root, 'Top');
    const projects = [];
    const walk = async (dir, rel, depth) => {
        const entries = await readDirectory(dir);
        if (entries.some(([name, type]) => name === 'hog.conf' && type !== vscode.FileType.Directory)) {
            projects.push({ name: rel, dir, root });
            return; // projects do not nest
        }
        if (depth >= MAX_DEPTH) {
            return;
        }
        await Promise.all(entries
            .filter(([name, type]) => (type & vscode.FileType.Directory) && !name.startsWith('.'))
            .map(([name]) => walk(vscode.Uri.joinPath(dir, name), rel ? `${rel}/${name}` : name, depth + 1)));
    };
    await walk(top, '', 0);
    await Promise.all(projects.map(async (project) => {
        const prjDir = vscode.Uri.joinPath(root, 'Projects', ...project.name.split('/'));
        const file = (await readDirectory(prjDir))
            .find(([name, type]) => type === vscode.FileType.File && PROJECT_FILE_EXTENSIONS.includes((0, listParser_1.extensionOf)(name)));
        if (file) {
            project.projectFile = vscode.Uri.joinPath(prjDir, file[0]);
        }
    }));
    return projects.sort((a, b) => a.name.localeCompare(b.name));
}
exports.findProjects = findProjects;
class HogProjectsProvider {
    constructor() {
        this.changed = new vscode.EventEmitter();
        this.onDidChangeTreeData = this.changed.event;
        this.projects = [];
        this.watchers = [];
        const root = workspaceRoot();
        if (root) {
            for (const glob of ['Top/**', 'Projects/**/*.xpr', 'Projects/**/*.qpf']) {
                const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, glob));
                watcher.onDidCreate(() => this.refresh());
                watcher.onDidDelete(() => this.refresh());
                watcher.onDidChange(() => this.refresh());
                this.watchers.push(watcher);
            }
        }
    }
    refresh() {
        this.changed.fire(undefined);
    }
    /** Latest project list, for the command pickers. */
    async getProjects() {
        const root = workspaceRoot();
        this.projects = root ? await findProjects(root) : [];
        return this.projects;
    }
    async getChildren(element) {
        if (!element) {
            return (await this.getProjects()).map(project => ({ kind: 'project', project }));
        }
        if (element.kind === 'project') {
            return this.projectChildren(element.project);
        }
        if (element.kind === 'file') {
            return this.fileChildren(element.uri, element.root, element.depth, element.ancestors);
        }
        return element.nested ? this.fileChildren(element.uri, element.root, element.depth, element.ancestors) : [];
    }
    async projectChildren(project) {
        const nodes = [];
        const conf = vscode.Uri.joinPath(project.dir, 'hog.conf');
        nodes.push({ kind: 'file', uri: conf, root: project.root, depth: 0, ancestors: [] });
        const listDir = vscode.Uri.joinPath(project.dir, 'list');
        const files = (await readDirectory(listDir))
            .filter(([name, type]) => type === vscode.FileType.File && exports.LIST_EXTENSIONS.includes((0, listParser_1.extensionOf)(name)))
            .sort((a, b) => a[0].localeCompare(b[0]));
        for (const [name] of files) {
            nodes.push({ kind: 'file', uri: vscode.Uri.joinPath(listDir, name), root: project.root, depth: 0, ancestors: [] });
        }
        return nodes;
    }
    async fileChildren(uri, root, depth, ancestors) {
        const listExt = (0, listParser_1.extensionOf)(uri.fsPath);
        if (!exports.LIST_EXTENSIONS.includes(listExt) || depth > 8 || ancestors.includes(uri.fsPath)) {
            return [];
        }
        let text;
        try {
            text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
        }
        catch {
            return [];
        }
        const nodes = [];
        for (const line of text.split(/\r?\n/)) {
            const parsed = (0, listParser_1.parseListLine)(line, listExt);
            if (!parsed) {
                continue;
            }
            parsed.paths.forEach((p, i) => {
                const modifiers = i === 0 ? parsed.modifiers.map(m => m.text).join(' ') : '';
                nodes.push(this.entryNode(p.text, modifiers, root, depth + 1, [...ancestors, uri.fsPath]));
            });
        }
        return Promise.all(nodes);
    }
    async entryNode(entry, modifiers, root, depth, ancestors) {
        const uri = path.isAbsolute(entry) ? vscode.Uri.file(entry) : vscode.Uri.joinPath(root, entry);
        const dynamic = (0, listParser_1.isDynamicPath)(entry);
        const missing = dynamic ? false : !(await exists(uri));
        const dir = path.dirname(entry);
        return {
            kind: 'entry',
            uri,
            label: path.basename(entry),
            description: [dir === '.' ? '' : dir, modifiers].filter(Boolean).join('  '),
            missing,
            nested: exports.LIST_EXTENSIONS.includes((0, listParser_1.extensionOf)(entry)) && !dynamic,
            root,
            depth,
            ancestors,
        };
    }
    getTreeItem(node) {
        if (node.kind === 'project') {
            const { project } = node;
            const item = new vscode.TreeItem(project.name, vscode.TreeItemCollapsibleState.Collapsed);
            item.description = project.projectFile ? 'created' : 'not created';
            item.iconPath = new vscode.ThemeIcon(project.projectFile ? 'circuit-board' : 'circle-large-outline', project.projectFile ? new vscode.ThemeColor('charts.green') : undefined);
            item.contextValue = project.projectFile ? 'hogProject.created' : 'hogProject.new';
            item.tooltip = new vscode.MarkdownString(`**${project.name}**\n\n${project.projectFile ? project.projectFile.fsPath : 'Project not created yet'}`);
            return item;
        }
        if (node.kind === 'file') {
            const isConf = path.basename(node.uri.fsPath) === 'hog.conf';
            const item = new vscode.TreeItem(path.basename(node.uri.fsPath), isConf ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
            item.resourceUri = node.uri;
            item.iconPath = new vscode.ThemeIcon(isConf ? 'settings-gear' : 'list-flat');
            item.command = { command: 'vscode.open', title: 'Open', arguments: [node.uri] };
            item.contextValue = 'hogListFile';
            return item;
        }
        const item = new vscode.TreeItem(node.label, node.nested ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        item.description = node.description;
        item.resourceUri = node.uri;
        item.command = { command: 'vscode.open', title: 'Open', arguments: [node.uri] };
        item.contextValue = 'hogEntry';
        if (node.missing) {
            item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
            item.tooltip = `${node.uri.fsPath}\n(file not found)`;
        }
        else {
            item.tooltip = node.uri.fsPath;
        }
        return item;
    }
    dispose() {
        this.watchers.forEach(w => w.dispose());
        this.changed.dispose();
    }
}
exports.HogProjectsProvider = HogProjectsProvider;
//# sourceMappingURL=projects.js.map