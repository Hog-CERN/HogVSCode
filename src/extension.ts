import * as vscode from 'vscode';
import { DIRECTIVES, getDirective } from './hogData';
import { HogRunner } from './hogRunner';
import { HierarchyData, HogHierarchyProvider } from './hierarchyView';
import { countNodes, parseHierarchy } from './hierarchyParser';
import { registerLanguageFeatures } from './languageFeatures';
import { extensionOf } from './listParser';
import { HogProject, HogProjectsProvider, workspaceRoot } from './projects';

/** Commands that run a `Hog/Do <DIRECTIVE> <project>`, with the directive they map to. */
const DIRECTIVE_COMMANDS: [string, string][] = [
	['hog.createproject', 'CREATE'],
	['hog.workflow', 'WORKFLOW'],
	['hog.synthesis', 'SYNTHESIS'],
	['hog.implementation', 'IMPLEMENTATION'],
	['hog.simulation', 'SIMULATION'],
	['hog.checksyntax', 'CHECKSYNTAX'],
	['hog.checklist', 'CHECKLIST'],
];

export function activate(context: vscode.ExtensionContext) {
	const runner = new HogRunner();
	const projects = new HogProjectsProvider();
	const tree = vscode.window.createTreeView('hog.projects', { treeDataProvider: projects });

	const hierarchy = new HogHierarchyProvider();
	const hierarchyView = vscode.window.createTreeView('hog.hierarchy', { treeDataProvider: hierarchy });
	const HIERARCHY_KEY = 'hog.hierarchy';

	const showHierarchy = (data: HierarchyData | undefined) => {
		hierarchy.set(data);
		hierarchyView.description = hierarchy.describe();
	};
	const saved = context.workspaceState.get<HierarchyData>(HIERARCHY_KEY);
	if (saved) {
		showHierarchy(saved);
	}

	context.subscriptions.push(runner, projects, tree, hierarchy, hierarchyView);
	registerLanguageFeatures(context);

	/** Resolves the project a command acts on: the tree item it was invoked from, or a quick pick. */
	async function pickProject(arg: unknown, placeHolder: string): Promise<HogProject | undefined> {
		const fromTree = (arg as { project?: HogProject } | undefined)?.project;
		if (fromTree) {
			return fromTree;
		}
		const all = await projects.getProjects();
		if (all.length === 0) {
			vscode.window.showInformationMessage('No Hog projects found: expected Top/<project>/hog.conf in the workspace.');
			return undefined;
		}
		const picked = await vscode.window.showQuickPick(
			all.map(project => ({
				label: project.name,
				description: project.projectFile ? 'created' : 'not created',
				project,
			})),
			{ placeHolder });
		return picked?.project;
	}

	async function runDirective(directive: string, arg?: unknown): Promise<void> {
		const info = getDirective(directive);
		const project = await pickProject(arg, `${info.description}: choose a project`);
		const root = workspaceRoot();
		if (!project || !root) {
			return;
		}
		runner.run({
			label: info.directive,
			project: project.name,
			command: HogRunner.doScript(root.fsPath),
			args: [info.directive, project.name],
			cwd: root.fsPath,
		});
	}

	/** Runs `Hog/Do TREE <project>` and shows the printed design hierarchy in the Hierarchy view. */
	async function runHierarchy(arg?: unknown): Promise<void> {
		const project = await pickProject(arg, 'Show the hierarchy of which project?');
		const root = workspaceRoot();
		if (!project || !root) {
			return;
		}
		const result = await runner.run({
			label: 'TREE',
			project: project.name,
			command: HogRunner.doScript(root.fsPath),
			args: ['TREE', project.name],
			cwd: root.fsPath,
		});
		if (!result) {
			return; // another command is running
		}
		if (result.code !== 0) {
			if (result.code !== undefined) {
				vscode.window.showErrorMessage(`Hog TREE failed for ${project.name} (exit code ${result.code}). See the Hog output.`);
			}
			return;
		}
		const parsed = parseHierarchy(result.output);
		if (parsed.roots.length === 0) {
			vscode.window.showWarningMessage(
				`Hog printed no hierarchy for ${project.name}. Is a top module set with top=<module> in a .src list file?`);
			return;
		}
		const data: HierarchyData = { project: project.name, root: root.fsPath, result: parsed, generated: Date.now() };
		showHierarchy(data);
		await context.workspaceState.update(HIERARCHY_KEY, data);
		vscode.window.setStatusBarMessage(`Hog: ${countNodes(parsed.roots)} modules in ${project.name}`, 4000);
		await vscode.commands.executeCommand('hog.hierarchy.focus');
	}

	async function openProject(arg?: unknown): Promise<void> {
		const project = await pickProject(arg, 'Open which project in the IDE?');
		const root = workspaceRoot();
		if (!project || !root) {
			return;
		}
		if (!project.projectFile) {
			const choice = await vscode.window.showWarningMessage(
				`Project ${project.name} has not been created yet.`, 'Create it');
			if (choice === 'Create it') {
				await runDirective('CREATE', { project });
			}
			return;
		}
		const config = vscode.workspace.getConfiguration('hog');
		const ext = extensionOf(project.projectFile.fsPath);
		let command: string;
		if (ext === '.xpr') {
			command = config.get<string>('vivadoPath', 'vivado');
		} else if (ext === '.qpf') {
			command = config.get<string>('quartusPath', 'quartus');
		} else {
			vscode.window.showWarningMessage(`Opening ${ext} projects is not supported yet.`);
			return;
		}
		runner.run({
			label: 'OPEN',
			project: project.name,
			command,
			args: [project.projectFile.fsPath],
			cwd: root.fsPath,
		});
	}

	async function showMenu(): Promise<void> {
		type MenuItem = vscode.QuickPickItem & { command: string };
		const items: MenuItem[] = [];
		if (runner.isRunning) {
			items.push({ label: '$(debug-stop) Stop running command', command: 'hog.stop' });
		}
		for (const [command, directive] of DIRECTIVE_COMMANDS) {
			const info = DIRECTIVES.find(d => d.directive === directive)!;
			items.push({ label: `$(${info.icon}) ${info.label}`, description: info.description, command });
		}
		items.push({ label: '$(type-hierarchy) Show design hierarchy', description: 'Hog TREE', command: 'hog.hierarchy' });
		items.push({ label: '$(link-external) Open project in IDE', command: 'hog.openproject' });
		items.push({ label: '$(refresh) Refresh projects', command: 'hog.refresh' });
		const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Hog' });
		if (picked) {
			await vscode.commands.executeCommand(picked.command);
		}
	}

	for (const [command, directive] of DIRECTIVE_COMMANDS) {
		context.subscriptions.push(
			vscode.commands.registerCommand(command, (arg?: unknown) => runDirective(directive, arg)));
	}
	context.subscriptions.push(
		vscode.commands.registerCommand('hog.hierarchy', (arg?: unknown) => runHierarchy(arg)),
		vscode.commands.registerCommand('hog.clearhierarchy', async () => {
			showHierarchy(undefined);
			await context.workspaceState.update(HIERARCHY_KEY, undefined);
		}),
		vscode.commands.registerCommand('hog.openproject', (arg?: unknown) => openProject(arg)),
		vscode.commands.registerCommand('hog.stop', () => runner.stop()),
		vscode.commands.registerCommand('hog.refresh', () => projects.refresh()),
		vscode.commands.registerCommand('hog.showMenu', () => showMenu()),
	);
}

export function deactivate() { }
