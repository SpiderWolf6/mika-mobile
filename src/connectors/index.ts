import {Intent, ConnectorResult} from '../types';
import {handleCalendarIntent} from './calendarConnector';
import {handleReminderIntent} from './reminderConnector';
import {handleAlarmIntent} from './alarmConnector';

export async function routeIntent(intent: Intent): Promise<ConnectorResult> {
  switch (intent.type) {
    case 'calendar': return handleCalendarIntent(intent);
    case 'reminder': return handleReminderIntent(intent);
    case 'alarm':    return handleAlarmIntent(intent);
    default:
      return {success: false, error: `No connector for intent: ${intent.type}`};
  }
}
