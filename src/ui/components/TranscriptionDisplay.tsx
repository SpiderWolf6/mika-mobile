import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {ConversationTurn} from '../../types';

interface TranscriptionDisplayProps {
  currentTranscription: string;
  isRecording: boolean;
  isProcessing: boolean;
  turns: ConversationTurn[];
}

export function TranscriptionDisplay({
  currentTranscription,
  isRecording,
  isProcessing,
  turns,
}: TranscriptionDisplayProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      {(isRecording || isProcessing || currentTranscription) ? (
        <View style={styles.liveContainer}>
          {isRecording && <Text style={styles.liveLabel}>Listening...</Text>}
          {isProcessing && <Text style={styles.liveLabel}>Processing...</Text>}
          {currentTranscription ? (
            <Text style={styles.liveText}>{currentTranscription}</Text>
          ) : null}
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
  liveContainer: {
    padding: 16,
    alignItems: 'center',
  },
  liveLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  liveText: {
    color: '#ccc',
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
