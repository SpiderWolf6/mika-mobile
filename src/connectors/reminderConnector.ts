import RNCalendarEvents from 'react-native-calendar-events';
import {ConnectorResult, Intent} from '../types';

// Reminders are accessed via react-native-calendar-events with entityType 'reminder'

async function ensurePermission(): Promise<boolean> {
  const status = await RNCalendarEvents.requestPermissions(true);
  return status === 'authorized';
}

export async function handleReminderIntent(intent: Intent): Promise<ConnectorResult> {
  if (!(await ensurePermission())) {
    return {success: false, error: 'Reminders permission denied'};
  }

  switch (intent.payload.action) {
    case 'create': return createReminder(intent);
    case 'edit':   return editReminder(intent);
    case 'delete': return deleteReminder(intent);
    case 'list':   return listReminders(intent);
    default:
      return {success: false, error: `Unknown reminder action: ${intent.payload.action}`};
  }
}

async function createReminder(intent: Intent): Promise<ConnectorResult> {
  try {
    const {title, dueDate, notes} = intent.payload;
    const id = await RNCalendarEvents.saveReminder(title ?? 'Reminder', {
      dueDateComponents: dueDate ? parseDateComponents(dueDate) : undefined,
      notes: notes ?? '',
      alarms: dueDate ? [{date: 0}] : [],
    });
    return {success: true, data: {id, title, dueDate}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function editReminder(intent: Intent): Promise<ConnectorResult> {
  try {
    let {reminderId, title, dueDate, notes} = intent.payload;
    if (!reminderId) {
      const found = await findReminderByTitle(title ?? '');
      if (!found) {
        return {success: false, error: `Could not find reminder "${title}" to edit`};
      }
      reminderId = found.id;
    }
    await RNCalendarEvents.saveReminder(title ?? '', {
      id: reminderId,
      dueDateComponents: dueDate ? parseDateComponents(dueDate) : undefined,
      notes: notes ?? '',
    });
    return {success: true, data: {reminderId}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function deleteReminder(intent: Intent): Promise<ConnectorResult> {
  try {
    let id = intent.payload.reminderId;
    if (!id) {
      const found = await findReminderByTitle(intent.payload.title ?? '');
      if (!found) {
        return {success: false, error: `Could not find reminder "${intent.payload.title}" to delete`};
      }
      id = found.id;
    }
    await RNCalendarEvents.removeEvent(id, {futureEvents: false});
    return {success: true, data: {id}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function listReminders(intent: Intent): Promise<ConnectorResult> {
  try {
    const start = intent.payload.startDate ?? new Date().toISOString();
    const end   = intent.payload.endDate   ?? new Date(Date.now() + 7 * 24 * 3600000).toISOString();
    const reminders = await RNCalendarEvents.fetchAllEvents(start, end, {
      entityTypes: [RNCalendarEvents.EntityTypes.REMINDER],
    });
    return {success: true, data: {reminders}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function findReminderByTitle(title: string) {
  const start = new Date().toISOString();
  const end   = new Date(Date.now() + 30 * 24 * 3600000).toISOString();
  const items = await RNCalendarEvents.fetchAllEvents(start, end, {
    entityTypes: [RNCalendarEvents.EntityTypes.REMINDER],
  });
  return items.find(r => r.title.toLowerCase().includes(title.toLowerCase())) ?? null;
}

function parseDateComponents(iso: string) {
  const d = new Date(iso);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}
