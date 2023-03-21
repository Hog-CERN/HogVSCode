"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const path = require("path");
const child_process_1 = require("child_process");
async function CreateProject() {
    const arg1 = await vscode.window.showInputBox({
        prompt: "Which Hog Project do you want to create?"
    });
    if (!arg1) {
        // User cancelled input
        return;
    }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath; // Get the first workspace folder if there is one
    if (workspaceFolder) {
        const scriptPath = path.join(workspaceFolder, 'Hog/CreateProject.sh');
        const command = `${scriptPath} ${arg1}`;
        const outputChannel = vscode.window.createOutputChannel("Hog");
        outputChannel.show();
        outputChannel.appendLine(`Running command: ${command}`);
        const childProcess = (0, child_process_1.spawn)(command, { shell: true });
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
}
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
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
        CreateProject();
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
// This method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map