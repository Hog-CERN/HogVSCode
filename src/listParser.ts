// Parser for single lines of Hog list files. No vscode dependency (unit-testable with node).

export interface Span {
	text: string;
	start: number;
	end: number;
}

export interface ListLine {
	/** File paths on the line (two for .ipb files, one otherwise). */
	paths: Span[];
	/** Modifiers following the path(s): `nosynth`, `lib=foo`, `93`, ... */
	modifiers: Span[];
	/** md5 checksum of a .ext entry. */
	hash?: Span;
}

const SECTION_RE = /^\s*\[/;
const PROPERTY_RE = /^\s*[A-Za-z_][\w.]*\s*=/;
const TOKEN_RE = /\S+/g;

export function extensionOf(fileName: string): string {
	const i = fileName.lastIndexOf('.');
	return i < 0 ? '' : fileName.slice(i).toLowerCase();
}

/**
 * Parses one line of a list file. Returns undefined for comments, blank lines,
 * `[section]` headers and `KEY=VALUE` property lines.
 *
 * @param listExt extension of the list file itself, e.g. ".src" or ".ipb"
 */
export function parseListLine(line: string, listExt: string): ListLine | undefined {
	const hash = line.indexOf('#');
	const content = hash < 0 ? line : line.slice(0, hash);
	if (content.trim() === '' || SECTION_RE.test(content) || PROPERTY_RE.test(content)) {
		return undefined;
	}

	const tokens: Span[] = [];
	TOKEN_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = TOKEN_RE.exec(content)) !== null) {
		tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
	}

	const pathCount = listExt === '.ipb' ? 2 : 1;
	const result: ListLine = {
		paths: tokens.slice(0, pathCount),
		modifiers: tokens.slice(pathCount),
	};
	if (listExt === '.ext' && result.modifiers.length > 0) {
		result.hash = result.modifiers.shift();
	}
	return result;
}

/** Whether a path cannot be checked on disk (globs, environment variables). */
export function isDynamicPath(p: string): boolean {
	return /[*?$~{}]/.test(p);
}

/** Repository root for a list file living in `<root>/Top/<project>/list/`. */
export function repoRootFromListPath(fsPath: string): string | undefined {
	const normalized = fsPath.replace(/\\/g, '/');
	const i = normalized.indexOf('/Top/');
	return i < 0 ? undefined : fsPath.slice(0, i);
}
