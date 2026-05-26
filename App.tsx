import React, {useEffect, useState} from 'react';
import {StatusBar, View, StyleSheet} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {HomeScreen} from './src/ui/screens/HomeScreen';
import {ModelDownloadScreen, areModelsReady} from './src/ui/screens/ModelDownloadScreen';

type AppState = 'checking' | 'downloading' | 'ready';

function App() {
  const [appState, setAppState] = useState<AppState>('checking');

  useEffect(() => {
    areModelsReady().then(ready => {
      setAppState(ready ? 'ready' : 'downloading');
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1E" />
      {appState === 'checking' && <View style={styles.blank} />}
      {appState === 'downloading' && (
        <ModelDownloadScreen onReady={() => setAppState('ready')} />
      )}
      {appState === 'ready' && <HomeScreen />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  blank: {flex: 1, backgroundColor: '#1A1A1E'},
});

export default App;
