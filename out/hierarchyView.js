"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HogHierarchyProvider = void 0;
const vscode = require("vscode");
const path = require("path");
const hierarchyParser_1 = require("./hierarchyParser");
const TYPE_ICONS = new Map([
    ['vhdl_entity', 'symbol-class'],
    ['vhdl_architecture', 'symbol-structure'],
    ['verilog_module', 'symbol-module'],
    ['systemverilog_module', 'symbol-module'],
    ['component', 'symbol-misc'],
    ['ip', 'chip'],
    ['bd', 'circuit-board'],
]);
class HogHierarchyProvider {
    constructor() {
        this.changed = new vscode.EventEmitter();
        this.onDidChangeTreeData = this.changed.event;
    }
    get current() {
        return this.data;
    }
    set(data) {
        this.data = data;
        this.changed.fire(undefined);
    }
    getChildren(element) {
        if (!this.data) {
            return [];
        }
        if (!element) {
            const items = this.data.result.roots.map(node => ({ kind: 'module', node }));
            const groups = this.data.result.packages.filter(g => g.packages.length > 0);
            if (groups.length > 0) {
                items.push({ kind: 'packages', groups });
            }
            return items;
        }
        switch (element.kind) {
            case 'module':
                return element.node.children.map(node => ({ kind: 'module', node }));
            case 'packages':
                return element.groups.map(group => ({ kind: 'library', group }));
            case 'library':
                return element.group.packages.map(p => ({ kind: 'package', name: p.name, path: p.path }));
            default:
                return [];
        }
    }
    getTreeItem(item) {
        switch (item.kind) {
            case 'module': {
                const { node } = item;
                const collapsible = node.children.length > 0
                    ? vscode.TreeItemCollapsibleState.Expanded
                    : vscode.TreeItemCollapsibleState.None;
                const treeItem = new vscode.TreeItem(node.name, collapsible);
                treeItem.description = `${node.library} · ${node.type}`;
                const target = this.resolve(node.path);
                if (node.warning) {
                    treeItem.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
                }
                else if (!node.path) {
                    treeItem.iconPath = new vscode.ThemeIcon('question', new vscode.ThemeColor('disabledForeground'));
                }
                else {
                    treeItem.iconPath = new vscode.ThemeIcon(TYPE_ICONS.get(node.type) ?? 'symbol-file');
                }
                const lines = [`**${node.library}.${node.name}** (${node.type})`];
                if (node.path) {
                    lines.push(node.path);
                }
                else {
                    lines.push('Not found in the project sources: library component or unresolved reference.');
                }
                if (node.warning) {
                    lines.push(`Warning: ${node.warning}`);
                }
                treeItem.tooltip = new vscode.MarkdownString(lines.join('\n\n'));
                if (target) {
                    treeItem.resourceUri = target;
                    treeItem.command = { command: 'vscode.open', title: 'Open', arguments: [target] };
                }
                return treeItem;
            }
            case 'packages': {
                const treeItem = new vscode.TreeItem('Packages', vscode.TreeItemCollapsibleState.Collapsed);
                treeItem.iconPath = new vscode.ThemeIcon('package');
                return treeItem;
            }
            case 'library': {
                const treeItem = new vscode.TreeItem(item.group.library, vscode.TreeItemCollapsibleState.Collapsed);
                treeItem.iconPath = new vscode.ThemeIcon('library');
                treeItem.description = `${item.group.packages.length}`;
                return treeItem;
            }
            default: {
                const treeItem = new vscode.TreeItem(item.name, vscode.TreeItemCollapsibleState.None);
                treeItem.iconPath = new vscode.ThemeIcon('symbol-namespace');
                const target = this.resolve(item.path);
                if (target) {
                    treeItem.resourceUri = target;
                    treeItem.tooltip = target.fsPath;
                    treeItem.command = { command: 'vscode.open', title: 'Open', arguments: [target] };
                }
                return treeItem;
            }
        }
    }
    resolve(file) {
        if (!file || !this.data) {
            return undefined;
        }
        return vscode.Uri.file(path.isAbsolute(file) ? file : path.join(this.data.root, file));
    }
    /** One-line summary for the view description. */
    describe() {
        if (!this.data) {
            return undefined;
        }
        const when = new Date(this.data.generated).toLocaleTimeString();
        return `${this.data.project} · ${(0, hierarchyParser_1.countNodes)(this.data.result.roots)} modules · ${when}`;
    }
    dispose() {
        this.changed.dispose();
    }
}
exports.HogHierarchyProvider = HogHierarchyProvider;
//# sourceMappingURL=hierarchyView.js.map