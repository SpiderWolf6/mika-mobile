import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  Alert,
  Platform,
} from 'react-native';
import AudioRecord from 'react-native-audio-record';
import Tts from 'react-native-tts';

import {RecordButton} from '../components/RecordButton';
import {TranscriptionDisplay} from '../components/TranscriptionDisplay';

import {transcribeAudio} from '../../slm/whisperEngine';
import {chat} from '../../slm/slmEngine';
import {ConversationTurn, ProcessingStage} from '../../types';


export function HomeScreen() {
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);

  const micPermissionRef = useRef<boolean>(false);
  const ttsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const speak = useCallback((text: string) => {
    setStage('speaking');
    Tts.speak(text);
    const ms = Math.max(4000, text.split(' ').length * 400);
    ttsTimeoutRef.current = setTimeout(
      () => setStage(s => (s === 'speaking' ? 'idle' : s)),
      ms,
    );
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Tts.getInitStatus();
        Tts.setDucking(true);
        Tts.setIgnoreSilentSwitch('ignore');
        Tts.addEventListener('tts-finish', () => {
          clearTimeout(ttsTimeoutRef.current);
          setStage('idle');
        });
        Tts.addEventListener('tts-cancel', () => {
          clearTimeout(ttsTimeoutRef.current);
          setStage('idle');
        });
      } catch (e: any) {
        if (e?.code === 'no_engine') { await Tts.requestInstallEngine(); }
        console.warn('TTS init failed:', e);
      }

      if (Platform.OS === 'android') {
        const {PermissionsAndroid} = require('react-native');
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Access',
            message: 'MIKA needs microphone access to hear your voice commands.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        micPermissionRef.current = result === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        micPermissionRef.current = true;
      }

      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        wavFile: 'mika_recording.wav',
      });
    })();

    return () => {
      Tts.removeAllListeners('tts-finish');
      Tts.removeAllListeners('tts-cancel');
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!micPermissionRef.current) {
      Alert.alert(
        'Microphone Access Required',
        'MIKA needs microphone access. Please enable it in Settings.',
      );
      return;
    }
    try {
      AudioRecord.start();
      setStage('recording');
      setCurrentTranscription('');
    } catch (err) {
      Alert.alert('Recording Error', err instanceof Error ? err.message : JSON.stringify(err));
    }
  }, []);

  const stopRecordingAndProcess = useCallback(async () => {
    if (stage !== 'recording') { return; }

    try {
      const audioPath = await AudioRecord.stop();
      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        wavFile: 'mika_recording.wav',
      });

      setStage('transcribing');
      const transcription = await transcribeAudio(audioPath);
      setCurrentTranscription(transcription);
      if (!transcription) { setStage('idle'); return; }

      setStage('thinking');
      const reply = await chat(transcription);

      const turn: ConversationTurn = {
        id: `${Date.now()}`,
        timestamp: Date.now(),
        userInput: transcription,
        transcription,
        response: reply,
      };
      setTurns(prev => [...prev, turn]);
      setCurrentTranscription('');
      speak(reply);

    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err, null, 2);
      Alert.alert('Error', msg);
      setStage('idle');
      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        wavFile: 'mika_recording.wav',
      });
    }
  }, [stage, speak]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>MIKA</Text>
      <TranscriptionDisplay
        stage={stage}
        currentTranscription={currentTranscription}
        turns={turns}
      />
      <View style={styles.recordRow}>
        <RecordButton
          isRecording={stage === 'recording'}
          isProcessing={['transcribing', 'thinking', 'speaking'].includes(stage)}
          onPressIn={startRecording}
          onPressOut={stopRecordingAndProcess}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#1A1A1E', alignItems: 'center'},
  title: {fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: 6, marginTop: 12, marginBottom: 8},
  recordRow: {paddingBottom: 40, paddingTop: 16, alignItems: 'center'},
});
