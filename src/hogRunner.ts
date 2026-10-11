import * as vscode from 'vscode';
import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';
import { LogMessage, parseLog, sourceOf } from './logParser';

// eslint-disable-next-line no-control-regex
const ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PR-TZcf-nqry=><]/g;

export interface HogJob {
	/** Short name shown in the status bar, e.g. "SYNTHESIS" */
	label: string;
	/** Project the job belongs to, e.g. "fifo" */
	project: string;
	command: string;
	args: string[];
	cwd: string;
	/** Where messages without a file location are reported, usually the project's hog.conf */
	confUri?: vscode.Uri;
}

export interface HogRunResult {
	/** Exit code; undefined if the command could not start or was stopped */
	code: number | null | undefined;
	/** Everything the command wrote to stdout and stderr */
	output: string;
}

/**
 * Runs one Hog/IDE command at a time, streams its output to a single "Hog"
 * channel, reflects its state in a status bar item and reports the errors
 * it printed in the Problems panel.
 */
export class HogRunner implements vscode.Disposable {
	private readonly channel = vscode.window.createOutputChannel('Hog');
	private readonly statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
	private readonly problems = vscode.languages.createDiagnosticCollection('hog-build');
	private current: { job: HogJob; process: ChildProcess } | undefined;
	private stopRequested = false;

	constructor() {
		this.statusItem.command = 'hog.showMenu';
		this.showIdle();
		this.statusItem.show();
	}

	get isRunning(): boolean {
		return this.current !== undefined;
	}

	/** Absolute path of the Hog launcher script for a workspace folder. */
	static doScript(root: string): string {
		const configured = vscode.workspace.getConfiguration('hog').get<string>('doScript', 'Hog/Do');
		return path.isAbsolute(configured) ? configured : path.join(root, configured);
	}

	/** Resolves when the command ends, or with undefined if another command is already running. */
	run(job: HogJob): Promise<HogRunResult | undefined> {
		if (this.current) {
			vscode.window.showWarningMessage(
				`Hog is already running ${this.current.job.label} on ${this.current.job.project}.`,
				'Stop it'
			).then(choice => {
				if (choice === 'Stop it') {
					this.stop();
				}
			});
			return Promise.resolve(undefined);
		}

		this.problems.clear();
		this.channel.show(true);
		this.channel.appendLine(`\n$ ${[job.command, ...job.args].join(' ')}   (cwd: ${job.cwd})`);

		return new Promise<HogRunResult>(resolve => {
			let output = '';
			let child: ChildProcess;
			try {
				child = spawn(job.command, job.args, { cwd: job.cwd });
			} catch (error) {
				this.channel.appendLine(`Error: ${(error as Error).message}`);
				resolve(this.finish(job, undefined, output));
				return;
			}

			this.current = { job, process: child };
			this.stopRequested = false;
			this.showRunning(job);

			const write = (data: Buffer) => {
				const text = data.toString().replace(ANSI_RE, '');
				output += text;
				this.channel.append(text);
			};
			child.stdout?.on('data', write);
			child.stderr?.on('data', write);

			child.on('error', error => {
				const hint = (error as NodeJS.ErrnoException).code === 'ENOENT'
					? ` (is "${job.command}" installed and on the PATH? See the hog.* settings)`
					: '';
				this.channel.appendLine(`Error: ${error.message}${hint}`);
				this.current = undefined;
				resolve(this.finish(job, undefined, output));
			});

			child.on('close', code => {
				if (this.current?.process !== child) {
					return; // already handled by the 'error' event
				}
				this.current = undefined;
				const exitCode = this.stopRequested ? undefined : code;
				this.channel.appendLine(this.stopRequested ? 'Stopped.' : `Process exited with code ${code}`);
				resolve(this.finish(job, exitCode, output));
			});
		});
	}

	clearProblems(): void {
		this.problems.clear();
	}

	private finish(job: HogJob, code: number | null | undefined, output: string): HogRunResult {
		const summary = this.publishProblems(job, parseLog(output));
		this.showResult(job, code, summary);
		return { code, output };
	}

	/** Reports the errors (and optionally warnings) of a run in the Problems panel; returns a summary. */
	private publishProblems(job: HogJob, messages: LogMessage[]): string | undefined {
		const includeWarnings = vscode.workspace.getConfiguration('hog').get<boolean>('problems.includeWarnings', false);
		const byFile = new Map<string, { uri: vscode.Uri; diagnostics: vscode.Diagnostic[] }>();
		let errors = 0;
		let critical = 0;

		for (const msg of messages) {
			if (msg.severity === 'warning' && !includeWarnings) {
				continue;
			}
			if (msg.severity === 'error') {
				errors++;
			} else if (msg.severity === 'critical') {
				critical++;
			}

			const uri = msg.file
				? vscode.Uri.file(path.isAbsolute(msg.file) ? msg.file : path.join(job.cwd, msg.file))
				: job.confUri;
			if (!uri) {
				continue;
			}
			const line = Math.max((msg.line ?? 1) - 1, 0);
			const severity = msg.severity === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error;
			const text = msg.severity === 'critical' ? `CRITICAL WARNING: ${msg.message}` : msg.message;
			const diagnostic = new vscode.Diagnostic(new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER), text, severity);
			diagnostic.source = sourceOf(msg.id);
			diagnostic.code = msg.id;

			const entry = byFile.get(uri.toString()) ?? { uri, diagnostics: [] };
			entry.diagnostics.push(diagnostic);
			byFile.set(uri.toString(), entry);
		}

		this.problems.set([...byFile.values()].map(e => [e.uri, e.diagnostics] as [vscode.Uri, vscode.Diagnostic[]]));
		if (errors === 0 && critical === 0) {
			return undefined;
		}
		const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
		return [errors ? plural(errors, 'error') : '', critical ? plural(critical, 'critical warning') : '']
			.filter(Boolean).join(', ');
	}

	stop(): void {
		if (this.current) {
			this.stopRequested = true;
			this.current.process.kill('SIGTERM');
		}
	}

	private showIdle(): void {
		this.statusItem.text = '$(circuit-board) Hog';
		this.statusItem.tooltip = 'Hog: click for project commands';
		this.statusItem.backgroundColor = undefined;
	}

	private showRunning(job: HogJob): void {
		this.statusItem.text = `$(sync~spin) Hog: ${job.label} ${job.project}`;
		this.statusItem.tooltip = 'Hog is running. Click for commands, including Stop.';
		this.statusItem.backgroundColor = undefined;
	}

	private showResult(job: HogJob, code: number | null | undefined, summary?: string): void {
		if (code === 0) {
			this.statusItem.text = `$(check) Hog: ${job.label} ${job.project}`;
			this.statusItem.backgroundColor = undefined;
		} else if (code === undefined) {
			this.statusItem.text = `$(circle-slash) Hog: ${job.label} ${job.project}`;
			this.statusItem.backgroundColor = undefined;
		} else {
			this.statusItem.text = `$(error) Hog: ${job.label} ${job.project}`;
			this.statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
		}
		this.statusItem.tooltip = summary
			? `Hog: ${job.label} ${job.project}: ${summary} (see the Problems panel). Click for project commands.`
			: 'Hog: click for project commands';
	}

	dispose(): void {
		this.stop();
		this.channel.dispose();
		this.statusItem.dispose();
		this.problems.dispose();
	}
}
