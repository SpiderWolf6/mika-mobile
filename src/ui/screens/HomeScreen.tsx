import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  Alert,
} from 'react-native';
import Tts from 'react-native-tts';

import {RecordButton} from '../components/RecordButton';
import {TranscriptionDisplay} from '../components/TranscriptionDisplay';

import {initVoice, startListening, stopListening, destroyVoice} from '../../slm/whisperEngine';
import {chat} from '../../slm/slmEngine';
import {ConversationTurn, ProcessingStage} from '../../types';

export function HomeScreen() {
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);

  const ttsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const transcribeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const speak = useCallback((text: string) => {
    setStage('speaking');
    Tts.speak(text);
    const ms = Math.max(4000, text.split(' ').length * 400);
    ttsTimeoutRef.current = setTimeout(
      () => setStage(s => (s === 'speaking' ? 'idle' : s)),
      ms,
    );
  }, []);

  const handleTranscript = useCallback(async (transcription: string) => {
    clearTimeout(transcribeTimeoutRef.current);
    if (!transcription?.trim()) { setStage('idle'); return; }
    setCurrentTranscription(transcription);
    setStage('thinking');
    try {
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
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
      setStage('idle');
    }
  }, [speak]);

  useEffect(() => {
    initVoice(
      text => {
        setStage('thinking');
        handleTranscript(text);
      },
      err => {
        console.warn('Voice error:', err);
        setStage('idle');
      },
    );

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
    })();

    return () => {
      destroyVoice();
      clearTimeout(transcribeTimeoutRef.current);
      Tts.removeAllListeners('tts-finish');
      Tts.removeAllListeners('tts-cancel');
    };
  }, [handleTranscript]);

  const startRecording = useCallback(async () => {
    try {
      setCurrentTranscription('');
      setStage('recording');
      await startListening();
    } catch (err) {
      Alert.alert('Microphone Error', err instanceof Error ? err.message : String(err));
      setStage('idle');
    }
  }, []);

  const stopRecordingAndProcess = useCallback(async () => {
    if (stage !== 'recording') { return; }
    try {
      setStage('transcribing');
      await stopListening();
      // If no speech result arrives within 3s, bail out
      transcribeTimeoutRef.current = setTimeout(() => setStage('idle'), 3000);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
      setStage('idle');
    }
  }, [stage]);

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
