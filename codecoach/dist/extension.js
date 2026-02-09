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
var vscode2 = __toESM(require("vscode"));

// src/codecoachView.ts
var vscode = __toESM(require("vscode"));
console.log("\u2705 codecoachView.ts module loaded");
var CodeCoachViewProvider = class {
  constructor(context, onUserMessage) {
    this.context = context;
    this.onUserMessage = onUserMessage;
  }
  static viewType = "codecoach.chatView";
  _view;
  resolveWebviewView(webviewView) {
    console.log("\u2705 resolveWebviewView called");
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };
    webviewView.webview.html = this.getHtml();
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type !== "send") {
        return;
      }
      try {
        const editor = vscode.window.activeTextEditor;
        const contextText = editor?.document.getText() ?? "";
        const reply = await this.onUserMessage(msg.text, contextText);
        webviewView.webview.postMessage({
          type: "assistant",
          text: reply
        });
      } catch (err) {
        webviewView.webview.postMessage({
          type: "assistant",
          text: `Error: ${err.message ?? String(err)}`
        });
      }
    });
  }
  reveal() {
    this._view?.show?.(true);
  }
  getHtml() {
    return (
      /* html */
      `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body {
    font-family: sans-serif;
    margin: 0;
    padding: 8px;
  }
  #chat {
    height: calc(100vh - 60px);
    overflow-y: auto;
    margin-bottom: 8px;
  }
  .user { font-weight: bold; }
  .assistant { color: #444; margin-bottom: 12px; }
</style>
</head>
<body>
  <div id="chat"></div>
  <input id="input" placeholder="Ask CodeCoach\u2026" style="width: 100%;" />

<script>
  const vscode = acquireVsCodeApi();
  const chat = document.getElementById("chat");
  const input = document.getElementById("input");

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      const text = input.value;
      input.value = "";

      chat.innerHTML += '<div class="user">You:</div>' + text;
      vscode.postMessage({ type: "send", text });
    }
  });

  window.addEventListener("message", (event) => {
    if (event.data.type === "assistant") {
      chat.innerHTML += '<div class="assistant"><b>CodeCoach:</b><br>' + event.data.text + '</div>';
    }
  });
</script>
</body>
</html>
`
    );
  }
};

// src/extension.ts
var KEY_NAME = "codecoach.geminiKey";
function activate(context) {
  console.log("\u2705 CodeCoach activate() ran");
  context.subscriptions.push(
    vscode2.commands.registerCommand("codecoach.setApiKey", async () => {
      const key = await vscode2.window.showInputBox({
        prompt: "Paste your Gemini API key (from Google AI Studio)",
        password: true,
        ignoreFocusOut: true
      });
      if (!key) {
        return;
      }
      console.log("\u2705 Registered view:", CodeCoachViewProvider.viewType);
      await context.secrets.store(KEY_NAME, key.trim());
      vscode2.window.showInformationMessage("CodeCoach: Gemini API key saved.");
    })
  );
  const onUserMessage = async (userText, contextText) => {
    const apiKey = await context.secrets.get(KEY_NAME);
    if (!apiKey) {
      throw new Error('No Gemini API key set. Run "CodeCoach: Set Gemini API Key".');
    }
    const modelName = "models/gemini-flash-latest";
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const MAX_CONTEXT_CHARS = 2e4;
    const safeContext = (contextText || "").length > MAX_CONTEXT_CHARS ? (contextText || "").slice(0, MAX_CONTEXT_CHARS) + "\n\n[Context truncated]" : contextText || "";
    const instructions = `
You are CodeCoach, a programming tutor inside VS Code.

Rules:
- Explain concepts clearly.
- Prefer: explanation \u2192 hint \u2192 small example.
- Do NOT give full solutions unless explicitly asked.
- If the user's question is ambiguous, ask ONE clarifying question.
- End with exactly ONE short guiding question.
`.trim();
    const prompt = `
${instructions}

Relevant code context (from the user's editor):
${safeContext || "(no code context available)"}

User question:
${userText}
`.trim();
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
    return data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).join("") ?? "No response.";
  };
  const provider = new CodeCoachViewProvider(context, onUserMessage);
  context.subscriptions.push(
    vscode2.window.registerWebviewViewProvider("codecoach.chatView", provider)
  );
  console.log("\u2705 registered provider for codecoach.chatView");
  context.subscriptions.push(
    vscode2.commands.registerCommand("codecoach.openChat", async () => {
      await vscode2.commands.executeCommand("workbench.view.extension.codecoach");
      provider.reveal();
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
