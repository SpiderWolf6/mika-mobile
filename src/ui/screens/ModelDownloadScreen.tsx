import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {QWEN_MODEL_PATH} from '../../config';

const MODELS_READY_KEY = '@mika_models_ready';

const DOWNLOADS = [
  {
    label: 'Qwen 2.5 1.5B (language model, ~900 MB)',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    dest: QWEN_MODEL_PATH,
  },
];

export async function areModelsReady(): Promise<boolean> {
  const flag = await AsyncStorage.getItem(MODELS_READY_KEY);
  if (flag !== 'true') {
    return false;
  }
  const exists = await Promise.all(DOWNLOADS.map(d => RNFS.exists(d.dest)));
  return exists.every(Boolean);
}

interface Props {
  onReady: () => void;
}

export function ModelDownloadScreen({onReady}: Props) {
  const [currentLabel, setCurrentLabel] = useState('');
  const [progress, setProgress] = useState(0);
  const [modelIndex, setModelIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    downloadAll();
  }, []);

  async function downloadAll() {
    for (let i = 0; i < DOWNLOADS.length; i++) {
      const {label, url, dest} = DOWNLOADS[i];
      setModelIndex(i);
      setCurrentLabel(label);
      setProgress(0);

      const exists = await RNFS.exists(dest);
      if (exists) {
        continue;
      }

      try {
        await RNFS.downloadFile({
          fromUrl: url,
          toFile: dest,
          progress: ({bytesWritten, contentLength}) => {
            if (contentLength > 0) {
              setProgress(Math.round((bytesWritten / contentLength) * 100));
            }
          },
          progressDivider: 1,
        }).promise;
      } catch (err) {
        setError(`Failed to download ${label}: ${String(err)}`);
        return;
      }
    }

    await AsyncStorage.setItem(MODELS_READY_KEY, 'true');
    onReady();
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>MIKA</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.hint}>Check your internet connection and restart the app.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>MIKA</Text>
      <Text style={styles.subtitle}>Setting up on-device AI</Text>
      <Text style={styles.hint}>This only happens once. Keep the app open.</Text>

      <View style={styles.card}>
        <Text style={styles.modelLabel}>
          Downloading {modelIndex + 1}/{DOWNLOADS.length}
        </Text>
        <Text style={styles.modelName}>{currentLabel}</Text>

        <View style={styles.barTrack}>
          <View style={[styles.barFill, {width: `${progress}%`}]} />
        </View>
        <Text style={styles.percent}>{progress}%</Text>

        {progress === 0 && <ActivityIndicator color="#4A90E2" style={styles.spinner} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 6,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#2A2A2E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modelLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modelName: {
    fontSize: 15,
    color: '#ddd',
    marginBottom: 20,
    textAlign: 'center',
  },
  barTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#444',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#4A90E2',
    borderRadius: 4,
  },
  percent: {
    fontSize: 13,
    color: '#888',
  },
  spinner: {
    marginTop: 16,
  },
  errorText: {
    color: '#E24A4A',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
});
