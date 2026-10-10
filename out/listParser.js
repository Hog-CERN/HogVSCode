"use strict";
// Parser for single lines of Hog list files. No vscode dependency (unit-testable with node).
Object.defineProperty(exports, "__esModule", { value: true });
exports.repoRootFromListPath = exports.isDynamicPath = exports.parseListLine = exports.extensionOf = void 0;
const SECTION_RE = /^\s*\[/;
const PROPERTY_RE = /^\s*[A-Za-z_][\w.]*\s*=/;
const TOKEN_RE = /\S+/g;
function extensionOf(fileName) {
    const i = fileName.lastIndexOf('.');
    return i < 0 ? '' : fileName.slice(i).toLowerCase();
}
exports.extensionOf = extensionOf;
/**
 * Parses one line of a list file. Returns undefined for comments, blank lines,
 * `[section]` headers and `KEY=VALUE` property lines.
 *
 * @param listExt extension of the list file itself, e.g. ".src" or ".ipb"
 */
function parseListLine(line, listExt) {
    const hash = line.indexOf('#');
    const content = hash < 0 ? line : line.slice(0, hash);
    if (content.trim() === '' || SECTION_RE.test(content) || PROPERTY_RE.test(content)) {
        return undefined;
    }
    const tokens = [];
    TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = TOKEN_RE.exec(content)) !== null) {
        tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
    }
    const pathCount = listExt === '.ipb' ? 2 : 1;
    const result = {
        paths: tokens.slice(0, pathCount),
        modifiers: tokens.slice(pathCount),
    };
    if (listExt === '.ext' && result.modifiers.length > 0) {
        result.hash = result.modifiers.shift();
    }
    return result;
}
exports.parseListLine = parseListLine;
/** Whether a path cannot be checked on disk (globs, environment variables). */
function isDynamicPath(p) {
    return /[*?$~{}]/.test(p);
}
exports.isDynamicPath = isDynamicPath;
/** Repository root for a list file living in `<root>/Top/<project>/list/`. */
function repoRootFromListPath(fsPath) {
    const normalized = fsPath.replace(/\\/g, '/');
    const i = normalized.indexOf('/Top/');
    return i < 0 ? undefined : fsPath.slice(0, i);
}
exports.repoRootFromListPath = repoRootFromListPath;
//# sourceMappingURL=listParser.js.map