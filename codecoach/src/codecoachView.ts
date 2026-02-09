import * as vscode from "vscode";

console.log("✅ codecoachView.ts module loaded");

export class CodeCoachViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codecoach.chatView";

  private _view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onUserMessage: (userText: string, contextText: string) => Promise<string>
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    console.log("✅ resolveWebviewView called");
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
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
          text: reply,
        });
      } catch (err: any) {
        webviewView.webview.postMessage({
          type: "assistant",
          text: `Error: ${err?.message ?? String(err)}`,
        });
      } finally {
        webviewView.webview.postMessage({
          type: "done",
        });
      }
    });
  }

  reveal() {
    this._view?.show?.(true);
  }

  private getHtml(): string {
    return /* html */ `<!DOCTYPE html>
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
  <div id="thinking" class="thinking" style="display:none;">Thinking…</div>

  <div class="composer">
    <textarea id="input" placeholder="Ask CodeCoach… (Enter to send, Shift+Enter for newline)"></textarea>
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
</html>`;
  }
}