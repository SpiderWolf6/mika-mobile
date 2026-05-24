import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {ConversationTurn, ProcessingStage} from '../../types';

interface TranscriptionDisplayProps {
  stage: ProcessingStage;
  currentTranscription: string;
  turns: ConversationTurn[];
}

export function TranscriptionDisplay({
  stage,
  currentTranscription,
  turns,
}: TranscriptionDisplayProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({animated: true});
  }, [turns, stage, currentTranscription]);

  function stageLabel() {
    switch (stage) {
      case 'recording':    return 'Listening...';
      case 'transcribing': return 'Transcribing...';
      case 'thinking':     return 'MIKA is thinking...';
      case 'speaking':     return 'MIKA is speaking...';
      default:             return null;
    }
  }

  const label = stageLabel();

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}>

      {turns.map(turn => (
        <View key={turn.id} style={styles.turnContainer}>
          <View style={styles.userBubble}>
            <Text style={styles.bubbleLabel}>You</Text>
            <Text style={styles.userText}>{turn.transcription}</Text>
          </View>
          <View style={styles.mikaBubble}>
            <Text style={styles.bubbleLabel}>MIKA</Text>
            <Text style={styles.mikaText}>{turn.response}</Text>
          </View>
        </View>
      ))}

      {/* Live transcription — shown immediately after recording stops */}
      {currentTranscription && stage !== 'idle' ? (
        <View style={styles.userBubble}>
          <Text style={styles.bubbleLabel}>You</Text>
          <Text style={styles.userText}>{currentTranscription}</Text>
        </View>
      ) : null}

      {/* Stage indicator */}
      {label ? (
        <View style={styles.stagePill}>
          <Text style={styles.stageText}>{label}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  turnContainer: {
    marginBottom: 20,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4A90E2',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: 12,
    maxWidth: '80%',
    marginBottom: 8,
  },
  mikaBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#2A2A2E',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: '80%',
  },
  bubbleLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
    fontWeight: '600',
  },
  userText: {
    color: '#fff',
    fontSize: 15,
  },
  mikaText: {
    color: '#E0E0E0',
    fontSize: 15,
  },
  stagePill: {
    alignSelf: 'center',
    backgroundColor: '#2A2A2E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  stageText: {
    color: '#888',
    fontSize: 13,
  },
});
