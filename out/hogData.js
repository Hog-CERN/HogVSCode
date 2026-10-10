"use strict";
/* eslint-disable @typescript-eslint/naming-convention -- keys are Hog file extensions and modifier names */
// Static knowledge about Hog list files and hog.conf. Kept free of the vscode API
// so that it can be unit-tested with plain node.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDirective = exports.DIRECTIVES = exports.CONF_SECTIONS = exports.SECTION_DOCS = exports.MODIFIER_DOCS = exports.KEY_VALUE_MODIFIERS = exports.ALLOWED_MODIFIERS = void 0;
/** Modifiers accepted after a file, per file extension (mirrors ALLOWED_PROPS in Hog/Tcl/hog.tcl). */
exports.ALLOWED_MODIFIERS = {
    '.vhd': ['93', 'nosynth', 'noimpl', 'nosim', '1987', '1993', '2008', '2019'],
    '.vhdl': ['93', 'nosynth', 'noimpl', 'nosim', '1987', '1993', '2008', '2019'],
    '.bd': ['nosim'],
    '.v': ['SystemVerilog', 'verilog_header', 'nosynth', 'noimpl', 'nosim', '1995', '2001'],
    '.sv': ['verilog', 'verilog_header', 'nosynth', 'noimpl', 'nosim', '2005', '2009'],
    '.do': ['nosim'],
    '.udo': ['nosim'],
    '.xci': ['nosynth', 'noimpl', 'nosim', 'locked'],
    '.xdc': ['nosynth', 'noimpl', 'scoped_to_ref', 'scoped_to_cells'],
    '.tcl': ['nosynth', 'noimpl', 'nosim', 'source', 'qsys', 'noadd'],
    '.qsys': ['nogenerate', 'noadd'],
    '.sdc': ['notiming', 'nosynth', 'noplace'],
    '.elf': ['scoped_to_ref', 'scoped_to_cells', 'nosim', 'noimpl'],
    '.pdc': ['nosynth', 'noplace'],
    '.lpf': ['enable'],
};
/** Modifiers that take a value (`key=value`). */
exports.KEY_VALUE_MODIFIERS = ['lib', 'top', 'topsim'];
exports.MODIFIER_DOCS = {
    nosynth: 'The file is **not** used in synthesis.',
    noimpl: 'The file is **not** used in implementation.',
    nosim: 'The file is **not** used in simulation.',
    '93': 'VHDL-93 file. Without it Hog compiles VHDL files as VHDL-2008.',
    '1987': 'Compile the VHDL file as VHDL-87.',
    '1993': 'Compile the VHDL file as VHDL-93.',
    '2008': 'Compile the VHDL file as VHDL-2008 (the default).',
    '2019': 'Compile the VHDL file as VHDL-2019.',
    '1995': 'Compile the Verilog file as Verilog-1995.',
    '2001': 'Compile the Verilog file as Verilog-2001.',
    '2005': 'Compile the file as SystemVerilog-2005.',
    '2009': 'Compile the file as SystemVerilog-2009.',
    SystemVerilog: 'Treat the `.v` file as SystemVerilog.',
    verilog: 'Treat the `.sv` file as plain Verilog.',
    verilog_header: 'The file is a Verilog header (`include`d, not compiled on its own).',
    XDC: 'Treat the file as an XDC constraint file.',
    locked: 'Lock the IP so that Vivado does not upgrade it.',
    noadd: 'Do not add the file to the project, but keep it in the version computation.',
    nogenerate: 'Do not generate the output products of the Qsys system.',
    notiming: 'Do not use the SDC file for timing constraints.',
    noplace: 'Do not use the file for place and route.',
    source: 'Source the Tcl script at project-creation time.',
    qsys: 'Treat the Tcl script as a Qsys generation script.',
    scoped_to_ref: 'Scope the constraint file to a module reference.',
    scoped_to_cells: 'Scope the constraint file to specific cells.',
    enable: 'Enable the constraint file for place and route (Diamond).',
    lib: '`lib=<name>`: compile the file into the given VHDL library instead of the one named after the list file.',
    top: '`top=<module>`: the top module of the project (set on exactly one file of the `.src` lists).',
    topsim: '`topsim=<module>`: the top module of the simulation set.',
};
exports.SECTION_DOCS = {
    main: 'General project settings: `PART`, `FAMILY`, `IP_REPO_PATHS`, `TARGET_SIMULATOR`, `ENABLE_DEVELOP_BRANCH`, ...',
    parameters: 'Tool-wide parameters, e.g. `MAX_THREADS`.',
    generics: 'Top-level generics / parameters, written `NAME=VALUE`. Hog also adds the git SHA and version generics.',
    hog: 'Hog-specific behaviour, e.g. `HOG_ONLY_SYNTH`.',
    synth_1: 'Properties of the synthesis run (`synth_1`).',
    impl_1: 'Properties of the implementation run (`impl_1`), e.g. `STEPS.PHYS_OPT_DESIGN.IS_ENABLED=1`.',
    files: 'Files of a simulation set (in `.sim` list files).',
    properties: 'Properties of a simulation set (in `.sim` list files), e.g. `TOP`, `ACTIVE`, `RUNTIME`.',
};
exports.CONF_SECTIONS = ['main', 'parameters', 'generics', 'hog', 'synth_1', 'impl_1'];
/** Directives understood by `Hog/Do` (see Hog/Tcl/launch.tcl). */
exports.DIRECTIVES = [
    { directive: 'CREATE', label: 'Create', description: 'Create the project', icon: 'add', runnable: true },
    { directive: 'WORKFLOW', label: 'Workflow', description: 'Create the project and run the full workflow', icon: 'play', runnable: true },
    { directive: 'SYNTHESIS', label: 'Synthesis', description: 'Run synthesis', icon: 'gear', runnable: true },
    { directive: 'IMPLEMENTATION', label: 'Implementation', description: 'Run implementation', icon: 'run-all', runnable: true },
    { directive: 'SIMULATION', label: 'Simulation', description: 'Run the simulations', icon: 'beaker', runnable: true },
    { directive: 'CHECKSYNTAX', label: 'Check Syntax', description: 'Check the syntax of the project', icon: 'check', runnable: true },
    { directive: 'CHECKLIST', label: 'Check List Files', description: 'Check that the list files are consistent', icon: 'checklist', runnable: true },
];
function getDirective(directive) {
    const found = exports.DIRECTIVES.find(d => d.directive === directive);
    if (!found) {
        throw new Error(`Unknown Hog directive ${directive}`);
    }
    return found;
}
exports.getDirective = getDirective;
//# sourceMappingURL=hogData.js.map