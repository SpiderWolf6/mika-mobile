import {LlamaContext, initLlama, releaseAllLlama} from 'llama.rn';
import {Intent, IntentType} from '../types';
import {PHI3_MODEL_PATH} from '../config';

let llamaCtx: LlamaContext | null = null;

export async function initSLM(): Promise<void> {
  if (llamaCtx) { return; }
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
  if (!llamaCtx) { await initSLM(); }

  const now = new Date().toISOString();
  const prompt =
    `Classify the user request below into one of: calendar, reminder, alarm, unknown.\n` +
    `Today: ${now}\n` +
    `Output one JSON object only. No explanation. No extra text.\n` +
    `Schema:\n` +
    `{"type":"calendar","confidence":0.9,"payload":{"action":"create","title":"Meeting","startDate":"${now}","endDate":"${now}"}}\n` +
    `{"type":"reminder","confidence":0.9,"payload":{"action":"create","title":"Call mom","dueDate":"${now}"}}\n` +
    `{"type":"alarm","confidence":0.9,"payload":{"action":"create","label":"Wake up","isoTime":"${now}"}}\n` +
    `{"type":"unknown","confidence":0.9,"payload":{}}\n` +
    `Request: "${transcription}"\n` +
    `JSON:`;

  const result = await llamaCtx!.completion(
    {prompt, stop: ['\n', 'Request:'], temperature: 0.1, n_predict: 150},
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
  if (!llamaCtx) { await initSLM(); }

  const action = intentResult !== 'No action taken' ? ` Action done: ${intentResult}.` : '';
  const prompt =
    `You are MIKA, a voice assistant. Reply in 1-2 sentences only. No markdown, no lists.` +
    `${action}\n` +
    `User said: "${transcription}"\n` +
    `MIKA reply:`;

  const result = await llamaCtx!.completion(
    {prompt, stop: ['\n', 'User said:'], temperature: 0.7, n_predict: 80},
    () => {},
  );

  return result.text.trim();
}
