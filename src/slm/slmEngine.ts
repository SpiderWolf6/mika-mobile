import {LlamaContext, initLlama, releaseAllLlama} from 'llama.rn';
import {Intent, GatekeeperOutcome} from '../types';
import {PHI3_MODEL_PATH} from '../config';

let llamaCtx: LlamaContext | null = null;

export async function getSharedCtx(): Promise<LlamaContext> {
  if (llamaCtx) { return llamaCtx; }
  llamaCtx = await initLlama({
    model: PHI3_MODEL_PATH,
    use_mlock: false,
    use_mmap: true,
    n_ctx: 1024,
    n_threads: 4,
    n_gpu_layers: 99,
  });
  return llamaCtx;
}

export async function releaseSLM(): Promise<void> {
  await releaseAllLlama();
  llamaCtx = null;
}

async function complete(prompt: string, maxTokens: number, stop: string[]): Promise<string> {
  const ctx = await getSharedCtx();
  const result = await ctx.completion(
    {prompt, stop, temperature: 0.1, n_predict: maxTokens},
    () => {},
  );
  return result.text.trim();
}

// ─── Agent 1: Gatekeeper ─────────────────────────────────────────────────────

export async function runGatekeeper(
  userInput: string,
  collectedInfo: string | null,
  now: string,
): Promise<GatekeeperOutcome> {
  const context = collectedInfo
    ? `Previously collected: ${collectedInfo}\nNew input: ${userInput}`
    : `User: ${userInput}`;

  const prompt =
    `You are MIKA's router. Now: ${now}\n` +
    `MIKA supports: alarm (create/cancel), reminder (create/delete), calendar event (create/edit/delete).\n` +
    `MIKA cannot: search web, send messages, answer general knowledge, do math, give advice.\n` +
    `\n` +
    `Output ONE JSON. Examples:\n` +
    `User: "wake me up at 7am tomorrow" → {"status":"ready","connector":"alarm","summary":"create alarm at 7:00 AM tomorrow"}\n` +
    `User: "set an alarm for 4" → {"status":"need_clarification","connector":"alarm","question":"4 AM or 4 PM?","partialInfo":"alarm at 4, day not specified"}\n` +
    `User: "cancel my morning alarm" → {"status":"ready","connector":"alarm","summary":"cancel alarm labeled morning"}\n` +
    `User: "remind me to call mom on Friday at 3pm" → {"status":"ready","connector":"reminder","summary":"create reminder: call mom, due Friday 3:00 PM"}\n` +
    `User: "delete my call mom reminder" → {"status":"ready","connector":"reminder","summary":"delete reminder titled call mom"}\n` +
    `User: "add team meeting to my calendar Wednesday at 10pm" → {"status":"ready","connector":"calendar","summary":"create calendar event: team meeting, Wednesday 10:00 PM, end 11:00 PM"}\n` +
    `User: "move my team meeting to Thursday at 2pm" → {"status":"ready","connector":"calendar","summary":"edit calendar event: team meeting, new time Thursday 2:00 PM"}\n` +
    `User: "delete my dentist appointment" → {"status":"ready","connector":"calendar","summary":"delete calendar event: dentist appointment"}\n` +
    `User: "add meeting for next wednesday" → {"status":"need_clarification","connector":"calendar","question":"What time is the meeting?","partialInfo":"calendar event: meeting, next Wednesday, time unknown"}\n` +
    `User: "what is the capital of France" → {"status":"cannot_answer"}\n` +
    `User: "send John a message" → {"status":"cannot_do"}\n` +
    `\n` +
    `Required fields — alarm: time+AM/PM+day. reminder: title+date+time. calendar: name+date+time.\n` +
    `${context}\n` +
    `JSON:`;

  const raw = await complete(prompt, 80, ['\n\n', 'User:', 'Previously']);

  try {
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) { throw new Error('no json'); }
    const parsed = JSON.parse(match[0]);
    const status = parsed.status;
    if (status === 'cannot_do') { return {status: 'cannot_do'}; }
    if (status === 'cannot_answer') { return {status: 'cannot_answer'}; }
    if (status === 'need_clarification') {
      return {
        status: 'need_clarification',
        connector: parsed.connector ?? 'alarm',
        question: parsed.question ?? 'Can you give me more details?',
        partialInfo: parsed.partialInfo ?? userInput,
      };
    }
    if (status === 'ready') {
      return {
        status: 'ready',
        connector: parsed.connector,
        summary: parsed.summary ?? userInput,
      };
    }
    throw new Error('unknown status');
  } catch {
    return {status: 'cannot_do'};
  }
}

// ─── Agent 2: Payload Extractors ─────────────────────────────────────────────

export async function extractAlarmPayload(summary: string, now: string): Promise<Intent> {
  const prompt =
    `Now: ${now}\n` +
    `Extract alarm JSON from: "${summary}"\n` +
    `Output ONE JSON only. Compute isoTime from Now above.\n` +
    `Examples:\n` +
    `"create alarm at 7:00 AM tomorrow" → {"action":"create","label":"Wake up","isoTime":"2025-05-26T07:00:00"}\n` +
    `"create alarm Wake up Friday 6:30 AM" → {"action":"create","label":"Wake up","isoTime":"2025-05-30T06:30:00"}\n` +
    `"cancel alarm labeled morning" → {"action":"cancel","label":"morning"}\n` +
    `"cancel my 7am alarm" → {"action":"cancel","label":"7am"}\n` +
    `JSON:`;

  const raw = await complete(prompt, 60, ['\n\n']);
  try {
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) { throw new Error('no json'); }
    return {type: 'alarm', confidence: 0.95, payload: JSON.parse(match[0])};
  } catch {
    return {type: 'alarm', confidence: 0, payload: {action: 'create', label: 'Alarm', isoTime: ''}};
  }
}

export async function extractReminderPayload(summary: string, now: string): Promise<Intent> {
  const prompt =
    `Now: ${now}\n` +
    `Extract reminder JSON from: "${summary}"\n` +
    `Output ONE JSON only. Compute dueDate from Now above.\n` +
    `Examples:\n` +
    `"create reminder: call mom, due Friday 3:00 PM" → {"action":"create","title":"Call mom","dueDate":"2025-05-30T15:00:00"}\n` +
    `"create reminder: buy groceries, due tomorrow 9:00 AM" → {"action":"create","title":"Buy groceries","dueDate":"2025-05-26T09:00:00"}\n` +
    `"delete reminder titled call mom" → {"action":"delete","title":"Call mom"}\n` +
    `"delete my grocery reminder" → {"action":"delete","title":"grocery"}\n` +
    `JSON:`;

  const raw = await complete(prompt, 60, ['\n\n']);
  try {
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) { throw new Error('no json'); }
    return {type: 'reminder', confidence: 0.95, payload: JSON.parse(match[0])};
  } catch {
    return {type: 'reminder', confidence: 0, payload: {action: 'create', title: 'Reminder', dueDate: ''}};
  }
}

export async function extractCalendarPayload(summary: string, now: string): Promise<Intent> {
  const prompt =
    `Now: ${now}\n` +
    `Extract calendar event JSON from: "${summary}"\n` +
    `Output ONE JSON only. Compute startDate and endDate from Now. endDate defaults to 1 hour after startDate.\n` +
    `Examples:\n` +
    `"create calendar event: team meeting, Wednesday 10:00 PM, end 11:00 PM" → {"action":"create","title":"Team meeting","startDate":"2025-05-28T22:00:00","endDate":"2025-05-28T23:00:00","notes":""}\n` +
    `"create calendar event: dentist, Friday 2:00 PM" → {"action":"create","title":"Dentist","startDate":"2025-05-30T14:00:00","endDate":"2025-05-30T15:00:00","notes":""}\n` +
    `"edit calendar event: team meeting, new time Thursday 2:00 PM" → {"action":"edit","title":"Team meeting","startDate":"2025-05-29T14:00:00","endDate":"2025-05-29T15:00:00"}\n` +
    `"edit calendar event: dentist, rename to teeth cleaning" → {"action":"edit","title":"Dentist","newTitle":"Teeth cleaning"}\n` +
    `"delete calendar event: dentist appointment" → {"action":"delete","title":"Dentist appointment"}\n` +
    `"delete calendar event: team meeting" → {"action":"delete","title":"Team meeting"}\n` +
    `JSON:`;

  const raw = await complete(prompt, 80, ['\n\n']);
  try {
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) { throw new Error('no json'); }
    return {type: 'calendar', confidence: 0.95, payload: JSON.parse(match[0])};
  } catch {
    return {type: 'calendar', confidence: 0, payload: {action: 'create', title: 'Event', startDate: '', endDate: ''}};
  }
}
