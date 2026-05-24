import notifee, {
  AndroidImportance,
  AndroidCategory,
  TriggerType,
  TimestampTrigger,
  RepeatFrequency,
  EventType,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ConnectorResult, Intent, AlarmRecord} from '../types';

const ALARMS_KEY = '@mika_alarms';

// Call once at app start to wire up the foreground alarm handler
export function initAlarmListeners() {
  notifee.onForegroundEvent(({type, detail}) => {
    if (
      type === EventType.ACTION_PRESS &&
      detail.pressAction?.id === 'snooze'
    ) {
      snoozeAlarm(detail.notification?.id ?? '');
    }
    if (
      (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'dismiss') ||
      type === EventType.DISMISSED
    ) {
      dismissAlarm(detail.notification?.id ?? '');
    }
  });
}

export async function handleAlarmIntent(intent: Intent): Promise<ConnectorResult> {
  switch (intent.payload.action) {
    case 'create': return createAlarm(intent);
    case 'delete':
    case 'cancel': return cancelAlarm(intent);
    case 'list':   return listAlarms();
    case 'snooze': return snoozeAlarmByLabel(intent.payload.label ?? '');
    default:
      return {success: false, error: `Unknown alarm action: ${intent.payload.action}`};
  }
}

async function createAlarm(intent: Intent): Promise<ConnectorResult> {
  try {
    const {label, isoTime} = intent.payload;
    if (!isoTime) {
      return {success: false, error: 'No time specified for alarm'};
    }

    const fireDate = new Date(isoTime);
    if (fireDate.getTime() <= Date.now()) {
      return {success: false, error: 'Alarm time is in the past'};
    }

    const channelId = await notifee.createChannel({
      id: 'mika_alarms',
      name: 'MIKA Alarms',
      importance: AndroidImportance.HIGH,
      sound: 'alarm',
      vibration: true,
      vibrationPattern: [0, 500, 500, 500],
    });

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: fireDate.getTime(),
      alarmManager: {allowWhileIdle: true},
    };

    const notifeeId = await notifee.createTriggerNotification(
      {
        id: undefined,
        title: '⏰ MIKA Alarm',
        body: label ?? 'Alarm',
        ios: {
          sound: 'alarm.caf',
          critical: true,
          criticalVolume: 1.0,
          categoryId: 'alarm',
        },
        android: {
          channelId,
          category: AndroidCategory.ALARM,
          importance: AndroidImportance.HIGH,
          sound: 'alarm',
          fullScreenAction: {id: 'default'},
          actions: [
            {title: 'Snooze 5 min', pressAction: {id: 'snooze'}},
            {title: 'Dismiss', pressAction: {id: 'dismiss'}},
          ],
          autoCancel: false,
        },
      },
      trigger,
    );

    const record: AlarmRecord = {
      id: `alarm_${Date.now()}`,
      label: label ?? 'Alarm',
      isoTime,
      notifeeId,
      active: true,
    };
    await saveAlarmRecord(record);

    return {success: true, data: {alarmId: record.id, fireAt: fireDate.toLocaleTimeString()}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function cancelAlarm(intent: Intent): Promise<ConnectorResult> {
  try {
    const alarms = await loadAlarmRecords();
    const label = intent.payload.label ?? '';
    const match = alarms.find(
      a => a.active && a.label.toLowerCase().includes(label.toLowerCase()),
    );
    if (!match) {
      return {success: false, error: `No active alarm matching "${label}"`};
    }
    await notifee.cancelTriggerNotification(match.notifeeId);
    match.active = false;
    await saveAllAlarms(alarms);
    return {success: true, data: {cancelled: match.label}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function listAlarms(): Promise<ConnectorResult> {
  const alarms = await loadAlarmRecords();
  const active = alarms.filter(a => a.active);
  return {success: true, data: {alarms: active}};
}

export async function snoozeAlarm(notifeeId: string) {
  await notifee.cancelNotification(notifeeId);
  const snoozeTime = Date.now() + 5 * 60 * 1000;
  const alarms = await loadAlarmRecords();
  const match = alarms.find(a => a.notifeeId === notifeeId);
  if (!match) { return; }

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: snoozeTime,
    alarmManager: {allowWhileIdle: true},
  };
  const newNotifeeId = await notifee.createTriggerNotification(
    {
      title: '⏰ MIKA Alarm (snoozed)',
      body: match.label,
      ios: {sound: 'alarm.caf', critical: true, criticalVolume: 1.0, categoryId: 'alarm'},
      android: {
        channelId: 'mika_alarms',
        category: AndroidCategory.ALARM,
        importance: AndroidImportance.HIGH,
        actions: [
          {title: 'Snooze 5 min', pressAction: {id: 'snooze'}},
          {title: 'Dismiss', pressAction: {id: 'dismiss'}},
        ],
        autoCancel: false,
      },
    },
    trigger,
  );
  match.notifeeId = newNotifeeId;
  await saveAllAlarms(alarms);
}

export async function dismissAlarm(notifeeId: string) {
  await notifee.cancelNotification(notifeeId);
  const alarms = await loadAlarmRecords();
  const match = alarms.find(a => a.notifeeId === notifeeId);
  if (match) {
    match.active = false;
    await saveAllAlarms(alarms);
  }
}

async function snoozeAlarmByLabel(label: string): Promise<ConnectorResult> {
  const alarms = await loadAlarmRecords();
  const match = alarms.find(
    a => a.active && a.label.toLowerCase().includes(label.toLowerCase()),
  );
  if (!match) {
    return {success: false, error: `No active alarm matching "${label}"`};
  }
  await snoozeAlarm(match.notifeeId);
  return {success: true, data: {snoozed: match.label}};
}

async function loadAlarmRecords(): Promise<AlarmRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(ALARMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveAlarmRecord(record: AlarmRecord) {
  const alarms = await loadAlarmRecords();
  alarms.push(record);
  await saveAllAlarms(alarms);
}

async function saveAllAlarms(alarms: AlarmRecord[]) {
  await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
}
