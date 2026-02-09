import * as vscode from "vscode";
import { CodeCoachViewProvider } from "./codecoachView";

const KEY_NAME = "codecoach.geminiKey";

export function activate(context: vscode.ExtensionContext) {
  // Command: set Gemini API key
  console.log("✅ CodeCoach activate() ran");
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.setApiKey", async () => {
      const key = await vscode.window.showInputBox({
        prompt: "Paste your Gemini API key (from Google AI Studio)",
        password: true,
        ignoreFocusOut: true,
      });


      if (!key) {
        return;
      }

      console.log("✅ Registered view:", CodeCoachViewProvider.viewType);

      await context.secrets.store(KEY_NAME, key.trim());
      vscode.window.showInformationMessage("CodeCoach: Gemini API key saved.");
    })
  );

  // Function called by the sidebar when user sends a message
  const onUserMessage = async (userText: string, contextText: string): Promise<string> => {
    const apiKey = await context.secrets.get(KEY_NAME);
    if (!apiKey) {
      throw new Error('No Gemini API key set. Run "CodeCoach: Set Gemini API Key".');
    }

    // If your account needs a different model, swap it here
    const modelName = "models/gemini-flash-latest";
    const url =
      `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`;

    // Keep context bounded (Gemini can error if you send too much)
    const MAX_CONTEXT_CHARS = 20_000;
    const safeContext =
      (contextText || "").length > MAX_CONTEXT_CHARS
        ? (contextText || "").slice(0, MAX_CONTEXT_CHARS) + "\n\n[Context truncated]"
        : (contextText || "");

    const instructions = `
You are CodeCoach, a programming tutor inside VS Code.

Rules:
- Explain concepts clearly.
- Prefer: explanation → hint → small example.
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
        generationConfig: { temperature: 0.3 },
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message ?? JSON.stringify(data);
      throw new Error(`${res.status} ${msg}`);
    }

    return (
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join("") ??
      "No response."
    );
  };

  // Register sidebar view provider
const provider = new CodeCoachViewProvider(context, onUserMessage);

context.subscriptions.push(
  vscode.window.registerWebviewViewProvider("codecoach.chatView", provider)
);

console.log("✅ registered provider for codecoach.chatView");

  // Command: reveal sidebar (reliable)
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.openChat", async () => {
      // This reveals the Activity Bar container with id "codecoach"
      await vscode.commands.executeCommand("workbench.view.extension.codecoach");
      provider.reveal();
    })
  );
}

export function deactivate() {}