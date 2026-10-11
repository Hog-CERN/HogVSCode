import * as vscode from 'vscode';
import { TOOLS, ToolInfo, buildPath, doLauncher, expandHome, findExecutable, toolDirectory } from './toolEnv';

export interface ToolStatus {
	tool: ToolInfo;
	/** Value of hog.tools.<id>, if set */
	configured?: string;
	/** Executable found in the PATH used by Hog */
	found?: string;
	/** The configured directory does not contain the executable */
	misconfigured: boolean;
}

export interface ToolReport {
	tools: ToolStatus[];
	/** Executable Hog/Do will use to run its Tcl scripts */
	launcher?: { name: string; path: string };
	path: string;
}

/** Directories from the hog.tools.* settings, in the order they are prepended to the PATH. */
export function configuredDirectories(): string[] {
	const config = vscode.workspace.getConfiguration('hog.tools');
	const dirs: string[] = [];
	for (const tool of TOOLS) {
		const value = config.get<string>(tool.id, '');
		if (value.trim()) {
			dirs.push(toolDirectory(value));
		}
	}
	for (const extra of config.get<string[]>('extraPaths', [])) {
		if (extra.trim()) {
			dirs.push(expandHome(extra.trim()));
		}
	}
	return dirs;
}

/** Environment for every process the extension starts: the PATH extended with the configured IDE directories. */
export function hogEnv(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	env.PATH = buildPath(configuredDirectories(), process.env.PATH ?? '');
	return env;
}

export function toolReport(): ToolReport {
	const config = vscode.workspace.getConfiguration('hog.tools');
	const searchPath = hogEnv().PATH ?? '';
	const tools = TOOLS.map(tool => {
		const configured = config.get<string>(tool.id, '').trim() || undefined;
		const found = findExecutable(tool.executable, searchPath);
		const misconfigured = configured !== undefined
			&& findExecutable(tool.executable, toolDirectory(configured)) === undefined;
		return { tool, configured, found, misconfigured };
	});
	return { tools, launcher: doLauncher(searchPath), path: searchPath };
}

export function openToolSettings(toolId?: string): Thenable<unknown> {
	return vscode.commands.executeCommand('workbench.action.openSettings', toolId ? `hog.tools.${toolId}` : 'hog.tools');
}

/** Quick pick showing which IDEs are found and which one Hog/Do will use; picking one opens its setting. */
export async function showToolReport(): Promise<ToolReport> {
	const report = toolReport();
	type Item = vscode.QuickPickItem & { toolId?: string };
	const items: Item[] = [];

	items.push(report.launcher
		? { label: `$(rocket) Hog/Do will run with ${report.launcher.name}`, detail: report.launcher.path }
		: { label: '$(error) Hog/Do will not find any IDE', detail: 'Set at least one IDE directory below.' });
	items.push({ label: 'IDEs', kind: vscode.QuickPickItemKind.Separator });

	for (const status of report.tools) {
		const { tool } = status;
		let icon: string;
		let description: string;
		if (status.misconfigured) {
			icon = '$(warning)';
			description = `${tool.executable} not found in ${status.configured}`;
		} else if (status.found) {
			icon = '$(check)';
			description = status.configured ? 'configured' : 'from PATH';
		} else {
			icon = '$(circle-slash)';
			description = 'not found';
		}
		items.push({ label: `${icon} ${tool.label}`, description, detail: status.found, toolId: tool.id });
	}
	items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
	items.push({ label: '$(gear) Configure IDE paths…' });

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: 'IDEs available to Hog (select one to change its path)',
		matchOnDetail: true,
	});
	if (picked) {
		await openToolSettings(picked.toolId);
	}
	return report;
}
