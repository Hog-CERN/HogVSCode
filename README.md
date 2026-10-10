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

The status bar item shows what Hog is running and how it ended; click it for a menu (including **Stop**). All output goes to the *Hog* output channel.

## Settings

| Setting | Default | |
|---|---|---|
| `hog.doScript` | `Hog/Do` | Hog launcher, relative to the workspace root |
| `hog.vivadoPath` | `vivado` | Used by *Open Project in IDE* |
| `hog.quartusPath` | `quartus` | Used by *Open Project in IDE* |
| `hog.diagnostics.enable` | `true` | Warn about missing files and unknown modifiers |
