import React, {useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {resolveDateTime, localISOString} from '../../slm/dateResolver';

export function DateResolverTestScreen() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{resolved: string | null; reasoning: string; confident: boolean} | null>(null);

  async function run() {
    if (!query.trim()) { return; }
    setLoading(true);
    setResult(null);
    try {
      const nowISO = localISOString(new Date());
      const out = await resolveDateTime(query.trim(), nowISO);
      setResult(out);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Date Resolver Test</Text>
      <Text style={s.sub}>Now (local): {localISOString(new Date())}</Text>

      <TextInput
        style={s.input}
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. second tuesday of next month"
        placeholderTextColor="#666"
        onSubmitEditing={run}
      />
      <TouchableOpacity style={s.btn} onPress={run} disabled={loading}>
        <Text style={s.btnText}>{loading ? 'Resolving...' : 'Resolve'}</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator color="#fff" style={{marginTop: 20}} />}

      {result && (
        <ScrollView style={s.resultBox}>
          <Text style={[s.label, {color: result.confident ? '#4CAF50' : '#FF9800'}]}>
            {result.confident ? 'Confident' : 'Not confident (ambiguous)'}
          </Text>
          <Text style={s.resolved}>
            {result.resolved ?? 'Could not resolve'}
          </Text>
          {result.resolved && (
            <Text style={s.human}>
              → {new Date(result.resolved).toLocaleString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long',
                day: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </Text>
          )}
          <Text style={s.reasoningLabel}>Reasoning:</Text>
          <Text style={s.reasoning}>{result.reasoning}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#1A1A1E', padding: 20},
  title: {fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4},
  sub: {fontSize: 11, color: '#666', marginBottom: 20},
  input: {
    backgroundColor: '#2A2A2E', color: '#fff', borderRadius: 10,
    padding: 14, fontSize: 16, marginBottom: 12,
  },
  btn: {
    backgroundColor: '#4A90E2', borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  btnText: {color: '#fff', fontWeight: '600', fontSize: 16},
  resultBox: {marginTop: 20, flex: 1},
  label: {fontSize: 13, fontWeight: '600', marginBottom: 4},
  resolved: {fontSize: 20, color: '#fff', fontWeight: '700', marginBottom: 4},
  human: {fontSize: 14, color: '#aaa', marginBottom: 16},
  reasoningLabel: {fontSize: 12, color: '#666', marginBottom: 4},
  reasoning: {fontSize: 12, color: '#888', lineHeight: 18},
});
