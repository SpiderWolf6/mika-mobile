import {LlamaContext, initLlama, releaseAllLlama} from 'llama.rn';
import {Intent, IntentType, SLMContext} from '../types';
import {PHI3_MODEL_PATH, MAX_CONTEXT_TURNS} from '../config';

let llamaCtx: LlamaContext | null = null;

export async function initSLM(): Promise<void> {
  if (llamaCtx) {
    return;
  }
  llamaCtx = await initLlama({
    model: PHI3_MODEL_PATH,
    use_mlock: false,
    use_mmap: true,
    n_ctx: 1024,
    n_threads: 6,
    n_gpu_layers: 99,
  });
}

export async function releaseSLM(): Promise<void> {
  await releaseAllLlama();
  llamaCtx = null;
}

export async function classifyIntent(
  transcription: string,
  context: SLMContext,
): Promise<Intent> {
  if (!llamaCtx) {
    await initSLM();
  }

  const wikiBlock = context.wikiSnippets.join('\n\n');
  const historyBlock = context.recentTurns
    .slice(-MAX_CONTEXT_TURNS)
    .map(t => `User: ${t.userInput}\nMIKA: ${t.response}`)
    .join('\n');

  const systemPrompt = `You are MIKA, a personal assistant. Classify the user request into ONE intent.

AVAILABLE INTENTS:
- calendar: create/edit/delete/list calendar events
- reminder: create/edit/delete/list reminders in the Reminders app (with optional due time)
- alarm: set/cancel/snooze/list alarms that ring loudly until dismissed
- wiki_query: answer a question about the user using their personal notes
- wiki_write: save a new fact about the user
- unknown: anything else (you CANNOT do it, say so)

PAYLOAD RULES:
- calendar create: {action:"create", title, startDate (ISO8601), endDate (ISO8601), notes?, location?}
- calendar edit:   {action:"edit", title, eventId?, startDate?, endDate?, notes?, location?}
- calendar delete: {action:"delete", title?, eventId?}
- calendar list:   {action:"list", startDate?, endDate?}
- reminder create: {action:"create", title, dueDate? (ISO8601), notes?}
- reminder edit:   {action:"edit", title, reminderId?, dueDate?, notes?}
- reminder delete: {action:"delete", title?, reminderId?}
- reminder list:   {action:"list"}
- alarm create:    {action:"create", label, isoTime (ISO8601)}
- alarm cancel:    {action:"cancel", label}
- alarm snooze:    {action:"snooze", label}
- alarm list:      {action:"list"}

Today is ${new Date().toISOString()}.

Respond ONLY with valid JSON, no explanation:
{"type":"calendar","confidence":0.95,"payload":{"action":"create","title":"Team meeting","startDate":"2026-05-24T15:00:00.000Z","endDate":"2026-05-24T16:00:00.000Z"}}

User knowledge:
${wikiBlock}

Recent conversation:
${historyBlock}`;

  const prompt = `${systemPrompt}\n\nUser: ${transcription}\nJSON:`;

  const result = await llamaCtx!.completion(
    {prompt, stop: ['\n', 'User:'], temperature: 0.1, n_predict: 300},
    () => {},
  );

  try {
    const parsed = JSON.parse(result.text.trim());
    return {
      type: (parsed.type as IntentType) ?? 'unknown',
      confidence: parsed.confidence ?? 0.5,
      payload: parsed.payload ?? {},
    };
  } catch {
    return {type: 'unknown', confidence: 0, payload: {}};
  }
}

export async function generateResponse(
  transcription: string,
  intentResult: string,
  context: SLMContext,
): Promise<string> {
  if (!llamaCtx) {
    await initSLM();
  }

  const wikiBlock = context.wikiSnippets.join('\n\n');

  const actionContext = intentResult !== 'No action taken'
    ? `Action completed: ${intentResult}.`
    : '';

  const prompt = `<|system|>
You are MIKA, a concise friendly personal assistant. Respond in 1-2 sentences only.
You can help with calendar events, reminders, and alarms. For anything else say you can't do that yet.
${actionContext}
User knowledge: ${wikiBlock}
<|end|>
<|user|>
${transcription}
<|end|>
<|assistant|>`;

  const result = await llamaCtx!.completion(
    {prompt, stop: ['<|end|>', '<|user|>', '<|system|>', 'User knowledge:', 'Action completed:'], temperature: 0.7, n_predict: 150},
    () => {},
  );

  // Hard-truncate anything that looks like prompt leakage
  let text = result.text.trim();
  const leakMarkers = ['<|', 'User knowledge:', 'Action completed:', '<|system|>', '<|user|>'];
  for (const marker of leakMarkers) {
    const idx = text.indexOf(marker);
    if (idx > 0) { text = text.slice(0, idx).trim(); }
  }
  return text;
}

export async function extractWikiFacts(
  transcription: string,
  response: string,
): Promise<string | null> {
  if (!llamaCtx) {
    await initSLM();
  }

  const prompt = `Extract any new personal facts about the user from this exchange.
If none, respond exactly: NONE
Otherwise a short markdown bullet list only.

User: "${transcription}"
Assistant: "${response}"

Facts:`;

  const result = await llamaCtx!.completion(
    {prompt, stop: ['\n\n'], temperature: 0.1, n_predict: 150},
    () => {},
  );

  const text = result.text.trim();
  return text === 'NONE' ? null : text;
}
