import {LlamaContext, initLlama, releaseAllLlama} from 'llama.rn';
import {Intent, IntentType} from '../types';
import {PHI3_MODEL_PATH} from '../config';

let llamaCtx: LlamaContext | null = null;

export async function initSLM(): Promise<void> {
  if (llamaCtx) {
    return;
  }
  llamaCtx = await initLlama({
    model: PHI3_MODEL_PATH,
    use_mlock: false,
    use_mmap: true,
    n_ctx: 2048,
    n_threads: 6,
    n_gpu_layers: 99,
  });
}

export async function releaseSLM(): Promise<void> {
  await releaseAllLlama();
  llamaCtx = null;
}

export async function classifyIntent(transcription: string): Promise<Intent> {
  if (!llamaCtx) {
    await initSLM();
  }

  const prompt = `You are MIKA. Classify this request into ONE intent. Today: ${new Date().toISOString()}.

INTENTS: calendar, reminder, alarm, unknown
- calendar: {action:"create"|"edit"|"delete"|"list", title?, startDate?(ISO8601), endDate?(ISO8601)}
- reminder: {action:"create"|"edit"|"delete"|"list", title?, dueDate?(ISO8601)}
- alarm:    {action:"create"|"cancel"|"snooze"|"list", label?, isoTime?(ISO8601)}
- unknown:  {}

Respond ONLY with JSON. Example:
{"type":"alarm","confidence":0.95,"payload":{"action":"create","label":"Wake up","isoTime":"2026-05-25T07:00:00.000Z"}}

User: ${transcription}
JSON:`;

  const result = await llamaCtx!.completion(
    {prompt, stop: ['\n', 'User:'], temperature: 0.1, n_predict: 200},
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
): Promise<string> {
  if (!llamaCtx) {
    await initSLM();
  }

  const actionLine = intentResult !== 'No action taken'
    ? `You just completed this action: ${intentResult}.`
    : '';

  const prompt = `<|system|>
You are MIKA, a concise voice assistant. Reply in 1-2 short sentences.
Only handle calendar, reminders, and alarms. For anything else say you can't do that yet.
${actionLine}<|end|>
<|user|>${transcription}<|end|>
<|assistant|>`;

  const result = await llamaCtx!.completion(
    {prompt, stop: ['<|end|>', '<|user|>', '<|system|>'], temperature: 0.7, n_predict: 100},
    () => {},
  );

  let text = result.text.trim();
  // Truncate any prompt leakage
  for (const marker of ['<|', '<|user|>', '<|system|>']) {
    const idx = text.indexOf(marker);
    if (idx > 0) { text = text.slice(0, idx).trim(); }
  }
  return text;
}
