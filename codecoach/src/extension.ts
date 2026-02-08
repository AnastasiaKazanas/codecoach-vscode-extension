import * as vscode from 'vscode';

const KEY_NAME = 'codecoach.geminiKey';
const MODEL_NAME_KEY = 'codecoach.geminiModelName';

export function activate(context: vscode.ExtensionContext) {
  console.log('CodeCoach activated');

  // 1) Set Gemini API key
  context.subscriptions.push(
    vscode.commands.registerCommand('codecoach.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Paste your Gemini API key (from Google AI Studio)',
        password: true,
        ignoreFocusOut: true,
      });

      if (!key) return;

      await context.secrets.store(KEY_NAME, key.trim());
      vscode.window.showInformationMessage('CodeCoach: Gemini API key saved.');
    })
  );

  // 2) List available Gemini models for THIS key and let you pick one.
  // It saves the chosen model in globalState so Explain Selection uses it.
  context.subscriptions.push(
    vscode.commands.registerCommand('codecoach.listGeminiModels', async () => {
      const apiKey = await context.secrets.get(KEY_NAME);
      if (!apiKey) {
        vscode.window.showErrorMessage('Set your Gemini API key first (CodeCoach: Set Gemini API Key).');
        return;
      }

      try {
        const listUrl =
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;

        const res = await fetch(listUrl);
        const data: any = await res.json();

        if (!res.ok) {
          const msg = data?.error?.message ?? JSON.stringify(data);
          throw new Error(`${res.status} ${msg}`);
        }

        const names: string[] = (data?.models ?? [])
          .map((m: any) => m?.name)
          .filter((n: any) => typeof n === 'string' && n.length > 0);

        if (names.length === 0) {
          vscode.window.showErrorMessage('No models returned for this key.');
          return;
        }

        const pick = await vscode.window.showQuickPick(names, {
          title: 'Pick a Gemini model to use',
          placeHolder: 'Choose a model (we will save it for Explain Selection)',
        });

        if (!pick) return;

        await context.globalState.update(MODEL_NAME_KEY, pick);
        await vscode.env.clipboard.writeText(pick);

        vscode.window.showInformationMessage(`Saved model: ${pick} (also copied to clipboard)`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`CodeCoach error: ${err?.message ?? String(err)}`);
        console.error('List models error:', err);
      }
    })
  );

  // 3) Explain Selection (Gemini)
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
        vscode.window.showErrorMessage('Set your Gemini API key first (CodeCoach: Set Gemini API Key).');
        return;
      }

      // Use saved model if you picked one; otherwise fall back to a common alias.
      const savedModel = context.globalState.get<string>(MODEL_NAME_KEY);
      const modelName = savedModel ?? 'models/gemini-flash-latest';

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'CodeCoach (Gemini) is thinking…',
          cancellable: false,
        },
        async () => {
          try {
            const prompt = `
You are CodeCoach, a programming tutor.
Do NOT give full solutions unless explicitly asked.
Explain concepts clearly.
Give hints and small examples.
End with one short question that checks understanding.

Explain this code:

${selectedText}
            `.trim();

            // NOTE: modelName is expected to look like "models/..."
            const url =
              `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent` +
              `?key=${encodeURIComponent(apiKey)}`;

            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3 },
              }),
            });

            const data: any = await res.json();

            if (!res.ok) {
              const msg = data?.error?.message ?? JSON.stringify(data);
              throw new Error(`${res.status} ${msg}`);
            }

            const explanation =
              data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join('') ??
              'No response.';

            const doc = await vscode.workspace.openTextDocument({
              content: `# CodeCoach Explanation (Gemini)\n\n**Model:** \`${modelName}\`\n\n${explanation}`,
              language: 'markdown',
            });

            await vscode.window.showTextDocument(doc, { preview: true });
          } catch (err: any) {
            vscode.window.showErrorMessage(`CodeCoach error: ${err?.message ?? String(err)}`);
            console.error('Explain error:', err);
          }
        }
      );
    })
  );
}

export function deactivate() {}