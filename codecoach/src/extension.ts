import * as vscode from 'vscode';
import OpenAI from 'openai';

const KEY_NAME = 'codecoach.openaiKey';

export function activate(context: vscode.ExtensionContext) {
  console.log('CodeCoach activated');

  // Command 1: Set API key (stored securely in VS Code SecretStorage)
  context.subscriptions.push(
    vscode.commands.registerCommand('codecoach.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Paste your OpenAI API key',
        password: true,
        ignoreFocusOut: true,
      });

      if (!key) {
        return;
      }

      await context.secrets.store(KEY_NAME, key.trim());
      vscode.window.showInformationMessage('CodeCoach: API key saved.');
    })
  );

  // Command 2: Explain Selection (calls OpenAI)
  context.subscriptions.push(
    vscode.commands.registerCommand('codecoach.explainSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('Open a file first.');
        return;
      }

      const selectedText = editor.document.getText(editor.selection).trim();
      if (!selectedText) {
        vscode.window.showErrorMessage('Select some code first.');
        return;
      }

      const apiKey = await context.secrets.get(KEY_NAME);
      if (!apiKey) {
        vscode.window.showErrorMessage('Set your OpenAI API key first.');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'CodeCoach is thinking…',
          cancellable: false,
        },
        async () => {
          try {
            const client = new OpenAI({ apiKey });

            const response = await client.chat.completions.create({
              model: 'gpt-4.1-mini',
              messages: [
                {
                  role: 'system',
                  content: `
You are CodeCoach, a programming tutor.
Do NOT give full solutions unless explicitly asked.
Explain concepts clearly.
Give hints and small examples.
End with one short question that checks understanding.
                  `.trim(),
                },
                { role: 'user', content: `Explain this code:\n\n${selectedText}` },
              ],
              temperature: 0.3,
            });

            const explanation = response.choices[0]?.message?.content ?? 'No response.';

            const doc = await vscode.workspace.openTextDocument({
              content: `# CodeCoach Explanation\n\n${explanation}`,
              language: 'markdown',
            });

            await vscode.window.showTextDocument(doc, { preview: true });
          } catch (err: any) {
            const msg =
              err?.response?.data
                ? JSON.stringify(err.response.data, null, 2)
                : err?.message || String(err);

            vscode.window.showErrorMessage(`CodeCoach error: ${msg}`);
            console.error('CodeCoach error:', err);
          }
        }
      );
    })
  );
}

export function deactivate() {}