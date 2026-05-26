import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  Alert,
} from 'react-native';
import Voice from '@react-native-voice/voice';
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
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bestResultRef = useRef('');

  function setStageSync(s: ProcessingStage) {
    stageRef.current = s;
    setStage(s);
  }

  useEffect(() => {
    Voice.onSpeechResults = e => {
      const text = e.value?.[0] ?? '';
      if (text) {
        bestResultRef.current = text;
        if (stageRef.current === 'recording') {
          setCurrentTranscription(text);
        }
      }
    };
    Voice.onSpeechError = () => {};

    Tts.getInitStatus()
      .then(() => {
        Tts.setDucking(true);
        Tts.setIgnoreSilentSwitch('ignore');
      })
      .catch((e: any) => {
        if (e?.code === 'no_engine') { Tts.requestInstallEngine(); }
      });
    Tts.addEventListener('tts-finish', () => {
      clearTimeout(ttsTimeoutRef.current);
      setStageSync('idle');
    });
    Tts.addEventListener('tts-cancel', () => {
      clearTimeout(ttsTimeoutRef.current);
      setStageSync('idle');
    });
    return () => {
      Voice.destroy().catch(() => {});
      clearTimeout(ttsTimeoutRef.current);
      clearTimeout(flushTimeoutRef.current);
      Tts.removeAllListeners('tts-finish');
      Tts.removeAllListeners('tts-cancel');
    };
  }, []);

  const processText = useCallback(async (text: string) => {
    if (!text.trim()) { setStageSync('idle'); return; }
    setCurrentTranscription(text);
    setStageSync('thinking');
    try {
      const reply = await chat(text);
      setTurns(prev => [...prev, {
        id: `${Date.now()}`,
        timestamp: Date.now(),
        userInput: text,
        transcription: text,
        response: reply,
      } as ConversationTurn]);
      setCurrentTranscription('');
      setStageSync('speaking');
      Tts.speak(reply);
      const ms = Math.max(4000, reply.split(' ').length * 400);
      ttsTimeoutRef.current = setTimeout(() => {
        if (stageRef.current === 'speaking') { setStageSync('idle'); }
      }, ms);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
      setStageSync('idle');
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (stageRef.current !== 'idle') { return; }
    try {
      await Voice.destroy();
      bestResultRef.current = '';
      setStageSync('recording');
      await Voice.start('en-US');
    } catch (err) {
      Alert.alert('Microphone Error', err instanceof Error ? err.message : String(err));
      setStageSync('idle');
    }
  }, []);

  const stopRecordingAndProcess = useCallback(async () => {
    if (stageRef.current !== 'recording') { return; }
    setStageSync('transcribing');

    try { await Voice.stop(); } catch (_) {}

    flushTimeoutRef.current = setTimeout(() => {
      const text = bestResultRef.current;
      bestResultRef.current = '';
      Voice.destroy().catch(() => {});
      processText(text);
    }, 800);
  }, [processText]);

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
