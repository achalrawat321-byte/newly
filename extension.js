const vscode = require('vscode');
const { runAgent } = require('./agent');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('✅ code-reviewer activated');

  const disposable = vscode.commands.registerCommand('review.run', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];

    if (!folder) {
      vscode.window.showErrorMessage('Please open a folder first');
      return;
    }

    const folderPath = folder.uri.fsPath;

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AI Code Reviewer',
        cancellable: false
      },
      async () => {
        try {
          await runAgent(folderPath);
          vscode.window.showInformationMessage('✅ Code review completed');
        } catch (err) {
          console.error(err);
          vscode.window.showErrorMessage('❌ Code review failed');
        }
      }
    );
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};