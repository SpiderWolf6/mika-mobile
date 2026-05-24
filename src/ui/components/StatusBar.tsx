import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {IntentType} from '../../types';

interface MikaStatusBarProps {
  intent: IntentType | null;
  connectorStatus: string | null;
}

const INTENT_LABELS: Record<IntentType, string> = {
  calendar: 'Calendar',
  search: 'Web Search',
  gmail: 'Gmail',
  discord: 'Discord',
  wiki_query: 'Wiki Query',
  wiki_write: 'Saving to Wiki',
  unknown: 'Unknown',
};

const ACTIONABLE_INTENTS: IntentType[] = ['calendar', 'reminder', 'alarm', 'search', 'gmail', 'discord'];

export function MikaStatusBar({intent, connectorStatus}: MikaStatusBarProps) {
  const showPill = intent && ACTIONABLE_INTENTS.includes(intent);
  if (!showPill && !connectorStatus) {
    return null;
  }

  return (
    <View style={styles.container}>
      {showPill && (
        <View style={styles.pill}>
          <Text style={styles.pillText}>{INTENT_LABELS[intent!]}</Text>
        </View>
      )}
      {connectorStatus && (
        <Text style={styles.status}>{connectorStatus}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  pill: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  status: {
    color: '#888',
    fontSize: 13,
  },
});
