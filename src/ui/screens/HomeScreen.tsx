import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AudioRecord from 'react-native-audio-record';
import RNFS from 'react-native-fs';

import {RecordButton} from '../components/RecordButton';
import {TranscriptionDisplay} from '../components/TranscriptionDisplay';
import {MikaStatusBar} from '../components/StatusBar';

import {transcribeAudio, initWhisperEngine} from '../../slm/whisperEngine';
import {classifyIntent, generateResponse, extractWikiFacts} from '../../slm/slmEngine';
import {routeIntent} from '../../connectors';
import {getRelevantWikiContext, appendWikiFile, ensureWikiDir} from '../../wiki/wikiManager';
import {loadHistory, appendTurn} from '../../utils/conversationStore';

import {ConversationTurn, IntentType} from '../../types';

export function HomeScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [activeIntent, setActiveIntent] = useState<IntentType | null>(null);
  const [connectorStatus, setConnectorStatus] = useState<string | null>(null);

  const audioPathRef = useRef<string>('');
  const micPermissionRef = useRef<boolean>(false);

  useEffect(() => {
    (async () => {
      await ensureWikiDir();
      await initWhisperEngine();
      const history = await loadHistory();
      setTurns(history);
      if (Platform.OS === 'android') {
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
    })();
  }, []);

  const startRecording = useCallback(async () => {
    if (!micPermissionRef.current) {
      Alert.alert(
        'Microphone Access Required',
        'MIKA needs microphone access to hear your voice commands. Please enable it in Settings.',
      );
      return;
    }
    try {
      const wavFile = 'mika_recording.wav';
      audioPathRef.current = `${RNFS.CachesDirectoryPath}/${wavFile}`;
      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        wavFile,
      });
      AudioRecord.start();
      setIsRecording(true);
      setCurrentTranscription('');
      setActiveIntent(null);
      setConnectorStatus(null);
    } catch (err) {
      Alert.alert('Recording Error', String(err));
    }
  }, []);

  const stopRecordingAndProcess = useCallback(async () => {
    if (!isRecording) {
      return;
    }
    setIsRecording(false);
    setIsProcessing(true);

    try {
      const audioPath = await AudioRecord.stop();
      audioPathRef.current = audioPath;

      // 1. Transcribe
      const transcription = await transcribeAudio(audioPath);
      setCurrentTranscription(transcription);

      if (!transcription) {
        setIsProcessing(false);
        return;
      }

      // 2. Load wiki context and history
      const history = await loadHistory();
      const wikiSnippets = await getRelevantWikiContext(transcription);
      const slmContext = {wikiSnippets, recentTurns: history};

      // 3. Classify intent
      const intent = await classifyIntent(transcription, slmContext);
      setActiveIntent(intent.type);

      // 4. Route to connector (if applicable)
      let connectorSummary = 'No action taken';
      if (intent.type !== 'unknown' && intent.type !== 'wiki_query') {
        const result = await routeIntent(intent);
        connectorSummary = result.success
          ? `${intent.type}: success`
          : `${intent.type}: ${result.error}`;
        setConnectorStatus(connectorSummary);
      }

      // 5. Generate response
      const response = await generateResponse(transcription, connectorSummary, slmContext);

      // 6. Save facts to wiki
      const facts = await extractWikiFacts(transcription, response);
      if (facts) {
        const today = new Date().toISOString().split('T')[0];
        await appendWikiFile(
          'about-me.md',
          `\n## ${today}\n${facts}`,
        );
      }

      // 7. Persist turn
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
    } catch (err) {
      Alert.alert('Processing Error', String(err));
    } finally {
      setIsProcessing(false);
    }
  }, [isRecording]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>MIKA</Text>

      <TranscriptionDisplay
        currentTranscription={currentTranscription}
        isRecording={isRecording}
        isProcessing={isProcessing}
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
