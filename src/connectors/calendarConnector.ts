import RNCalendarEvents from 'react-native-calendar-events';
import {ConnectorResult, Intent} from '../types';

export async function requestCalendarPermissions(): Promise<boolean> {
  const status = await RNCalendarEvents.requestPermissions();
  return status === 'authorized';
}

export async function handleCalendarIntent(intent: Intent): Promise<ConnectorResult> {
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) {
    return {success: false, error: 'Calendar permission denied'};
  }

  const action = intent.payload.action;

  if (action === 'create') {
    return createEvent(intent);
  } else if (action === 'list') {
    return listEvents(intent);
  }

  return {success: false, error: `Unknown calendar action: ${action}`};
}

async function createEvent(intent: Intent): Promise<ConnectorResult> {
  try {
    const {title, startDate, endDate, notes} = intent.payload;
    const start = startDate ?? new Date().toISOString();
    const end = endDate ?? new Date(Date.now() + 3600000).toISOString();

    const eventId = await RNCalendarEvents.saveEvent(title ?? 'New Event', {
      startDate: start,
      endDate: end,
      notes: notes ?? '',
    });

    return {success: true, data: {eventId}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function listEvents(intent: Intent): Promise<ConnectorResult> {
  try {
    const startDate = intent.payload.startDate ?? new Date().toISOString();
    const endDate =
      intent.payload.endDate ??
      new Date(Date.now() + 7 * 24 * 3600000).toISOString();

    const events = await RNCalendarEvents.fetchAllEvents(startDate, endDate);
    return {success: true, data: {events}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}
