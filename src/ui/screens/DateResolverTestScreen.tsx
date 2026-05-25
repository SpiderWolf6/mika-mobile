import React, {useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {resolveDateTime, localISOString} from '../../slm/dateResolver';

interface Result {
  expression: string;
  resolved: string | null;
  confident: boolean;
  display: string;
}

export function DateResolverTestScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);

  function run() {
    if (!query.trim()) { return; }
    const out = resolveDateTime(query.trim(), new Date());
    setResults(prev => [{expression: query.trim(), ...out}, ...prev]);
    setQuery('');
  }

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Date Resolver</Text>
      <Text style={s.sub}>Now (local): {localISOString(new Date())}</Text>

      <TextInput
        style={s.input}
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. second tuesday of next month"
        placeholderTextColor="#555"
        onSubmitEditing={run}
        returnKeyType="go"
      />
      <TouchableOpacity style={s.btn} onPress={run}>
        <Text style={s.btnText}>Resolve</Text>
      </TouchableOpacity>

      <ScrollView style={s.list}>
        {results.map((r, i) => (
          <Result key={i} r={r} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Result({r}: {r: Result}) {
  const ok = r.resolved !== null;
  return (
    <SafeAreaView style={rs.card}>
      <Text style={rs.expr}>"{r.expression}"</Text>
      <Text style={[rs.status, {color: !ok ? '#f44' : r.confident ? '#4c4' : '#fa0'}]}>
        {!ok ? 'Could not resolve' : r.confident ? 'Confident' : 'Ambiguous (assumed)'}
      </Text>
      {r.resolved && <Text style={rs.iso}>{r.resolved}</Text>}
      {r.resolved && <Text style={rs.human}>{r.display}</Text>}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#1A1A1E', padding: 20},
  title: {fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4},
  sub: {fontSize: 11, color: '#555', marginBottom: 20},
  input: {
    backgroundColor: '#2A2A2E', color: '#fff', borderRadius: 10,
    padding: 14, fontSize: 16, marginBottom: 10,
  },
  btn: {backgroundColor: '#4A90E2', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 20},
  btnText: {color: '#fff', fontWeight: '600', fontSize: 16},
  list: {flex: 1},
});

const rs = StyleSheet.create({
  card: {backgroundColor: '#2A2A2E', borderRadius: 10, padding: 14, marginBottom: 10},
  expr: {color: '#aaa', fontSize: 13, marginBottom: 4},
  status: {fontSize: 12, fontWeight: '600', marginBottom: 6},
  iso: {color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 2},
  human: {color: '#888', fontSize: 13},
});
