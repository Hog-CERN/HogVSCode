"use strict";
// Parser for the text printed by `Hog/Do TREE <project>` (see Hog/Tcl/utils/hierarchy.tcl).
// No vscode dependency (unit-testable with node).
Object.defineProperty(exports, "__esModule", { value: true });
exports.countNodes = exports.parseHierarchy = void 0;
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001b\[[0-9;]*m/g;
// <indent pairs>[├└]─ <lib>.<name> (<type>)[ - <path>][ [WARNING: <text>]]
const NODE_RE = /^((?:[ │]{2})*)([├└]─ )?([^\s.]+)\.(\S+) \(([A-Za-z0-9_]+)\)(?: - (\S.*?))?(?: \[WARNING: ([^\]]*)\])?\s*$/;
const LIBRARY_RE = /^Library: (.+?)\s*$/;
const PACKAGE_RE = /^\s+Package: (\S+)(?:\s+-\s+(\S.*?))?\s*$/;
function parseHierarchy(output) {
    const result = { roots: [], packages: [] };
    const stack = [];
    let currentLibrary;
    for (const raw of output.split('\n')) {
        const line = raw.replace(ANSI_RE, '').replace(/\r$/, '');
        const lib = LIBRARY_RE.exec(line);
        if (lib) {
            currentLibrary = { library: lib[1], packages: [] };
            result.packages.push(currentLibrary);
            continue;
        }
        const pkg = PACKAGE_RE.exec(line);
        if (pkg && currentLibrary) {
            currentLibrary.packages.push({ name: pkg[1], path: pkg[2] });
            continue;
        }
        const m = NODE_RE.exec(line);
        if (!m) {
            continue;
        }
        const [, indent, connector, library, name, type, path, warning] = m;
        if (!connector && indent.length > 0) {
            continue; // not a tree line
        }
        const node = { library, name, type, path, warning, children: [] };
        const depth = connector ? indent.length / 2 : 0;
        stack.length = Math.min(stack.length, depth);
        const parent = stack[depth - 1];
        if (parent) {
            parent.children.push(node);
        }
        else {
            result.roots.push(node);
        }
        stack[depth] = node;
    }
    return result;
}
exports.parseHierarchy = parseHierarchy;
function countNodes(nodes) {
    return nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0);
}
exports.countNodes = countNodes;
//# sourceMappingURL=hierarchyParser.js.map