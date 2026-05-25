import RNCalendarEvents from 'react-native-calendar-events';
import {ConnectorResult, Intent} from '../types';

async function ensurePermission(): Promise<boolean> {
  const status = await RNCalendarEvents.requestPermissions();
  return status === 'authorized';
}

export async function handleCalendarIntent(intent: Intent): Promise<ConnectorResult> {
  if (!(await ensurePermission())) {
    return {success: false, error: 'Calendar permission denied'};
  }

  switch (intent.payload.action) {
    case 'create': return createEvent(intent);
    case 'edit':   return editEvent(intent);
    case 'delete': return deleteEvent(intent);
    default:
      return {success: false, error: `Unknown calendar action: ${intent.payload.action}`};
  }
}

async function createEvent(intent: Intent): Promise<ConnectorResult> {
  try {
    const {title, startDate, endDate, notes, location} = intent.payload;
    if (!startDate) {
      return {success: false, error: 'No start date provided'};
    }
    const end = endDate ?? new Date(new Date(startDate).getTime() + 3600000).toISOString();
    const eventId = await RNCalendarEvents.saveEvent(title ?? 'New Event', {
      startDate,
      endDate: end,
      notes: notes ?? '',
      location: location ?? '',
    });
    return {success: true, data: {eventId, title, startDate, endDate: end}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function editEvent(intent: Intent): Promise<ConnectorResult> {
  try {
    const {title, newTitle, startDate, endDate, notes, location} = intent.payload;
    const found = await findEventByTitle(title ?? '');
    if (!found) {
      return {success: true, data: {notFound: true}};
    }

    await RNCalendarEvents.saveEvent(newTitle ?? found.title, {
      id: found.id,
      ...(startDate ? {startDate} : {}),
      ...(endDate   ? {endDate}   : {}),
      ...(notes     ? {notes}     : {}),
      ...(location  ? {location}  : {}),
    });
    return {success: true, data: {eventId: found.id}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function deleteEvent(intent: Intent): Promise<ConnectorResult> {
  try {
    const found = await findEventByTitle(intent.payload.title ?? '');
    if (!found) {
      // Not an error — event just doesn't exist
      return {success: true, data: {notFound: true}};
    }
    await RNCalendarEvents.removeEvent(found.id);
    return {success: true, data: {eventId: found.id}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function findEventByTitle(title: string) {
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 60 * 24 * 3600000).toISOString();
  const events = await RNCalendarEvents.fetchAllEvents(start, end);
  return events.find(e => e.title.toLowerCase().includes(title.toLowerCase())) ?? null;
}
