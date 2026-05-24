import {Intent, ConnectorResult} from '../types';
import {handleCalendarIntent} from './calendarConnector';
import {handleReminderIntent} from './reminderConnector';
import {handleAlarmIntent} from './alarmConnector';
import {handleSearchIntent} from './searchConnector';
import {handleGmailIntent} from './gmailConnector';
import {handleDiscordIntent} from './discordConnector';

export async function routeIntent(intent: Intent): Promise<ConnectorResult> {
  switch (intent.type) {
    case 'calendar': return handleCalendarIntent(intent);
    case 'reminder': return handleReminderIntent(intent);
    case 'alarm':    return handleAlarmIntent(intent);
    case 'search':   return handleSearchIntent(intent);
    case 'gmail':    return handleGmailIntent(intent);
    case 'discord':  return handleDiscordIntent(intent);
    default:
      return {success: false, error: `No connector for intent: ${intent.type}`};
  }
}
