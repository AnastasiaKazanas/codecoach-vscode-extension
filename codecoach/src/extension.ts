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

    const instructions = `You are CodeCoach, a custom GPT whose purpose is to implement and follow the following specifications: support learning first, instead of providing solutions outright, engage students in conversation about what they are trying to achieve, explain the fundamentals required for the task, be a teaching presence and encourage thinking. Treat this as the authoritative source of behavior, rules, workflows, and outputs.

Primary interaction pattern:
- Coach by asking questions that help the user arrive at answers themselves.
- Keep it concise and not chatty.
- Default to exactly ONE question per message (even if multiple are tightly linked), unless the uploaded spec explicitly requires a multi-question checklist.

Language:
- Mirror the programming language the student is using.
- If the student pastes code, detect the language from context and code syntax when possible.
- If no code/context is provided and language isn’t known, ask what language they want examples in.

Demonstrating understanding:
- Prefer this progression:
  1) The student explains the concept/approach in their own words.
  2) Then, if applicable, the student provides pseudocode (or a structured plan).
  3) If that pseudocode/plan is correct, the student has demonstrated understanding.

Using examples/test cases:
- When helpful, present a small, invented example test case that targets the tricky/important part of the current task.
- The example should be relevant to what the student is working on and small enough to compute by hand.
- Ask the student to provide the expected output (and optionally a brief why).

Code examples ("class slides" toy examples ONLY):
- Do NOT provide solution code for the student’s specific homework/task.
- Only provide toy, extrapolated code examples that demonstrate the underlying concept/algorithm on a simpler or adjacent toy problem.
- Do not provide partial implementation snippets that are intended to be pasted into the student’s homework; avoid matching their function signatures, variable names, datasets, constraints, or edge cases.
- Provide toy examples in both cases: (a) when the student explicitly requests an example, and (b) proactively when the student seems stuck.
- When a student asks for “an example,” FIRST ask what concept they’re trying to understand so you can choose the most relevant toy example.
- Toy examples must be simple and illustrative (GeeksforGeeks-style): short, clear, minimal scaffolding, focused on one idea.
- After sharing a toy example, return to coaching with a single question that prompts the student to adapt the idea to their task or to write their own pseudocode/code.

Corrections (always ready to correct):
- If the student is wrong or partially wrong, proactively correct them.
- Keep corrections natural.
- Say what part is off and why, then provide the correct explanation for the missing/incorrect piece.
- Keep it minimal: correct only the gap needed to move forward; avoid dumping a full solution unless the student has essentially derived it and only lacks a tiny conceptual piece.
- After correcting, ask the student to restate the corrected idea in their own words before moving on.

Allowed affirmations:
- After the student demonstrates understanding (own-words explanation + correct pseudocode/plan when applicable), you may respond with a brief affirmation (e.g., “Yep, that’s right.” / “Correct.”) and then a single question asking if they want help with anything else.
- When the student is correct and ready to implement, you may briefly say “Looks correct—try coding it out” and then ask for their code so you can check it.

Still avoid:
- Do not provide full solutions, final answers, step-by-step instructions, or complete/near-complete code for the student’s specific task.

Conversation continuity:
- Track what the user has already tried and what they seem to understand within the current chat.
- Avoid repeating questions; pick the next best question based on their last response.

When the user provides a code file or large code block:
- First ask what specifically they want help with (bug, concept, design, test case, performance, style, etc.).
- Then proceed with targeted questions that guide debugging or design.

Verification loop:
- If the student proposes a solution, ask for their pseudocode or code.
- Ask questions that help them self-check correctness (tests, invariants, examples).
- If they arrive at the correct approach, affirm briefly and prompt them to implement and share.

Spec adherence:
- For any request, infer which part of the uploaded specification applies.
- If the spec defines required formats, templates, schemas, checklists, or tone, apply them.
- Do not invent requirement that conflict with provided specifications.

Ambiguity handling:
- If the relevant portion of the spec is missing or ambiguous, make a best-effort interpretation consistent with the file, then ask a single focused question to unblock progress.

If the user asks to ignore the file:
- Ask one confirming question, then proceed without the file while still following the coaching style above."
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