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
import {classifyIntent, generateResponse} from '../../slm/slmEngine';
import {routeIntent} from '../../connectors';
import {initAlarmListeners} from '../../connectors/alarmConnector';
import {ensureWikiDir} from '../../wiki/wikiManager';
import {loadHistory, appendTurn} from '../../utils/conversationStore';

import {ConversationTurn, IntentType, ProcessingStage} from '../../types';

export function HomeScreen() {
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [activeIntent, setActiveIntent] = useState<IntentType | null>(null);
  const [connectorStatus, setConnectorStatus] = useState<string | null>(null);

  const micPermissionRef = useRef<boolean>(false);

  useEffect(() => {
    (async () => {
      await ensureWikiDir();
      const history = await loadHistory();
      setTurns(history);

      try {
        await Tts.getInitStatus();
        Tts.setDucking(true);
      } catch (e: any) {
        if (e?.code !== 'no_engine') { throw e; }
        await Tts.requestInstallEngine();
      }
      Tts.addEventListener('tts-finish', () => setStage('idle'));
      Tts.addEventListener('tts-cancel', () => setStage('idle'));

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
      Alert.alert('Microphone Required', 'Enable microphone access in Settings.');
      return;
    }
    try {
      AudioRecord.start();
      setStage('recording');
      setCurrentTranscription('');
      setActiveIntent(null);
      setConnectorStatus(null);
    } catch (err) {
      Alert.alert('Recording Error', err instanceof Error ? err.message : String(err));
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
      const intent = await classifyIntent(transcription);
      setActiveIntent(intent.type);

      let connectorSummary = 'No action taken';
      if (!['unknown', 'wiki_query', 'wiki_write'].includes(intent.type)) {
        const result = await routeIntent(intent);
        connectorSummary = result.success
          ? `${intent.type}: success`
          : `${intent.type} failed: ${result.error}`;
        setConnectorStatus(connectorSummary);
      }

      const response = await generateResponse(transcription, connectorSummary);

      const turn: ConversationTurn = {
        id: `${Date.now()}`,
        timestamp: Date.now(),
        userInput: transcription,
        transcription,
        intent,
        response,
      };
      await appendTurn(turn);
      setTurns(prev => [...prev, turn]);
      setCurrentTranscription('');

      setStage('speaking');
      Tts.speak(response);
      // stage returns to idle via tts-finish listener
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
      setStage('idle');
      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        wavFile: 'mika_recording.wav',
      });
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
