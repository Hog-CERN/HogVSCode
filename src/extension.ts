// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import { exec } from 'child_process';
import { spawn } from 'child_process';
import { waitForDebugger } from 'inspector';

async function findHogConfFiles(): Promise<string[]> {
	const pattern = '**/Top/**/hog.conf';
	const uris = await vscode.workspace.findFiles(pattern);
	const paths = uris.map(uri => path.relative(path.join(vscode.workspace.rootPath!, 'Top'), path.dirname(uri.fsPath)));
	return paths;
}

async function findCreatedProjects(): Promise<string[]> {
	const pattern = '**/Projects/**/*.xpr';
	const uris = await vscode.workspace.findFiles(pattern);
	const paths = uris.map(uri => uri.fsPath);
	return paths;
}


async function OpenProject() {
    
	const outputChannel = vscode.window.createOutputChannel("Hog");
		
	const uris = await findCreatedProjects();

	let i = 0;
	const arg1 = await vscode.window.showQuickPick(uris, {
		placeHolder: 'Available Hog projects'
	});

	const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath; // Get the first workspace folder if there is one
	if (workspaceFolder) {
		if (arg1){
			const command = `vivado ${arg1}`;
			outputChannel.show();

			outputChannel.appendLine(`Running command: ${command}`);
			const childProcess = spawn(command, { shell: true });
			childProcess.stdout.on('data', (data) => {
				outputChannel.append(data.toString());
			});
		
			childProcess.stderr.on('data', (data) => {
				outputChannel.append(data.toString());
			});
		
			childProcess.on('error', (error) => {
				console.error(`exec error: ${error}`);
				outputChannel.append(`Error: ${error.message}\n`);
			});
		
			childProcess.on('close', (code) => {
				console.log(`child process exited with code ${code}`);
				outputChannel.append(`Process exited with code ${code}\n`);
			});
		}
	}
}

async function CreateProject() {
    // const arg1 = await vscode.window.showInputBox({
    //     prompt: "Which Hog Project do you want to create?"
    // });
    // if (!arg1) {
    //     // User cancelled input
    //     return;
    // }
	const outputChannel = vscode.window.createOutputChannel("Hog");
		
	const uris = await findHogConfFiles();

	let i = 0;
	const arg1 = await vscode.window.showQuickPick(uris, {
		placeHolder: 'Available Hog projects'
	});

	const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath; // Get the first workspace folder if there is one
	if (workspaceFolder) {
		const scriptPath = path.join(workspaceFolder, 'Hog/CreateProject.sh');
		if (arg1){
			const command = `${scriptPath} ${arg1}`;
			outputChannel.show();

			outputChannel.appendLine(`Running command: ${command}`);
			const childProcess = spawn(command, { shell: true });
			childProcess.stdout.on('data', (data) => {
				outputChannel.append(data.toString());
			});
		
			childProcess.stderr.on('data', (data) => {
				outputChannel.append(data.toString());
			});
		
			childProcess.on('error', (error) => {
				console.error(`exec error: ${error}`);
				outputChannel.append(`Error: ${error.message}\n`);
			});
		
			childProcess.on('close', (code) => {
				console.log(`child process exited with code ${code}`);
				outputChannel.append(`Process exited with code ${code}\n`);
			});
		}
	}
		// exec(command, (error, stdout, stderr) => {
		// 	if (error) {
		// 		console.error(`exec error: ${error}`);
		// 		outputChannel.appendLine(`Error: ${error.message}`);
		// 		return;
		// 	}
		// 	console.log(`stdout: ${stdout}`);
		// 	console.error(`stderr: ${stderr}`);
		// 	outputChannel.appendLine(stdout);
		// 	outputChannel.appendLine(stderr);
		// });

}

interface TreeItemData {
	label: string;
	children?: TreeItemData[];
  }
  
  class MyTreeDataProvider implements vscode.TreeDataProvider<TreeItemData> {
	private _onDidChangeTreeData: vscode.EventEmitter<TreeItemData | undefined> = new vscode.EventEmitter<TreeItemData | undefined>();
	readonly onDidChangeTreeData: vscode.Event<TreeItemData | undefined> = this._onDidChangeTreeData.event;
  
	private data: TreeItemData = {
	  label: "Root",
	  children: [
		{ label: "Child 1" },
		{ label: "Child 2" },
		{
		  label: "Child 3",
		  children: [{ label: "Grandchild 1" }, { label: "Grandchild 2" }],
		},
	  ],
	};
  
	getChildren(element?: TreeItemData): Thenable<TreeItemData[]> {
	  return Promise.resolve(element ? element.children ?? [] : this.data.children ?? []);
	}
  
	getTreeItem(element: TreeItemData): vscode.TreeItem {
	  const treeItem = new vscode.TreeItem(element.label);
	  if (element.children) {
		treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
	  }
	  treeItem.contextValue = element.label;
	  return treeItem;
	}
  
	refresh(): void {
	  this._onDidChangeTreeData.fire(undefined);
	}
  }
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// const myTreeDataProvider = new MyTreeDataProvider();
	// vscode.window.createTreeView("myTree", { treeDataProvider: myTreeDataProvider });

	// context.subscriptions.push(
	// 	vscode.commands.registerCommand("hog.myCommand", (label) => {
	// 	vscode.window.showInformationMessage(`Clicked on ${label}`);
	// 	})
	// );

	// context.subscriptions.push(
	// 	vscode.commands.registerCommand("hog.refreshTree", () => {
	// 	myTreeDataProvider.refresh();
	// 	})
	// );
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "hog" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('hog.createproject', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// vscode.window.showInformationMessage('Hello World from Hog!');
		// const wf = vscode.workspace.workspaceFolders?.[0].uri.fsPath; // Get the first workspace folder if there is one

		CreateProject();
		
	});

	let disposable2 = vscode.commands.registerCommand('hog.openproject', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// vscode.window.showInformationMessage('Hello World from Hog!');
		// const wf = vscode.workspace.workspaceFolders?.[0].uri.fsPath; // Get the first workspace folder if there is one

		OpenProject();
		
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(disposable2);

}

// This method is called when your extension is deactivated
export function deactivate() {}
