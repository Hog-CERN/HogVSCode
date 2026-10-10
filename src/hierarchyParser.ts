// Parser for the text printed by `Hog/Do TREE <project>` (see Hog/Tcl/utils/hierarchy.tcl).
// No vscode dependency (unit-testable with node).

export interface HierNode {
	library: string;
	/** `entity`, or `entity.architecture` for VHDL architectures */
	name: string;
	/** vhdl_entity, vhdl_architecture, verilog_module, component, ip, ... */
	type: string;
	/** Source file; absent for modules Hog could not resolve */
	path?: string;
	/** e.g. "circular reference detected" */
	warning?: string;
	children: HierNode[];
}

export interface PackageGroup {
	library: string;
	packages: { name: string; path?: string }[];
}

export interface HierarchyResult {
	roots: HierNode[];
	packages: PackageGroup[];
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001b\[[0-9;]*m/g;
// <indent pairs>[├└]─ <lib>.<name> (<type>)[ - <path>][ [WARNING: <text>]]
const NODE_RE = /^((?:[ │]{2})*)([├└]─ )?([^\s.]+)\.(\S+) \(([A-Za-z0-9_]+)\)(?: - (\S.*?))?(?: \[WARNING: ([^\]]*)\])?\s*$/;
const LIBRARY_RE = /^Library: (.+?)\s*$/;
const PACKAGE_RE = /^\s+Package: (\S+)(?:\s+-\s+(\S.*?))?\s*$/;

export function parseHierarchy(output: string): HierarchyResult {
	const result: HierarchyResult = { roots: [], packages: [] };
	const stack: HierNode[] = [];
	let currentLibrary: PackageGroup | undefined;

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
		const node: HierNode = { library, name, type, path, warning, children: [] };
		const depth = connector ? indent.length / 2 : 0;

		stack.length = Math.min(stack.length, depth);
		const parent = stack[depth - 1];
		if (parent) {
			parent.children.push(node);
		} else {
			result.roots.push(node);
		}
		stack[depth] = node;
	}
	return result;
}

export function countNodes(nodes: HierNode[]): number {
	return nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0);
}
