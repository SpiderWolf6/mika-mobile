import {initWhisper, WhisperContext} from 'whisper.rn';
import {WHISPER_MODEL_PATH} from '../config';

let whisperCtx: WhisperContext | null = null;

export async function initWhisperEngine(): Promise<void> {
  if (whisperCtx) {
    return;
  }
  whisperCtx = await initWhisper({filePath: WHISPER_MODEL_PATH});
}

export async function transcribeAudio(audioFilePath: string): Promise<string> {
  if (!whisperCtx) {
    await initWhisperEngine();
  }

  const {promise} = whisperCtx!.transcribe(audioFilePath, {
    language: 'en',
    maxLen: 1,
    tokenTimestamps: false,
  });

  const result = await promise;
  return result.result.trim();
}

export function releaseWhisper(): void {
  whisperCtx?.release();
  whisperCtx = null;
}
