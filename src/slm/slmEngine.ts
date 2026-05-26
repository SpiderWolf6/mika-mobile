import {LlamaContext, initLlama, releaseAllLlama} from 'llama.rn';
import {PHI3_MODEL_PATH} from '../config';

let llamaCtx: LlamaContext | null = null;

export async function getSharedCtx(): Promise<LlamaContext> {
  if (llamaCtx) { return llamaCtx; }
  llamaCtx = await initLlama({
    model: PHI3_MODEL_PATH,
    use_mlock: false,
    use_mmap: true,
    n_ctx: 512,
    n_threads: 6,
    n_gpu_layers: 99,
  });
  return llamaCtx;
}

export async function releaseSLM(): Promise<void> {
  await releaseAllLlama();
  llamaCtx = null;
}

export async function chat(userMessage: string): Promise<string> {
  const ctx = await getSharedCtx();
  const prompt =
    `<|system|>\nYou are MIKA, a friendly voice assistant. Reply conversationally in 1-2 short sentences.\n<|end|>\n` +
    `<|user|>\n${userMessage}\n<|end|>\n` +
    `<|assistant|>\n`;

  const result = await ctx.completion(
    {prompt, stop: ['<|end|>', '<|user|>'], temperature: 0.7, n_predict: 60},
    () => {},
  );
  return result.text.trim();
}
