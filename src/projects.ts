import * as vscode from 'vscode';
import * as path from 'path';
import { extensionOf, isDynamicPath, parseListLine } from './listParser';

export const LIST_EXTENSIONS = ['.src', '.sim', '.con', '.lst', '.ext', '.ipb', '.sub', '.prop'];
const PROJECT_FILE_EXTENSIONS = ['.xpr', '.qpf', '.ppr', '.ldf', '.prjx'];
const MAX_DEPTH = 5;

export interface HogProject {
	/** Name relative to Top/, e.g. "fifo" or "group/fifo" */
	name: string;
	/** Top/<name> */
	dir: vscode.Uri;
	/** Repository root */
	root: vscode.Uri;
	/** IDE project file once the project has been created */
	projectFile?: vscode.Uri;
}

export function workspaceRoot(): vscode.Uri | undefined {
	return vscode.workspace.workspaceFolders?.[0]?.uri;
}

async function readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
	try {
		return await vscode.workspace.fs.readDirectory(uri);
	} catch {
		return [];
	}
}

async function exists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

/** Finds every `Top/**\/hog.conf` project of the workspace, flagging the ones already created. */
export async function findProjects(root: vscode.Uri): Promise<HogProject[]> {
	const top = vscode.Uri.joinPath(root, 'Top');
	const projects: HogProject[] = [];

	const walk = async (dir: vscode.Uri, rel: string, depth: number): Promise<void> => {
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

	await Promise.all(projects.map(async project => {
		const prjDir = vscode.Uri.joinPath(root, 'Projects', ...project.name.split('/'));
		const file = (await readDirectory(prjDir))
			.find(([name, type]) => type === vscode.FileType.File && PROJECT_FILE_EXTENSIONS.includes(extensionOf(name)));
		if (file) {
			project.projectFile = vscode.Uri.joinPath(prjDir, file[0]);
		}
	}));

	return projects.sort((a, b) => a.name.localeCompare(b.name));
}

type HogNode = ProjectNode | ListFileNode | EntryNode;

interface ProjectNode { kind: 'project'; project: HogProject; }
interface ListFileNode { kind: 'file'; uri: vscode.Uri; root: vscode.Uri; depth: number; ancestors: string[]; }
interface EntryNode { kind: 'entry'; uri: vscode.Uri; label: string; description: string; missing: boolean; nested: boolean; root: vscode.Uri; depth: number; ancestors: string[]; }

export class HogProjectsProvider implements vscode.TreeDataProvider<HogNode>, vscode.Disposable {
	private readonly changed = new vscode.EventEmitter<HogNode | undefined>();
	readonly onDidChangeTreeData = this.changed.event;
	private projects: HogProject[] = [];
	private readonly watchers: vscode.Disposable[] = [];

	constructor() {
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

	refresh(): void {
		this.changed.fire(undefined);
	}

	/** Latest project list, for the command pickers. */
	async getProjects(): Promise<HogProject[]> {
		const root = workspaceRoot();
		this.projects = root ? await findProjects(root) : [];
		return this.projects;
	}

	async getChildren(element?: HogNode): Promise<HogNode[]> {
		if (!element) {
			return (await this.getProjects()).map(project => ({ kind: 'project', project } as ProjectNode));
		}
		if (element.kind === 'project') {
			return this.projectChildren(element.project);
		}
		if (element.kind === 'file') {
			return this.fileChildren(element.uri, element.root, element.depth, element.ancestors);
		}
		return element.nested ? this.fileChildren(element.uri, element.root, element.depth, element.ancestors) : [];
	}

	private async projectChildren(project: HogProject): Promise<HogNode[]> {
		const nodes: HogNode[] = [];
		const conf = vscode.Uri.joinPath(project.dir, 'hog.conf');
		nodes.push({ kind: 'file', uri: conf, root: project.root, depth: 0, ancestors: [] });
		const listDir = vscode.Uri.joinPath(project.dir, 'list');
		const files = (await readDirectory(listDir))
			.filter(([name, type]) => type === vscode.FileType.File && LIST_EXTENSIONS.includes(extensionOf(name)))
			.sort((a, b) => a[0].localeCompare(b[0]));
		for (const [name] of files) {
			nodes.push({ kind: 'file', uri: vscode.Uri.joinPath(listDir, name), root: project.root, depth: 0, ancestors: [] });
		}
		return nodes;
	}

	private async fileChildren(uri: vscode.Uri, root: vscode.Uri, depth: number, ancestors: string[]): Promise<HogNode[]> {
		const listExt = extensionOf(uri.fsPath);
		if (!LIST_EXTENSIONS.includes(listExt) || depth > 8 || ancestors.includes(uri.fsPath)) {
			return [];
		}
		let text: string;
		try {
			text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
		} catch {
			return [];
		}

		const nodes: Promise<EntryNode>[] = [];
		for (const line of text.split(/\r?\n/)) {
			const parsed = parseListLine(line, listExt);
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

	private async entryNode(entry: string, modifiers: string, root: vscode.Uri, depth: number, ancestors: string[]): Promise<EntryNode> {
		const uri = path.isAbsolute(entry) ? vscode.Uri.file(entry) : vscode.Uri.joinPath(root, entry);
		const dynamic = isDynamicPath(entry);
		const missing = dynamic ? false : !(await exists(uri));
		const dir = path.dirname(entry);
		return {
			kind: 'entry',
			uri,
			label: path.basename(entry),
			description: [dir === '.' ? '' : dir, modifiers].filter(Boolean).join('  '),
			missing,
			nested: LIST_EXTENSIONS.includes(extensionOf(entry)) && !dynamic,
			root,
			depth,
			ancestors,
		};
	}

	getTreeItem(node: HogNode): vscode.TreeItem {
		if (node.kind === 'project') {
			const { project } = node;
			const item = new vscode.TreeItem(project.name, vscode.TreeItemCollapsibleState.Collapsed);
			item.description = project.projectFile ? 'created' : 'not created';
			item.iconPath = new vscode.ThemeIcon(
				project.projectFile ? 'circuit-board' : 'circle-large-outline',
				project.projectFile ? new vscode.ThemeColor('charts.green') : undefined);
			item.contextValue = project.projectFile ? 'hogProject.created' : 'hogProject.new';
			item.tooltip = new vscode.MarkdownString(`**${project.name}**\n\n${project.projectFile ? project.projectFile.fsPath : 'Project not created yet'}`);
			return item;
		}

		if (node.kind === 'file') {
			const isConf = path.basename(node.uri.fsPath) === 'hog.conf';
			const item = new vscode.TreeItem(path.basename(node.uri.fsPath),
				isConf ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
			item.resourceUri = node.uri;
			item.iconPath = new vscode.ThemeIcon(isConf ? 'settings-gear' : 'list-flat');
			item.command = { command: 'vscode.open', title: 'Open', arguments: [node.uri] };
			item.contextValue = 'hogListFile';
			return item;
		}

		const item = new vscode.TreeItem(node.label,
			node.nested ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		item.description = node.description;
		item.resourceUri = node.uri;
		item.command = { command: 'vscode.open', title: 'Open', arguments: [node.uri] };
		item.contextValue = 'hogEntry';
		if (node.missing) {
			item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
			item.tooltip = `${node.uri.fsPath}\n(file not found)`;
		} else {
			item.tooltip = node.uri.fsPath;
		}
		return item;
	}

	dispose(): void {
		this.watchers.forEach(w => w.dispose());
		this.changed.dispose();
	}
}
