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
    case 'list':   return listEvents(intent);
    default:
      return {success: false, error: `Unknown calendar action: ${intent.payload.action}`};
  }
}

async function createEvent(intent: Intent): Promise<ConnectorResult> {
  try {
    const {title, startDate, endDate, notes, location} = intent.payload;
    const start = startDate ?? new Date().toISOString();
    const end   = endDate   ?? new Date(Date.now() + 3600000).toISOString();

    const eventId = await RNCalendarEvents.saveEvent(title ?? 'New Event', {
      startDate: start,
      endDate: end,
      notes: notes ?? '',
      location: location ?? '',
    });
    return {success: true, data: {eventId, title, start, end}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function editEvent(intent: Intent): Promise<ConnectorResult> {
  try {
    const {eventId, title, startDate, endDate, notes, location} = intent.payload;
    if (!eventId) {
      // No ID supplied — find by title match in the next 30 days
      const found = await findEventByTitle(intent.payload.title ?? '');
      if (!found) {
        return {success: false, error: `Could not find event "${intent.payload.title}" to edit`};
      }
      intent.payload.eventId = found.id;
    }

    const updates: Record<string, string> = {};
    if (title)     { updates.title = title; }
    if (startDate) { updates.startDate = startDate; }
    if (endDate)   { updates.endDate = endDate; }
    if (notes)     { updates.notes = notes; }
    if (location)  { updates.location = location; }

    await RNCalendarEvents.saveEvent(title ?? '', {
      id: intent.payload.eventId,
      ...updates,
    });
    return {success: true, data: {eventId: intent.payload.eventId}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function deleteEvent(intent: Intent): Promise<ConnectorResult> {
  try {
    let id = intent.payload.eventId;
    if (!id) {
      const found = await findEventByTitle(intent.payload.title ?? '');
      if (!found) {
        return {success: false, error: `Could not find event "${intent.payload.title}" to delete`};
      }
      id = found.id;
    }
    await RNCalendarEvents.removeEvent(id);
    return {success: true, data: {eventId: id}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function listEvents(intent: Intent): Promise<ConnectorResult> {
  try {
    const start = intent.payload.startDate ?? new Date().toISOString();
    const end   = intent.payload.endDate   ?? new Date(Date.now() + 7 * 24 * 3600000).toISOString();
    const events = await RNCalendarEvents.fetchAllEvents(start, end);
    return {success: true, data: {events}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function findEventByTitle(title: string) {
  const start = new Date().toISOString();
  const end   = new Date(Date.now() + 30 * 24 * 3600000).toISOString();
  const events = await RNCalendarEvents.fetchAllEvents(start, end);
  return events.find(e => e.title.toLowerCase().includes(title.toLowerCase())) ?? null;
}
