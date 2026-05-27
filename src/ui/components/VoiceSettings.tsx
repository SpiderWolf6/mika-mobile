import React, {useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ScrollView} from 'react-native';
import Tts from 'react-native-tts';

interface Voice {
  id: string;
  name: string;
  language: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function VoiceSettings({visible, onClose}: Props) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    if (!visible) { return; }
    Tts.voices().then((v: any[]) => {
      const english = v.filter(x => x.language?.startsWith('en'));
      const seen = new Set<string>();
      const deduped = english.filter(x => {
        const key = x.name;
        if (seen.has(key)) { return false; }
        seen.add(key);
        return true;
      });
      setVoices(deduped);
    });
    Tts.getInitStatus().then(() => {
      // Get current default — no direct API, just note selected
    });
  }, [visible]);

  if (!visible) { return null; }

  function select(id: string) {
    setSelected(id);
    Tts.setDefaultVoice(id);
    Tts.speak('Hi, I am MIKA.');
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <Text style={styles.title}>Voice</Text>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {voices.map(v => (
            <TouchableOpacity
              key={v.id}
              style={[styles.row, selected === v.id && styles.rowSelected]}
              onPress={() => select(v.id)}>
              <Text style={styles.voiceName}>{v.name.replace(/-[a-z]{2}-[A-Z]{2}$/, '')}</Text>
              <Text style={styles.voiceLang}>{v.language}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  panel: {
    width: '80%',
    maxHeight: '60%',
    backgroundColor: '#111118',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 16,
  },
  list: {maxHeight: 300},
  row: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowSelected: {
    backgroundColor: 'rgba(99,102,241,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.6)',
  },
  voiceName: {color: '#e0e0e0', fontSize: 14},
  voiceLang: {color: '#555', fontSize: 12},
  closeBtn: {
    marginTop: 16,
    backgroundColor: 'rgba(99,102,241,0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeText: {color: '#a5b4fc', fontWeight: '600', letterSpacing: 2},
});
