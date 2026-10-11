# Hog for Visual Studio Code

Support for [Hog (HDL-on-git)](https://cern.ch/hog) projects.

## Syntax highlighting

* **List files**: `.src`, `.sim`, `.con`, `.lst`, `.ext`, `.ipb`, `.sub`. File paths, modifiers (`nosynth`, `lib=`, `top=`, `93`, ...), `[sections]`, `KEY=VALUE` properties and comments.
* **`hog.conf`**: sections, properties, booleans and numbers.

## Editor features

* **Hover** documentation for modifiers and `hog.conf` sections.
* **Completion** of the modifiers valid for each file type (taken from Hog's own `ALLOWED_PROPS`), `lib=` / `top=` snippets and section names.
* **Diagnostics** for files that do not exist and unknown modifiers (disable with `hog.diagnostics.enable`).
* **Ctrl/Cmd-click** on a path in a list file to open it.
* **Outline** of sections, properties and files.

## Hog sidebar

The *Hog* activity bar view lists every `Top/<project>/hog.conf` of the workspace, shows whether the project has been created, and expands to its list files and the files they reference (nested list files included). Missing files are flagged.

Each project has inline and context-menu actions: **Create**, **Run Workflow**, **Synthesis**, **Implementation**, **Simulation**, **Check Syntax**, **Check List Files** and **Open in IDE**. The same commands are in the command palette under `Hog:`.

### Design hierarchy

**Show Design Hierarchy** (the hierarchy icon on a project, or `Hog: Show Design Hierarchy`) runs `Hog/Do TREE <project>` and shows the result in the *Hierarchy* view: modules nested by instantiation, with library and type, a warning for circular references, and a *Packages* group. Click a module to open its source file; modules Hog could not resolve are shown greyed out. The last hierarchy is remembered per workspace. A top module must be set with `top=<module>` in a `.src` list file, and the IDE must be installed (Hog launches its Tcl shell).

### Build problems

`ERROR` and `CRITICAL WARNING` messages printed by Hog and the vendor tools (for example `ERROR: [Synth 8-439] module 'x' not found [/repo/top.vhd:12]`) appear in the Problems panel after each command. Messages with a location jump to the file and line; the others are attached to the project's `hog.conf`. Set `hog.problems.includeWarnings` to also show plain warnings, and use `Hog: Clear Build Problems` to clear them.

The status bar item shows what Hog is running and how it ended; click it for a menu (including **Stop**). All output goes to the *Hog* output channel.

## IDE paths

`Hog/Do` runs with the first IDE it finds in the `PATH` (Vivado, Libero, Diamond, tclsh, Quartus, PlanAhead, in that order). VS Code started from the Dock or a desktop launcher often does not have your shell's `PATH`, so you can tell the extension where the IDEs are in **Settings › Extensions › Hog › IDE Paths** (`Hog: Configure IDE Paths`):

| Setting | Example |
|---|---|
| `hog.tools.vivado` | `/tools/Xilinx/Vivado/2024.2/bin` |
| `hog.tools.quartus` | `/opt/intelFPGA_pro/24.1/quartus/bin` |
| `hog.tools.libero`, `hog.tools.diamond`, `hog.tools.planAhead` | the IDE's `bin` directory |
| `hog.tools.questa`, `hog.tools.ghdl` | simulator `bin` directories |
| `hog.tools.extraPaths` | any other directories, e.g. Vitis |

Each value may be the directory or the executable itself; `~` is expanded. The directories are put in front of the `PATH` of every command the extension starts. **`Hog: Check IDEs`** (the tools icon on the Projects view) shows which IDEs are found and which one `Hog/Do` will use. The settings are per machine, so they are not synced to other computers.

## Settings

| Setting | Default | |
|---|---|---|
| `hog.doScript` | `Hog/Do` | Hog launcher, relative to the workspace root |
| `hog.vivadoPath` | `vivado` | Used by *Open Project in IDE* |
| `hog.quartusPath` | `quartus` | Used by *Open Project in IDE* |
| `hog.diagnostics.enable` | `true` | Warn about missing files and unknown modifiers |
| `hog.problems.includeWarnings` | `false` | Also show plain `WARNING` messages from builds in the Problems panel |
