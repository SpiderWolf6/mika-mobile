import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Dimensions,
} from 'react-native';
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';

import {MikaOrb} from '../components/MikaOrb';
import {FloatingText} from '../components/FloatingText';
import {VoiceSettings} from '../components/VoiceSettings';

import {chat} from '../../slm/slmEngine';
import {ProcessingStage} from '../../types';

const {height} = Dimensions.get('window');

export function HomeScreen() {
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [liveText, setLiveText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [suckedIn, setSuckedIn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
        if (stageRef.current === 'recording') { setLiveText(text); }
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
    if (!text.trim()) { setStageSync('idle'); setLiveText(''); return; }

    // Suck the text into the orb
    setSuckedIn(true);
    setTimeout(() => { setLiveText(''); setSuckedIn(false); }, 700);

    setStageSync('thinking');
    try {
      const reply = await chat(text);
      setReplyText(reply);
      setStageSync('speaking');
      Tts.speak(reply);
      const ms = Math.max(4000, reply.split(' ').length * 400);
      ttsTimeoutRef.current = setTimeout(() => {
        if (stageRef.current === 'speaking') {
          setStageSync('idle');
          setTimeout(() => setReplyText(''), 800);
        }
      }, ms);
    } catch {
      setStageSync('idle');
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (stageRef.current !== 'idle') { return; }
    try {
      await Voice.destroy();
      bestResultRef.current = '';
      setLiveText('');
      setReplyText('');
      setStageSync('recording');
      await Voice.start('en-US');
    } catch {
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

  const stageLabel =
    stage === 'recording'    ? 'Listening' :
    stage === 'transcribing' ? 'Processing' :
    stage === 'thinking'     ? 'Thinking' :
    stage === 'speaking'     ? 'Speaking' : '';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>MIKA</Text>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
          <Text style={styles.settingsIcon}>◈</Text>
        </TouchableOpacity>
      </View>

      {/* Orb area */}
      <View style={styles.orbArea}>
        <MikaOrb stage={stage} />

        {/* Live transcription drifts up from orb */}
        <View style={styles.floatAbove} pointerEvents="none">
          <FloatingText
            text={liveText}
            visible={!!liveText && (stage === 'recording' || stage === 'transcribing')}
            suckedIn={suckedIn}
          />
        </View>

        {/* Reply text appears below orb */}
        <View style={styles.floatBelow} pointerEvents="none">
          <FloatingText
            text={replyText}
            visible={!!replyText && stage === 'speaking'}
          />
        </View>
      </View>

      {/* Stage label */}
      <View style={styles.labelRow}>
        <Text style={styles.stageLabel}>{stageLabel}</Text>
      </View>

      {/* Hold-to-speak button */}
      <View style={styles.buttonArea}>
        <Pressable
          onPressIn={startRecording}
          onPressOut={stopRecordingAndProcess}
          style={({pressed}) => [
            styles.holdButton,
            pressed && styles.holdButtonActive,
            stage === 'recording' && styles.holdButtonRecording,
            ['transcribing','thinking','speaking'].includes(stage) && styles.holdButtonDisabled,
          ]}
          disabled={['transcribing','thinking','speaking'].includes(stage)}>
          <Text style={styles.holdButtonText}>
            {stage === 'recording' ? 'Release' : 'Hold to speak'}
          </Text>
        </Pressable>
      </View>

      <VoiceSettings visible={showSettings} onClose={() => setShowSettings(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080f',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 10,
    textTransform: 'uppercase',
  },
  settingsBtn: {
    position: 'absolute',
    right: 24,
    padding: 4,
  },
  settingsIcon: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.25)',
  },
  orbArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatAbove: {
    position: 'absolute',
    top: -60,
    alignItems: 'center',
    width: '100%',
  },
  floatBelow: {
    position: 'absolute',
    bottom: -80,
    alignItems: 'center',
    width: '100%',
  },
  labelRow: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stageLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  buttonArea: {
    paddingBottom: 48,
    paddingTop: 8,
    alignItems: 'center',
  },
  holdButton: {
    paddingHorizontal: 48,
    paddingVertical: 18,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.4)',
    backgroundColor: 'rgba(99,102,241,0.08)',
  },
  holdButtonActive: {
    backgroundColor: 'rgba(99,102,241,0.18)',
    borderColor: 'rgba(99,102,241,0.7)',
  },
  holdButtonRecording: {
    borderColor: 'rgba(255,77,143,0.7)',
    backgroundColor: 'rgba(255,77,143,0.12)',
  },
  holdButtonDisabled: {
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'transparent',
  },
  holdButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
