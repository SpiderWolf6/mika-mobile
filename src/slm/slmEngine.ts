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
    use_mlock: true,
    n_ctx: 4096,
    n_threads: 4,
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

  const systemPrompt = `You are MIKA, a personal assistant.
Classify the user's request into exactly one intent type:
- calendar (create/list events)
- search (web search)
- gmail (send/read email)
- discord (send a message via Discord bot)
- wiki_query (answer a question about the user from their notes)
- wiki_write (save a new fact about the user)
- unknown

Respond ONLY with a JSON object like:
{"type": "calendar", "confidence": 0.95, "payload": {"action": "create", "title": "Team meeting"}}

User knowledge base:
${wikiBlock}

Recent conversation:
${historyBlock}`;

  const prompt = `${systemPrompt}\n\nUser: ${transcription}\nJSON:`;

  const result = await llamaCtx!.completion(
    {prompt, stop: ['\n', 'User:'], temperature: 0.1, n_predict: 200},
    token => {},
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

  const prompt = `<|system|>
You are MIKA, a helpful personal assistant. Be concise and friendly.
User knowledge base:
${wikiBlock}
<|end|>
<|user|>
${transcription}
(Action taken: ${intentResult})
<|end|>
<|assistant|>`;

  const result = await llamaCtx!.completion(
    {prompt, stop: ['<|end|>', '<|user|>'], temperature: 0.7, n_predict: 300},
    token => {},
  );

  return result.text.trim();
}

// Extracts any new facts from the conversation and returns them as markdown
export async function extractWikiFacts(
  transcription: string,
  response: string,
): Promise<string | null> {
  if (!llamaCtx) {
    await initSLM();
  }

  const prompt = `Extract any new personal facts about the user from this conversation.
If there are none, respond with exactly: NONE
Otherwise respond with a short markdown bullet list.

User said: "${transcription}"
Assistant said: "${response}"

Facts:`;

  const result = await llamaCtx!.completion(
    {prompt, stop: ['\n\n'], temperature: 0.1, n_predict: 150},
    token => {},
  );

  const text = result.text.trim();
  return text === 'NONE' ? null : text;
}
