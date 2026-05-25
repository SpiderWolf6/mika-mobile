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
import {MikaStatusBar} from '../components/StatusBar';

import {transcribeAudio} from '../../slm/whisperEngine';
import {
  runGatekeeper,
  extractAlarmPayload,
  extractReminderPayload,
  extractCalendarPayload,
} from '../../slm/slmEngine';
import {routeIntent} from '../../connectors';
import {initAlarmListeners} from '../../connectors/alarmConnector';

import {ClarificationState, ConversationTurn, IntentType, ProcessingStage} from '../../types';

function confirmationFor(
  connector: 'alarm' | 'reminder' | 'calendar',
  payload: Record<string, string>,
): string {
  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      });
    } catch { return iso; }
  };

  switch (connector) {
    case 'alarm':
      return `Got it. Your alarm${payload.label ? ` for ${payload.label}` : ''} is set for ${fmt(payload.isoTime)}.`;
    case 'reminder':
      return `Done. I've set a reminder for ${payload.title ?? 'that'} on ${fmt(payload.dueDate)}.`;
    case 'calendar':
      return `Done. ${payload.title ?? 'Your event'} has been added to your calendar on ${fmt(payload.startDate)}.`;
  }
}

export function HomeScreen() {
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [activeIntent, setActiveIntent] = useState<IntentType | null>(null);
  const [connectorStatus, setConnectorStatus] = useState<string | null>(null);

  const micPermissionRef = useRef<boolean>(false);
  const ttsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // In-memory only — cleared on restart, no persistence
  const clarificationRef = useRef<ClarificationState | null>(null);

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

      initAlarmListeners();

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
      setActiveIntent(null);
      setConnectorStatus(null);
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
      const now = new Date().toISOString();

      // If we're mid-clarification, append new input to what we already know
      const collectedInfo = clarificationRef.current
        ? `${clarificationRef.current.collectedInfo} | Follow-up: ${transcription}`
        : null;

      // ── Agent 1: Gatekeeper ──
      const gate = await runGatekeeper(transcription, collectedInfo, now);

      if (gate.status === 'cannot_do') {
        clarificationRef.current = null;
        const reply = 'I don\'t have the ability to do that. I can set alarms, reminders, and calendar events.';
        addTurn(transcription, {type: 'unknown', confidence: 1, payload: {}}, reply);
        speak(reply);
        return;
      }

      if (gate.status === 'cannot_answer') {
        clarificationRef.current = null;
        const reply = 'I cannot answer that. I can set alarms, reminders, and calendar events.';
        addTurn(transcription, {type: 'unknown', confidence: 1, payload: {}}, reply);
        speak(reply);
        return;
      }

      if (gate.status === 'need_clarification') {
        // Store what we know so far; next voice turn will append to it
        clarificationRef.current = {
          connector: gate.connector,
          collectedInfo: gate.partialInfo,
        };
        addTurn(transcription, {type: 'unknown', confidence: 1, payload: {}}, gate.question);
        speak(gate.question);
        return;
      }

      // gate.status === 'ready' — run Agent 2
      clarificationRef.current = null;
      const {connector, summary} = gate;
      setActiveIntent(connector);

      let intent;
      if (connector === 'alarm') {
        intent = await extractAlarmPayload(summary, now);
      } else if (connector === 'reminder') {
        intent = await extractReminderPayload(summary, now);
      } else {
        intent = await extractCalendarPayload(summary, now);
      }

      const result = await routeIntent(intent);
      setConnectorStatus(result.success ? `${connector}: done` : `${connector}: failed`);

      const response = result.success
        ? confirmationFor(connector, intent.payload)
        : `Sorry, I couldn't set that. ${result.error ?? ''}`.trim();
      addTurn(transcription, intent, response);
      speak(response);

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

  function addTurn(
    transcription: string,
    intent: ConversationTurn['intent'],
    response: string,
  ) {
    const turn: ConversationTurn = {
      id: `${Date.now()}`,
      timestamp: Date.now(),
      userInput: transcription,
      transcription,
      intent,
      response,
    };
    setTurns(prev => [...prev, turn]);
    setCurrentTranscription('');
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>MIKA</Text>
      <TranscriptionDisplay
        stage={stage}
        currentTranscription={currentTranscription}
        turns={turns}
      />
      <MikaStatusBar intent={activeIntent} connectorStatus={connectorStatus} />
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
