import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  Alert,
} from 'react-native';
import Voice, {SpeechResultsEvent, SpeechErrorEvent} from '@react-native-voice/voice';
import Tts from 'react-native-tts';

import {RecordButton} from '../components/RecordButton';
import {TranscriptionDisplay} from '../components/TranscriptionDisplay';

import {chat} from '../../slm/slmEngine';
import {ConversationTurn, ProcessingStage} from '../../types';

export function HomeScreen() {
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);

  const stageRef = useRef<ProcessingStage>('idle');
  const ttsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const transcribeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const processingRef = useRef(false);

  const setStageSync = (s: ProcessingStage) => {
    stageRef.current = s;
    setStage(s);
  };

  const speak = useCallback((text: string) => {
    setStageSync('speaking');
    Tts.speak(text);
    const ms = Math.max(4000, text.split(' ').length * 400);
    ttsTimeoutRef.current = setTimeout(() => {
      if (stageRef.current === 'speaking') { setStageSync('idle'); }
    }, ms);
  }, []);

  useEffect(() => {
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      clearTimeout(transcribeTimeoutRef.current);
      if (processingRef.current) { return; }
      const text = e.value?.[0]?.trim() ?? '';
      if (!text) { setStageSync('idle'); return; }

      processingRef.current = true;
      setCurrentTranscription(text);
      setStageSync('thinking');

      chat(text)
        .then(reply => {
          const turn: ConversationTurn = {
            id: `${Date.now()}`,
            timestamp: Date.now(),
            userInput: text,
            transcription: text,
            response: reply,
          };
          setTurns(prev => [...prev, turn]);
          setCurrentTranscription('');
          speak(reply);
        })
        .catch(err => {
          Alert.alert('Error', err instanceof Error ? err.message : String(err));
          setStageSync('idle');
        })
        .finally(() => {
          processingRef.current = false;
        });
    };

    Voice.onSpeechError = (_e: SpeechErrorEvent) => {
      clearTimeout(transcribeTimeoutRef.current);
      if (!processingRef.current) { setStageSync('idle'); }
    };

    (async () => {
      try {
        await Tts.getInitStatus();
        Tts.setDucking(true);
        Tts.setIgnoreSilentSwitch('ignore');
        Tts.addEventListener('tts-finish', () => {
          clearTimeout(ttsTimeoutRef.current);
          setStageSync('idle');
        });
        Tts.addEventListener('tts-cancel', () => {
          clearTimeout(ttsTimeoutRef.current);
          setStageSync('idle');
        });
      } catch (e: any) {
        if (e?.code === 'no_engine') { await Tts.requestInstallEngine(); }
      }
    })();

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      clearTimeout(ttsTimeoutRef.current);
      clearTimeout(transcribeTimeoutRef.current);
      Tts.removeAllListeners('tts-finish');
      Tts.removeAllListeners('tts-cancel');
    };
  }, [speak]);

  const startRecording = useCallback(async () => {
    if (stageRef.current !== 'idle') { return; }
    try {
      processingRef.current = false;
      setCurrentTranscription('');
      setStageSync('recording');
      await Voice.start('en-US');
    } catch (err) {
      Alert.alert('Microphone Error', err instanceof Error ? err.message : String(err));
      setStageSync('idle');
    }
  }, []);

  const stopRecordingAndProcess = useCallback(async () => {
    if (stageRef.current !== 'recording') { return; }
    try {
      setStageSync('transcribing');
      await Voice.stop();
      transcribeTimeoutRef.current = setTimeout(() => {
        if (stageRef.current === 'transcribing') { setStageSync('idle'); }
      }, 3000);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
      setStageSync('idle');
    }
  }, []);

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
