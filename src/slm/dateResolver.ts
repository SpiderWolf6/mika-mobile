import {getSharedCtx} from './slmEngine';

/**
 * Resolves a natural language date/time expression to an ISO 8601 string
 * in the device's local timezone.
 *
 * Pass nowISO as a local-timezone ISO string (not UTC) so the model
 * reasons in the user's local time throughout.
 */
export async function resolveDateTime(
  expression: string,
  nowISO: string,
): Promise<{resolved: string | null; reasoning: string; confident: boolean}> {
  const now = new Date(nowISO);

  // Format current date/time in plain English for the model
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  // Local ISO without timezone suffix so model doesn't confuse UTC offsets
  const localISO = localISOString(now);

  const prompt =
    `Current local date and time: ${dateStr} at ${timeStr}\n` +
    `Current ISO (local): ${localISO}\n` +
    `\n` +
    `Resolve this expression to an exact ISO 8601 local datetime: "${expression}"\n` +
    `\n` +
    `Rules:\n` +
    `- Reason step by step. Output JSON on the final line only.\n` +
    `- "next [weekday]" = the coming occurrence, never today\n` +
    `- "this [weekday]" = within the current week\n` +
    `- morning=09:00 noon=12:00 afternoon=14:00 evening=18:00 night=20:00 midnight=00:00\n` +
    `- If AM/PM is ambiguous set confident:false\n` +
    `- If expression is unclear or impossible set iso:null\n` +
    `- Output format: {"iso":"YYYY-MM-DDTHH:MM:SS","confident":true}\n` +
    `\n` +
    `Examples:\n` +
    `Q: "next friday at 3pm" | Today: Monday 2026-05-25T10:00:00\n` +
    `Step 1: Today is Monday May 25. Count forward: Tue 26, Wed 27, Thu 28, Fri 29.\n` +
    `Step 2: 3pm = 15:00.\n` +
    `{"iso":"2026-05-29T15:00:00","confident":true}\n` +
    `\n` +
    `Q: "second tuesday of next month" | Today: Monday 2026-05-25T10:00:00\n` +
    `Step 1: Next month = June 2026. June 1 = Monday.\n` +
    `Step 2: First Tuesday = June 2. Second Tuesday = June 9.\n` +
    `Step 3: No time given, use 00:00.\n` +
    `{"iso":"2026-06-09T00:00:00","confident":true}\n` +
    `\n` +
    `Q: "7 hours from now" | Today: Monday 2026-05-25T22:30:00\n` +
    `Step 1: 22:30 + 7h = 29:30 = 05:30 next day.\n` +
    `Step 2: Next day = May 26.\n` +
    `{"iso":"2026-05-26T05:30:00","confident":true}\n` +
    `\n` +
    `Q: "set alarm for 4" | Today: Monday 2026-05-25T10:00:00\n` +
    `Step 1: "4" with no AM/PM is ambiguous.\n` +
    `{"iso":null,"confident":false}\n` +
    `\n` +
    `Q: "${expression}" | Today: ${dateStr.split(',')[0]} ${localISO}\n` +
    `Step 1:`;

  const llm = await getSharedCtx();
  const result = await llm.completion(
    {prompt, stop: [], temperature: 0.1, n_predict: 300},
    () => {},
  );

  const raw = result.text.trim();

  // Find the last JSON object with an "iso" key
  const matches = [...raw.matchAll(/\{[^{}]*"iso"[^{}]*\}/g)];
  if (matches.length === 0) {
    return {resolved: null, reasoning: raw, confident: false};
  }

  try {
    const parsed = JSON.parse(matches[matches.length - 1][0]);
    const iso: string | null = parsed.iso ?? null;
    const confident: boolean = parsed.confident !== false;
    if (iso && !isNaN(new Date(iso).getTime())) {
      return {resolved: iso, reasoning: raw, confident};
    }
    return {resolved: null, reasoning: raw, confident: false};
  } catch {
    return {resolved: null, reasoning: raw, confident: false};
  }
}

// Returns ISO string in local time without UTC offset, e.g. "2026-05-25T22:30:00"
export function localISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
