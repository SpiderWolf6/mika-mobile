import Voice from '@react-native-voice/voice';

export function initVoice(onResult: (text: string) => void, onError: (e: any) => void) {
  Voice.onSpeechResults = e => {
    const text = e.value?.[0] ?? '';
    if (text) { onResult(text); }
  };
  Voice.onSpeechError = e => onError(e);
}

export async function startListening() {
  await Voice.start('en-US');
}

export async function stopListening(): Promise<void> {
  await Voice.stop();
}

export function destroyVoice() {
  Voice.destroy().then(Voice.removeAllListeners);
}
