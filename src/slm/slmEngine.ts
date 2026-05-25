import {LlamaContext, initLlama, releaseAllLlama} from 'llama.rn';
import {Intent, GatekeeperOutcome} from '../types';
import {PHI3_MODEL_PATH} from '../config';

let llamaCtx: LlamaContext | null = null;

async function getCtx(): Promise<LlamaContext> {
  if (llamaCtx) { return llamaCtx; }
  llamaCtx = await initLlama({
    model: PHI3_MODEL_PATH,
    use_mlock: false,
    use_mmap: true,
    n_ctx: 512,
    n_threads: 4,
    n_gpu_layers: 99,
  });
  return llamaCtx;
}

export async function releaseSLM(): Promise<void> {
  await releaseAllLlama();
  llamaCtx = null;
}

async function complete(prompt: string, maxTokens: number, stop: string[]): Promise<string> {
  const ctx = await getCtx();
  const result = await ctx.completion(
    {prompt, stop, temperature: 0.1, n_predict: maxTokens},
    () => {},
  );
  return result.text.trim();
}

// ─── Agent 1: Gatekeeper ─────────────────────────────────────────────────────
// Decides: cannot_do | cannot_answer | need_clarification | ready
// Never hallucinates parameters — only routes.

export async function runGatekeeper(
  userInput: string,
  collectedInfo: string | null,
  now: string,
): Promise<GatekeeperOutcome> {
  const context = collectedInfo
    ? `Previously collected info: ${collectedInfo}\nNew input: ${userInput}`
    : `User input: ${userInput}`;

  const prompt =
    `You are MIKA's routing agent. Current datetime: ${now}\n` +
    `MIKA can ONLY do: set alarm, set reminder, add calendar event.\n` +
    `MIKA cannot browse the web, send messages, answer general knowledge questions, or do anything else.\n` +
    `\n` +
    `${context}\n` +
    `\n` +
    `Decide ONE of these outcomes and output JSON only:\n` +
    `- User wants something MIKA cannot do (not alarm/reminder/calendar): {"status":"cannot_do"}\n` +
    `- User asks a question MIKA cannot answer (no context, general knowledge): {"status":"cannot_answer"}\n` +
    `- User wants alarm/reminder/calendar but info is MISSING or AMBIGUOUS (no date, no time, ambiguous AM/PM, no event name, etc): {"status":"need_clarification","connector":"<alarm|reminder|calendar>","question":"<one short question to ask>","partialInfo":"<summarize what you know so far>"}\n` +
    `- User wants alarm/reminder/calendar and ALL required info is present: {"status":"ready","connector":"<alarm|reminder|calendar>","summary":"<one sentence summary of the full request with all details>"}\n` +
    `\n` +
    `Required info rules:\n` +
    `- alarm: needs time (with AM/PM unambiguous) and day. If user says "4 o'clock" without AM/PM, that is ambiguous — ask.\n` +
    `- reminder: needs a title/task and a due date+time.\n` +
    `- calendar: needs event name, date, start time (AM/PM unambiguous). End time optional (default 1 hour).\n` +
    `\n` +
    `JSON:`;

  const raw = await complete(prompt, 120, ['\n\n', 'User input:', 'Previously']);

  try {
    // Extract first JSON object from output
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) { throw new Error('no json'); }
    const parsed = JSON.parse(match[0]);
    const status = parsed.status;
    if (status === 'cannot_do') { return {status: 'cannot_do'}; }
    if (status === 'cannot_answer') { return {status: 'cannot_answer'}; }
    if (status === 'need_clarification') {
      return {
        status: 'need_clarification',
        connector: parsed.connector ?? 'alarm',
        question: parsed.question ?? 'Can you give me more details?',
        partialInfo: parsed.partialInfo ?? userInput,
      };
    }
    if (status === 'ready') {
      return {
        status: 'ready',
        connector: parsed.connector,
        summary: parsed.summary ?? userInput,
      };
    }
    throw new Error('unknown status');
  } catch {
    // If parsing fails, treat as cannot_do to avoid hallucination
    return {status: 'cannot_do'};
  }
}

// ─── Agent 2: Payload Extractor ───────────────────────────────────────────────
// Only runs when gatekeeper says ready. Extracts exact connector parameters.

export async function extractAlarmPayload(summary: string, now: string): Promise<Intent> {
  const prompt =
    `Current datetime: ${now}\n` +
    `Extract alarm details from this request: "${summary}"\n` +
    `Output ONE JSON object only. Compute the exact ISO 8601 datetime for isoTime based on the current datetime above.\n` +
    `{"action":"create","label":"<short label>","isoTime":"<ISO8601 datetime>"}\n` +
    `JSON:`;

  const raw = await complete(prompt, 80, ['\n\n']);
  try {
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) { throw new Error('no json'); }
    const p = JSON.parse(match[0]);
    return {type: 'alarm', confidence: 0.95, payload: p};
  } catch {
    return {type: 'alarm', confidence: 0, payload: {action: 'create', label: 'Alarm', isoTime: ''}};
  }
}

export async function extractReminderPayload(summary: string, now: string): Promise<Intent> {
  const prompt =
    `Current datetime: ${now}\n` +
    `Extract reminder details from this request: "${summary}"\n` +
    `Output ONE JSON object only. Compute the exact ISO 8601 datetime for dueDate.\n` +
    `{"action":"create","title":"<reminder title>","dueDate":"<ISO8601 datetime>"}\n` +
    `JSON:`;

  const raw = await complete(prompt, 80, ['\n\n']);
  try {
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) { throw new Error('no json'); }
    const p = JSON.parse(match[0]);
    return {type: 'reminder', confidence: 0.95, payload: p};
  } catch {
    return {type: 'reminder', confidence: 0, payload: {action: 'create', title: 'Reminder', dueDate: ''}};
  }
}

export async function extractCalendarPayload(summary: string, now: string): Promise<Intent> {
  const prompt =
    `Current datetime: ${now}\n` +
    `Extract calendar event details from this request: "${summary}"\n` +
    `Output ONE JSON object only. Compute exact ISO 8601 datetimes. End time defaults to 1 hour after start if not specified.\n` +
    `{"action":"create","title":"<event name>","startDate":"<ISO8601>","endDate":"<ISO8601>","notes":"<optional notes or empty string>"}\n` +
    `JSON:`;

  const raw = await complete(prompt, 100, ['\n\n']);
  try {
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) { throw new Error('no json'); }
    const p = JSON.parse(match[0]);
    return {type: 'calendar', confidence: 0.95, payload: p};
  } catch {
    return {type: 'calendar', confidence: 0, payload: {action: 'create', title: 'Event', startDate: '', endDate: ''}};
  }
}

// ─── Response generator ───────────────────────────────────────────────────────

export async function generateResponse(
  userInput: string,
  outcome: string,
): Promise<string> {
  const prompt =
    `You are MIKA, a voice assistant. Reply in 1-2 short sentences. No markdown, no lists.\n` +
    `Outcome: ${outcome}\n` +
    `User said: "${userInput}"\n` +
    `MIKA reply:`;

  return complete(prompt, 80, ['\n', 'User said:']);
}
