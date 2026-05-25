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
import RNFS from 'react-native-fs';
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
  const recorderReadyRef = useRef<boolean>(false);

  useEffect(() => {
    (async () => {
      await ensureWikiDir();
      const history = await loadHistory();
      setTurns(history);

      // Init TTS
      try {
        await Tts.getInitStatus();
        Tts.setDucking(true);
        Tts.addEventListener('tts-finish', () => setStage('idle'));
        Tts.addEventListener('tts-cancel', () => setStage('idle'));
      } catch (e: any) {
        if (e?.code === 'no_engine') {
          await Tts.requestInstallEngine();
        }
        console.warn('TTS init failed:', e);
      }

      // Init alarm foreground listeners
      initAlarmListeners();

      // On Android, explicitly request mic permission
      // On iOS, the system dialog fires automatically on first AudioRecord.init()
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

      // Init recorder once — on iOS this triggers the mic permission dialog
      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        wavFile: 'mika_recording.wav',
      });
      recorderReadyRef.current = true;
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
        'MIKA needs microphone access to hear your voice commands. Please enable it in Settings.',
      );
      return;
    }
    if (!recorderReadyRef.current) {
      Alert.alert('Not ready', 'Recorder is still initializing, try again.');
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
    if (stage !== 'recording') {
      return;
    }

    try {
      // Step 1 — stop recording and wait for WAV to be fully flushed
      recorderReadyRef.current = false;
      await AudioRecord.stop();

      // Poll until file has real data (WAV header alone is 44 bytes)
      const wavPath = `${RNFS.CachesDirectoryPath}/mika_recording.wav`;
      for (let i = 0; i < 20; i++) {
        const info = await RNFS.stat(wavPath).catch(() => null);
        if (info && info.size > 1000) { break; }
        await new Promise(r => setTimeout(r, 150));
      }

      // Reinit ready for next recording
      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        wavFile: 'mika_recording.wav',
      });
      recorderReadyRef.current = true;

      // Step 2 — transcribe
      setStage('transcribing');
      const transcription = await transcribeAudio(wavPath);
      setCurrentTranscription(transcription);

      if (!transcription) {
        setStage('idle');
        return;
      }

      // Step 3 — SLM classify + act
      setStage('thinking');
      const intent = await classifyIntent(transcription);
      setActiveIntent(intent.type);

      let connectorSummary = 'No action taken';
      const actionable = !['unknown', 'wiki_query', 'wiki_write'].includes(intent.type);
      if (actionable) {
        const result = await routeIntent(intent);
        connectorSummary = result.success
          ? `${intent.type}: success`
          : `${intent.type} failed: ${result.error}`;
        setConnectorStatus(connectorSummary);
      }

      const response = await generateResponse(transcription, connectorSummary);

      // Step 4 — speak response
      // On iOS, deactivate the record audio session so TTS can take over
      setStage('speaking');
      try {
        await new Promise(resolve => setTimeout(resolve, 800));
        Tts.stop();
        Tts.speak(response);
      } catch (e) {
        console.warn('TTS speak failed:', e);
        setStage('idle');
      }

      // Step 5 — persist turn and update UI
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
      // stage goes back to 'idle' via the tts-finish listener
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err, null, 2);
      Alert.alert('Error', msg);
      setStage('idle');
      if (!recorderReadyRef.current) {
        AudioRecord.init({
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
          wavFile: 'mika_recording.wav',
        });
        recorderReadyRef.current = true;
      }
    }
  }, [stage]);

  const isRecording = stage === 'recording';
  const isProcessing = ['transcribing', 'thinking', 'speaking'].includes(stage);

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
          isRecording={isRecording}
          isProcessing={isProcessing}
          onPressIn={startRecording}
          onPressOut={stopRecordingAndProcess}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1E',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 6,
    marginTop: 12,
    marginBottom: 8,
  },
  recordRow: {
    paddingBottom: 40,
    paddingTop: 16,
    alignItems: 'center',
  },
});
