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
      if (msg.type !== "send") {
        return;
      }

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
          text: `Error: ${err.message ?? String(err)}`,
        });
      }
    });
  }

  reveal() {
    this._view?.show?.(true);
  }

  private getHtml(): string {
    return /* html */ `
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
  <input id="input" placeholder="Ask CodeCoach…" style="width: 100%;" />

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
`;
  }
}