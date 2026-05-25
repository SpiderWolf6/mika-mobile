import React, {useCallback, useEffect, useRef, useState} from 'react';
import {SafeAreaView, StyleSheet, View, Text, Alert, Platform} from 'react-native';
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

const WAV_FILE = 'mika_recording.wav';

function initRecorder() {
  AudioRecord.init({
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    wavFile: WAV_FILE,
  });
}

export function HomeScreen() {
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [activeIntent, setActiveIntent] = useState<IntentType | null>(null);
  const [connectorStatus, setConnectorStatus] = useState<string | null>(null);

  const micGranted = useRef(false);

  useEffect(() => {
    (async () => {
      await ensureWikiDir();
      const history = await loadHistory();
      setTurns(history);
      initAlarmListeners();

      // TTS init
      try {
        await Tts.getInitStatus();
        Tts.setDucking(true);
      } catch (e: any) {
        if (e?.code === 'no_engine') { await Tts.requestInstallEngine(); }
      }
      Tts.addEventListener('tts-finish', () => setStage('idle'));
      Tts.addEventListener('tts-cancel', () => setStage('idle'));

      // Android mic permission
      if (Platform.OS === 'android') {
        const {PermissionsAndroid} = require('react-native');
        const r = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {title: 'Microphone', message: 'MIKA needs mic access.', buttonPositive: 'Allow', buttonNegative: 'Deny'},
        );
        micGranted.current = r === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        micGranted.current = true;
      }

      // Init recorder — iOS mic dialog fires here on first launch
      initRecorder();
    })();

    return () => {
      Tts.removeAllListeners('tts-finish');
      Tts.removeAllListeners('tts-cancel');
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!micGranted.current) {
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

  const stopAndProcess = useCallback(async () => {
    if (stage !== 'recording') { return; }

    try {
      // Stop and wait for WAV to flush to disk
      await AudioRecord.stop();
      const wavPath = `${RNFS.CachesDirectoryPath}/${WAV_FILE}`;
      for (let i = 0; i < 15; i++) {
        const info = await RNFS.stat(wavPath).catch(() => null);
        if (info && info.size > 1000) { break; }
        await new Promise(r => setTimeout(r, 100));
      }

      // Reinit ready for next press
      initRecorder();

      // Transcribe
      setStage('transcribing');
      const transcription = await transcribeAudio(wavPath);
      setCurrentTranscription(transcription);
      if (!transcription) { setStage('idle'); return; }

      // Classify + act
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

      // Generate response
      const response = await generateResponse(transcription, connectorSummary);

      // Persist turn
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

      // Speak — stage goes idle via tts-finish listener
      setStage('speaking');
      Tts.speak(response);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
      setStage('idle');
      initRecorder();
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
          onPressOut={stopAndProcess}
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
