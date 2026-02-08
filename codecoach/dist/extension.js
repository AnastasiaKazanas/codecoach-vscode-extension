"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var KEY_NAME = "codecoach.geminiKey";
var MODEL_NAME_KEY = "codecoach.geminiModelName";
function activate(context) {
  console.log("CodeCoach activated");
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.setApiKey", async () => {
      const key = await vscode.window.showInputBox({
        prompt: "Paste your Gemini API key (from Google AI Studio)",
        password: true,
        ignoreFocusOut: true
      });
      if (!key) return;
      await context.secrets.store(KEY_NAME, key.trim());
      vscode.window.showInformationMessage("CodeCoach: Gemini API key saved.");
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.listGeminiModels", async () => {
      const apiKey = await context.secrets.get(KEY_NAME);
      if (!apiKey) {
        vscode.window.showErrorMessage("Set your Gemini API key first (CodeCoach: Set Gemini API Key).");
        return;
      }
      try {
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(listUrl);
        const data = await res.json();
        if (!res.ok) {
          const msg = data?.error?.message ?? JSON.stringify(data);
          throw new Error(`${res.status} ${msg}`);
        }
        const names = (data?.models ?? []).map((m) => m?.name).filter((n) => typeof n === "string" && n.length > 0);
        if (names.length === 0) {
          vscode.window.showErrorMessage("No models returned for this key.");
          return;
        }
        const pick = await vscode.window.showQuickPick(names, {
          title: "Pick a Gemini model to use",
          placeHolder: "Choose a model (we will save it for Explain Selection)"
        });
        if (!pick) return;
        await context.globalState.update(MODEL_NAME_KEY, pick);
        await vscode.env.clipboard.writeText(pick);
        vscode.window.showInformationMessage(`Saved model: ${pick} (also copied to clipboard)`);
      } catch (err) {
        vscode.window.showErrorMessage(`CodeCoach error: ${err?.message ?? String(err)}`);
        console.error("List models error:", err);
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.explainSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("Open a file first.");
        return;
      }
      const selectedText = editor.document.getText(editor.selection).trim();
      if (!selectedText) {
        vscode.window.showErrorMessage("Select some code first.");
        return;
      }
      const apiKey = await context.secrets.get(KEY_NAME);
      if (!apiKey) {
        vscode.window.showErrorMessage("Set your Gemini API key first (CodeCoach: Set Gemini API Key).");
        return;
      }
      const savedModel = context.globalState.get(MODEL_NAME_KEY);
      const modelName = savedModel ?? "models/gemini-flash-latest";
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "CodeCoach (Gemini) is thinking\u2026",
          cancellable: false
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
            const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3 }
              })
            });
            const data = await res.json();
            if (!res.ok) {
              const msg = data?.error?.message ?? JSON.stringify(data);
              throw new Error(`${res.status} ${msg}`);
            }
            const explanation = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).join("") ?? "No response.";
            const doc = await vscode.workspace.openTextDocument({
              content: `# CodeCoach Explanation (Gemini)

**Model:** \`${modelName}\`

${explanation}`,
              language: "markdown"
            });
            await vscode.window.showTextDocument(doc, { preview: true });
          } catch (err) {
            vscode.window.showErrorMessage(`CodeCoach error: ${err?.message ?? String(err)}`);
            console.error("Explain error:", err);
          }
        }
      );
    })
  );
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
