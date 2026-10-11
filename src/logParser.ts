// Parser for error and warning lines printed by Hog and the vendor tools (Vivado, ...).
// No vscode dependency (unit-testable with node).

export type LogSeverity = 'error' | 'critical' | 'warning';

export interface LogMessage {
	severity: LogSeverity;
	/** Bracketed id, e.g. "Hog:CreateProject" or "Synth 8-439" */
	id: string;
	message: string;
	file?: string;
	/** 1-based line number */
	line?: number;
}

const SEVERITIES = new Map<string, LogSeverity>([
	['ERROR', 'error'],
	['CRITICAL WARNING', 'critical'],
	['WARNING', 'warning'],
]);

// <LEVEL>: [<id>] <message>[ [<file>:<line>]]
// Hog: Hog/Tcl/utils/Logger.tcl prints "$vlevel: \[Hog:$title\] $msg";
// Vivado appends the location, e.g. "ERROR: [Synth 8-439] module 'x' not found [/repo/top.vhd:12]".
const LINE_RE = /^(ERROR|CRITICAL WARNING|WARNING): \[([^\]]+)\] (.*?)(?: \[((?:[A-Za-z]:)?[^\]:]+):(\d+)\])?\s*$/;

export function parseLogLine(line: string): LogMessage | undefined {
	const m = LINE_RE.exec(line.replace(/\r$/, ''));
	if (!m) {
		return undefined;
	}
	const [, level, id, message, file, lineNumber] = m;
	return {
		severity: SEVERITIES.get(level)!,
		id,
		message: message.trim(),
		file,
		line: lineNumber ? parseInt(lineNumber, 10) : undefined,
	};
}

/** All error and warning messages of a log, without duplicates. */
export function parseLog(output: string): LogMessage[] {
	const seen = new Set<string>();
	const messages: LogMessage[] = [];
	for (const line of output.split('\n')) {
		const msg = parseLogLine(line);
		if (!msg) {
			continue;
		}
		const key = [msg.severity, msg.id, msg.message, msg.file, msg.line].join('\u0000');
		if (!seen.has(key)) {
			seen.add(key);
			messages.push(msg);
		}
	}
	return messages;
}

/** Tool that produced a message, from its bracketed id: "Hog:Title" -> "Hog", "Synth 8-439" -> "Synth". */
export function sourceOf(id: string): string {
	return id.split(/[\s:]/)[0];
}
