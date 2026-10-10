import * as vscode from 'vscode';
import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';

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
}

export interface HogRunResult {
	/** Exit code; undefined if the command could not start or was stopped */
	code: number | null | undefined;
	/** Everything the command wrote to stdout and stderr */
	output: string;
}

/**
 * Runs one Hog/IDE command at a time, streams its output to a single "Hog"
 * channel and reflects its state in a status bar item.
 */
export class HogRunner implements vscode.Disposable {
	private readonly channel = vscode.window.createOutputChannel('Hog');
	private readonly statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
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

		this.channel.show(true);
		this.channel.appendLine(`\n$ ${[job.command, ...job.args].join(' ')}   (cwd: ${job.cwd})`);

		return new Promise<HogRunResult>(resolve => {
			let output = '';
			let child: ChildProcess;
			try {
				child = spawn(job.command, job.args, { cwd: job.cwd });
			} catch (error) {
				this.channel.appendLine(`Error: ${(error as Error).message}`);
				this.showResult(job, undefined);
				resolve({ code: undefined, output });
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
				this.showResult(job, undefined);
				resolve({ code: undefined, output });
			});

			child.on('close', code => {
				if (this.current?.process !== child) {
					return; // already handled by the 'error' event
				}
				this.current = undefined;
				const exitCode = this.stopRequested ? undefined : code;
				this.channel.appendLine(this.stopRequested ? 'Stopped.' : `Process exited with code ${code}`);
				this.showResult(job, exitCode);
				resolve({ code: exitCode, output });
			});
		});
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

	private showResult(job: HogJob, code: number | null | undefined): void {
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
		this.statusItem.tooltip = 'Hog: click for project commands';
	}

	dispose(): void {
		this.stop();
		this.channel.dispose();
		this.statusItem.dispose();
	}
}
