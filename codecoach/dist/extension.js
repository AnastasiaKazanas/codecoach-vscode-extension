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
      if (msg.type !== "send") return;
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
          text: `Error: ${err?.message ?? String(err)}`
        });
      } finally {
        webviewView.webview.postMessage({
          type: "done"
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
      `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  :root {
    --bg: var(--vscode-sideBar-background);
    --fg: var(--vscode-foreground);
    --muted: var(--vscode-descriptionForeground);
    --border: var(--vscode-sideBar-border);
    --inputBg: var(--vscode-input-background);
    --inputFg: var(--vscode-input-foreground);
    --btnBg: var(--vscode-button-background);
    --btnFg: var(--vscode-button-foreground);
    --btnHover: var(--vscode-button-hoverBackground);

    --bubbleUser: rgba(0, 122, 255, 0.18);
    --bubbleAsst: rgba(120, 120, 120, 0.18);
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    margin: 0;
    padding: 0;
    color: var(--fg);
    background: var(--bg);
  }

  .wrap {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  #chat {
    flex: 1;
    overflow-y: auto;
    padding: 10px 10px 0 10px;
  }

  .row {
    display: flex;
    margin: 8px 0;
  }

  .row.user { justify-content: flex-end; }
  .row.assistant { justify-content: flex-start; }

  .bubble {
    max-width: 85%;
    padding: 10px 12px;
    border-radius: 14px;
    white-space: pre-wrap;
    word-wrap: break-word;
    line-height: 1.35;
    border: 1px solid rgba(255,255,255,0.06);
  }

  .bubble.user {
    background: var(--bubbleUser);
  }

  .bubble.assistant {
    background: var(--bubbleAsst);
  }

  .label {
    font-size: 11px;
    color: var(--muted);
    margin: 0 10px 4px 10px;
  }

  .composer {
    border-top: 1px solid rgba(255,255,255,0.08);
    padding: 10px;
    display: flex;
    gap: 8px;
    align-items: flex-end;
    background: var(--bg);
  }

  textarea {
    width: 100%;
    resize: none;
    min-height: 36px;
    max-height: 140px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.10);
    background: var(--inputBg);
    color: var(--inputFg);
    outline: none;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.35;
  }

  button {
    border: none;
    border-radius: 10px;
    padding: 9px 12px;
    background: var(--btnBg);
    color: var(--btnFg);
    cursor: pointer;
    font-weight: 600;
    font-size: 12px;
  }

  button:hover { background: var(--btnHover); }
  button:disabled { opacity: 0.6; cursor: default; }

  .thinking {
    font-size: 12px;
    color: var(--muted);
    margin: 6px 10px 10px 10px;
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="label">CodeCoach Chat</div>
  <div id="chat" aria-label="Chat history"></div>
  <div id="thinking" class="thinking" style="display:none;">Thinking\u2026</div>

  <div class="composer">
    <textarea id="input" placeholder="Ask CodeCoach\u2026 (Enter to send, Shift+Enter for newline)"></textarea>
    <button id="sendBtn" title="Send">Send</button>
  </div>
</div>

<script>
  const vscode = acquireVsCodeApi();

  const chat = document.getElementById("chat");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");
  const thinking = document.getElementById("thinking");

  function scrollToBottom() {
    chat.scrollTop = chat.scrollHeight;
  }

  function addMessage(role, text) {
    const row = document.createElement("div");
    row.className = "row " + role;

    const bubble = document.createElement("div");
    bubble.className = "bubble " + role;

    // IMPORTANT: textContent prevents HTML injection (no innerHTML)
    bubble.textContent = text;

    row.appendChild(bubble);
    chat.appendChild(row);

    scrollToBottom();
  }

  function setBusy(isBusy) {
    input.disabled = isBusy;
    sendBtn.disabled = isBusy;
    thinking.style.display = isBusy ? "block" : "none";
  }

  function sendCurrent() {
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    addMessage("user", text);
    setBusy(true);

    vscode.postMessage({ type: "send", text });
  }

  // Enter sends, Shift+Enter newline
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCurrent();
    }
  });

  sendBtn.addEventListener("click", () => {
    sendCurrent();
  });

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === "assistant") {
      addMessage("assistant", msg.text || "");
    }

    if (msg.type === "done") {
      setBusy(false);
      input.focus();
    }
  });

  // Start focused
  input.focus();
</script>
</body>
</html>`
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
