// Locating the IDEs that Hog runs. No vscode dependency (unit-testable with node).
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface ToolInfo {
	/** Setting key: hog.tools.<id> */
	id: string;
	label: string;
	/** Executable searched in the PATH */
	executable: string;
	/** Example directory shown in the setting description */
	example: string;
	/** Hog/Do can use it to launch Hog (otherwise it is only a simulator) */
	launcher: boolean;
}

export const TOOLS: ToolInfo[] = [
	{ id: 'vivado', label: 'Vivado', executable: 'vivado', example: '/tools/Xilinx/Vivado/2024.2/bin', launcher: true },
	{ id: 'quartus', label: 'Quartus', executable: 'quartus', example: '/opt/intelFPGA_pro/24.1/quartus/bin', launcher: true },
	{ id: 'libero', label: 'Libero', executable: 'libero', example: '/opt/microchip/Libero_SoC_2024.1/Libero/bin', launcher: true },
	{ id: 'diamond', label: 'Diamond', executable: 'diamond', example: '/usr/local/diamond/3.13/bin/lin64', launcher: true },
	{ id: 'planAhead', label: 'ISE / PlanAhead', executable: 'planAhead', example: '/opt/Xilinx/14.7/ISE_DS/PlanAhead/bin', launcher: true },
	{ id: 'questa', label: 'Questa / ModelSim', executable: 'vsim', example: '/opt/questasim/bin', launcher: false },
	{ id: 'ghdl', label: 'GHDL', executable: 'ghdl', example: '/usr/local/bin', launcher: false },
];

/** Order in which Hog/Do looks for an executable to run its Tcl scripts (`executables` in Hog/Do). */
export const DO_SEARCH_ORDER = ['vivado', 'libero', 'diamond', 'tclsh', 'quartus', 'planAhead'];

/** Expands a leading `~`. */
export function expandHome(p: string): string {
	return p === '~' || p.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : p;
}

/** Directory to add to the PATH for a configured value, which may be a directory or the executable itself. */
export function toolDirectory(value: string): string {
	const p = expandHome(value.trim());
	try {
		if (fs.statSync(p).isFile()) {
			return path.dirname(p);
		}
	} catch {
		// keep the value: a missing directory is reported by the IDE check
	}
	return p;
}

/** `dirs` prepended to `basePath`, without duplicates. */
export function buildPath(dirs: string[], basePath: string, delimiter: string = path.delimiter): string {
	const all = [...dirs, ...basePath.split(delimiter)].filter(Boolean);
	return [...new Set(all)].join(delimiter);
}

/** Full path of `name` in a PATH string, like `which`; undefined if not found. */
export function findExecutable(name: string, searchPath: string, platform: NodeJS.Platform = process.platform): string | undefined {
	const delimiter = platform === 'win32' ? ';' : ':';
	const suffixes = platform === 'win32' ? ['.exe', '.bat', '.cmd', ''] : [''];
	for (const dir of searchPath.split(delimiter).filter(Boolean)) {
		for (const suffix of suffixes) {
			const candidate = path.join(dir, name + suffix);
			try {
				fs.accessSync(candidate, fs.constants.X_OK);
				if (fs.statSync(candidate).isFile()) {
					return candidate;
				}
			} catch {
				// not here
			}
		}
	}
	return undefined;
}

/** The executable Hog/Do will use, following its search order. */
export function doLauncher(searchPath: string, platform: NodeJS.Platform = process.platform): { name: string; path: string } | undefined {
	for (const name of DO_SEARCH_ORDER) {
		const found = findExecutable(name, searchPath, platform);
		if (found) {
			return { name, path: found };
		}
	}
	return undefined;
}
