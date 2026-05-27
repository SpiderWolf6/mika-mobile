import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Animated,
} from 'react-native';
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';

import {MikaOrb} from '../components/MikaOrb';
import {VoiceSettings} from '../components/VoiceSettings';

import {chat} from '../../slm/slmEngine';
import {ProcessingStage} from '../../types';

export function HomeScreen() {
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [liveText, setLiveText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const stageRef = useRef<ProcessingStage>('idle');
  const ttsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bestResultRef = useRef('');

  // Text animation values
  const liveOpacity  = useRef(new Animated.Value(0)).current;
  const liveY        = useRef(new Animated.Value(0)).current;
  const liveScale    = useRef(new Animated.Value(1)).current;
  const replyOpacity = useRef(new Animated.Value(0)).current;
  const replyY       = useRef(new Animated.Value(20)).current;

  function setStageSync(s: ProcessingStage) {
    stageRef.current = s;
    setStage(s);
  }

  // Show live text floating up toward orb
  function showLive(text: string) {
    setLiveText(text);
    liveY.setValue(0);
    liveScale.setValue(1);
    Animated.timing(liveOpacity, {toValue: 1, duration: 150, useNativeDriver: true}).start();
  }

  // Suck live text into orb — shrink + float up + fade
  function suckIn() {
    Animated.parallel([
      Animated.timing(liveOpacity, {toValue: 0, duration: 500, useNativeDriver: true}),
      Animated.timing(liveY,       {toValue: -40, duration: 500, useNativeDriver: true}),
      Animated.timing(liveScale,   {toValue: 0.4, duration: 500, useNativeDriver: true}),
    ]).start(() => { setLiveText(''); liveY.setValue(0); liveScale.setValue(1); });
  }

  // Emit reply text from orb downward
  function showReply(text: string) {
    setReplyText(text);
    replyY.setValue(-20);
    replyOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(replyOpacity, {toValue: 1,  duration: 350, useNativeDriver: true}),
      Animated.timing(replyY,       {toValue: 0,  duration: 350, useNativeDriver: true}),
    ]).start();
  }

  function hideReply() {
    Animated.parallel([
      Animated.timing(replyOpacity, {toValue: 0,  duration: 400, useNativeDriver: true}),
      Animated.timing(replyY,       {toValue: 20, duration: 400, useNativeDriver: true}),
    ]).start(() => setReplyText(''));
  }

  useEffect(() => {
    Voice.onSpeechResults = e => {
      const text = e.value?.[0] ?? '';
      if (text) {
        bestResultRef.current = text;
        if (stageRef.current === 'recording') { showLive(text); }
      }
    };
    Voice.onSpeechError = () => {};

    Tts.getInitStatus()
      .then(() => { Tts.setDucking(true); Tts.setIgnoreSilentSwitch('ignore'); })
      .catch((e: any) => { if (e?.code === 'no_engine') { Tts.requestInstallEngine(); } });

    Tts.addEventListener('tts-finish', () => { clearTimeout(ttsTimeoutRef.current); setStageSync('idle'); hideReply(); });
    Tts.addEventListener('tts-cancel', () => { clearTimeout(ttsTimeoutRef.current); setStageSync('idle'); hideReply(); });

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
    suckIn();
    setStageSync('thinking');
    try {
      const reply = await chat(text);
      showReply(reply);
      setStageSync('speaking');
      Tts.speak(reply);
      const ms = Math.max(4000, reply.split(' ').length * 400);
      ttsTimeoutRef.current = setTimeout(() => {
        if (stageRef.current === 'speaking') { setStageSync('idle'); hideReply(); }
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
      hideReply();
      setStageSync('recording');
      await Voice.start('en-US');
    } catch { setStageSync('idle'); }
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

  const isActive = ['transcribing','thinking','speaking'].includes(stage);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>MIKA</Text>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
          <Text style={styles.settingsIcon}>◈</Text>
        </TouchableOpacity>
      </View>

      {/* Orb — takes upper portion */}
      <View style={styles.orbArea}>
        <MikaOrb stage={stage} />
      </View>

      {/* Text zone — between orb and button */}
      <View style={styles.textZone}>
        {/* Live input text — floats up into orb */}
        {liveText ? (
          <Animated.Text style={[styles.liveText, {opacity: liveOpacity, transform:[{translateY: liveY},{scale: liveScale}]}]} numberOfLines={3}>
            {liveText}
          </Animated.Text>
        ) : replyText ? (
          <Animated.Text style={[styles.replyText, {opacity: replyOpacity, transform:[{translateY: replyY}]}]} numberOfLines={5}>
            {replyText}
          </Animated.Text>
        ) : (
          <Text style={styles.stageLabel}>{stageLabel}</Text>
        )}
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
            isActive && styles.holdButtonDisabled,
          ]}
          disabled={isActive}>
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
  container: {flex: 1, backgroundColor: '#08080f', alignItems: 'center'},
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
    fontSize: 15,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 12,
    textTransform: 'uppercase',
  },
  settingsBtn: {position: 'absolute', right: 24, padding: 8},
  settingsIcon: {fontSize: 26, color: 'rgba(255,255,255,0.3)'},
  orbArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textZone: {
    height: 120,
    width: '85%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  liveText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 16,
    fontWeight: '300',
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 24,
  },
  replyText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 17,
    fontWeight: '300',
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 26,
  },
  stageLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.18)',
    letterSpacing: 5,
    textTransform: 'uppercase',
  },
  buttonArea: {paddingBottom: 44, paddingTop: 8, alignItems: 'center'},
  holdButton: {
    paddingHorizontal: 60,
    paddingVertical: 22,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(79,142,247,0.35)',
    backgroundColor: 'rgba(79,142,247,0.07)',
  },
  holdButtonActive: {
    backgroundColor: 'rgba(79,142,247,0.18)',
    borderColor: 'rgba(79,142,247,0.7)',
  },
  holdButtonRecording: {
    borderColor: 'rgba(255,61,127,0.7)',
    backgroundColor: 'rgba(255,61,127,0.1)',
  },
  holdButtonDisabled: {
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'transparent',
  },
  holdButtonText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});
