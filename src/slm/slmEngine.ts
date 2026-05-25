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

  const prompt = `Classify the user request. Today: ${new Date().toISOString()}.
Output ONLY a single JSON object, nothing else.
Types: calendar, reminder, alarm, unknown
calendar payload: {action:"create"|"edit"|"delete"|"list", title?, startDate?, endDate?}
reminder payload: {action:"create"|"edit"|"delete"|"list", title?, dueDate?}
alarm payload: {action:"create"|"cancel"|"snooze"|"list", label?, isoTime?}
Dates must be ISO8601.
Example: {"type":"alarm","confidence":0.95,"payload":{"action":"create","label":"Wake up","isoTime":"2026-05-25T07:00:00.000Z"}}
User request: ${transcription}
JSON:`;

  const result = await llamaCtx!.completion(
    {prompt, stop: ['\n'], temperature: 0.1, n_predict: 150},
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
    ? `Action done: ${intentResult}.`
    : '';

  // Use ### format instead of <|end|> tags to avoid stop token conflicts
  const prompt = `### System
You are MIKA, a concise voice assistant. Reply in 1-2 short sentences only. No lists, no markdown.
Only handle calendar, reminders, and alarms. For anything else say you cannot do that yet.
${actionLine}
### User
${transcription}
### MIKA
`;

  const result = await llamaCtx!.completion(
    {prompt, stop: ['###', '\n\n'], temperature: 0.7, n_predict: 80},
    () => {},
  );

  let text = result.text.trim();
  // Strip any leaked markup
  const cutAt = (marker: string) => {
    const i = text.indexOf(marker);
    if (i > 0) { text = text.slice(0, i).trim(); }
  };
  cutAt('###');
  cutAt('<|');
  cutAt('User:');
  cutAt('System:');
  return text;
}
