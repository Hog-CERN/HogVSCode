"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const hogData_1 = require("./hogData");
const hogRunner_1 = require("./hogRunner");
const languageFeatures_1 = require("./languageFeatures");
const listParser_1 = require("./listParser");
const projects_1 = require("./projects");
/** Commands that run a `Hog/Do <DIRECTIVE> <project>`, with the directive they map to. */
const DIRECTIVE_COMMANDS = [
    ['hog.createproject', 'CREATE'],
    ['hog.workflow', 'WORKFLOW'],
    ['hog.synthesis', 'SYNTHESIS'],
    ['hog.implementation', 'IMPLEMENTATION'],
    ['hog.simulation', 'SIMULATION'],
    ['hog.checksyntax', 'CHECKSYNTAX'],
    ['hog.checklist', 'CHECKLIST'],
];
function activate(context) {
    const runner = new hogRunner_1.HogRunner();
    const projects = new projects_1.HogProjectsProvider();
    const tree = vscode.window.createTreeView('hog.projects', { treeDataProvider: projects });
    context.subscriptions.push(runner, projects, tree);
    (0, languageFeatures_1.registerLanguageFeatures)(context);
    /** Resolves the project a command acts on: the tree item it was invoked from, or a quick pick. */
    async function pickProject(arg, placeHolder) {
        const fromTree = arg?.project;
        if (fromTree) {
            return fromTree;
        }
        const all = await projects.getProjects();
        if (all.length === 0) {
            vscode.window.showInformationMessage('No Hog projects found: expected Top/<project>/hog.conf in the workspace.');
            return undefined;
        }
        const picked = await vscode.window.showQuickPick(all.map(project => ({
            label: project.name,
            description: project.projectFile ? 'created' : 'not created',
            project,
        })), { placeHolder });
        return picked?.project;
    }
    async function runDirective(directive, arg) {
        const info = (0, hogData_1.getDirective)(directive);
        const project = await pickProject(arg, `${info.description}: choose a project`);
        const root = (0, projects_1.workspaceRoot)();
        if (!project || !root) {
            return;
        }
        runner.run({
            label: info.directive,
            project: project.name,
            command: hogRunner_1.HogRunner.doScript(root.fsPath),
            args: [info.directive, project.name],
            cwd: root.fsPath,
        });
    }
    async function openProject(arg) {
        const project = await pickProject(arg, 'Open which project in the IDE?');
        const root = (0, projects_1.workspaceRoot)();
        if (!project || !root) {
            return;
        }
        if (!project.projectFile) {
            const choice = await vscode.window.showWarningMessage(`Project ${project.name} has not been created yet.`, 'Create it');
            if (choice === 'Create it') {
                await runDirective('CREATE', { project });
            }
            return;
        }
        const config = vscode.workspace.getConfiguration('hog');
        const ext = (0, listParser_1.extensionOf)(project.projectFile.fsPath);
        let command;
        if (ext === '.xpr') {
            command = config.get('vivadoPath', 'vivado');
        }
        else if (ext === '.qpf') {
            command = config.get('quartusPath', 'quartus');
        }
        else {
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
    async function showMenu() {
        const items = [];
        if (runner.isRunning) {
            items.push({ label: '$(debug-stop) Stop running command', command: 'hog.stop' });
        }
        for (const [command, directive] of DIRECTIVE_COMMANDS) {
            const info = hogData_1.DIRECTIVES.find(d => d.directive === directive);
            items.push({ label: `$(${info.icon}) ${info.label}`, description: info.description, command });
        }
        items.push({ label: '$(link-external) Open project in IDE', command: 'hog.openproject' });
        items.push({ label: '$(refresh) Refresh projects', command: 'hog.refresh' });
        const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Hog' });
        if (picked) {
            await vscode.commands.executeCommand(picked.command);
        }
    }
    for (const [command, directive] of DIRECTIVE_COMMANDS) {
        context.subscriptions.push(vscode.commands.registerCommand(command, (arg) => runDirective(directive, arg)));
    }
    context.subscriptions.push(vscode.commands.registerCommand('hog.openproject', (arg) => openProject(arg)), vscode.commands.registerCommand('hog.stop', () => runner.stop()), vscode.commands.registerCommand('hog.refresh', () => projects.refresh()), vscode.commands.registerCommand('hog.showMenu', () => showMenu()));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map