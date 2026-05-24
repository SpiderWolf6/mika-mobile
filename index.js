/**
 * @format
 */

import {AppRegistry} from 'react-native';
import notifee, {EventType} from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';

// Handles alarm snooze/dismiss when app is in background or closed
notifee.onBackgroundEvent(async ({type, detail}) => {
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'snooze') {
    const {snoozeAlarm} = await import('./src/connectors/alarmConnector');
    await snoozeAlarm(detail.notification?.id ?? '');
  }
  if (
    (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'dismiss') ||
    type === EventType.DISMISSED
  ) {
    const {dismissAlarm} = await import('./src/connectors/alarmConnector');
    await dismissAlarm(detail.notification?.id ?? '');
  }
});

AppRegistry.registerComponent(appName, () => App);
