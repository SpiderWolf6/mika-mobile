import React, {useEffect, useState} from 'react';
import {StatusBar, View, StyleSheet} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import notifee, {AuthorizationStatus} from '@notifee/react-native';
import {HomeScreen} from './src/ui/screens/HomeScreen';
import {ModelDownloadScreen, areModelsReady} from './src/ui/screens/ModelDownloadScreen';

type AppState = 'checking' | 'downloading' | 'ready';

async function requestNotifeePermissions() {
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
    console.warn('Notification permission denied — alarms will not fire');
  }
  // Register iOS alarm category with Snooze + Dismiss actions
  await notifee.setNotificationCategories([
    {
      id: 'alarm',
      actions: [
        {id: 'snooze', title: 'Snooze 5 min'},
        {id: 'dismiss', title: 'Dismiss', destructive: true},
      ],
    },
  ]);
}

function App() {
  const [appState, setAppState] = useState<AppState>('checking');

  useEffect(() => {
    requestNotifeePermissions();
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
