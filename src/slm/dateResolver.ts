import {getSharedCtx} from './slmEngine';

/**
 * Takes a natural language date/time expression and the current ISO timestamp,
 * returns a resolved ISO 8601 string.
 *
 * Examples:
 *   "7 hours from now"          → "2026-05-26T05:30:00"
 *   "next friday at 3pm"        → "2026-05-29T15:00:00"
 *   "second tuesday of next month" → "2026-06-09T00:00:00"
 *   "tomorrow morning"          → "2026-05-26T09:00:00"
 */
export async function resolveDateTime(
  expression: string,
  nowISO: string,
): Promise<{resolved: string | null; reasoning: string; confident: boolean}> {
  const now = new Date(nowISO);
  const dow = now.toLocaleDateString('en-US', {weekday: 'long'});
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  const prompt =
    `Current date and time: ${dateStr}, ${timeStr} (ISO: ${nowISO}, day of week: ${dow})\n` +
    `\n` +
    `Resolve this date/time expression to an exact ISO 8601 datetime: "${expression}"\n` +
    `\n` +
    `Think step by step, then output a JSON object on the last line.\n` +
    `Rules:\n` +
    `- "next [weekday]" means the coming occurrence of that day (not today even if today matches)\n` +
    `- "this [weekday]" means the occurrence within the current week\n` +
    `- "morning" = 09:00, "noon" = 12:00, "afternoon" = 14:00, "evening" = 18:00, "night" = 20:00, "midnight" = 00:00\n` +
    `- If AM/PM is ambiguous (e.g. just "4"), set confident to false\n` +
    `- For "second tuesday of next month": find next month, find all tuesdays, pick the second one\n` +
    `- Always output the full ISO string: YYYY-MM-DDTHH:MM:SS\n` +
    `\n` +
    `Example reasoning and output:\n` +
    `Expression: "next friday at 3pm", today is Monday 2026-05-25\n` +
    `Step 1: today is Monday May 25. Next friday is May 29.\n` +
    `Step 2: 3pm = 15:00.\n` +
    `Step 3: result is 2026-05-29T15:00:00.\n` +
    `{"iso":"2026-05-29T15:00:00","confident":true}\n` +
    `\n` +
    `Expression: "second tuesday of next month", today is Monday 2026-05-25\n` +
    `Step 1: next month is June 2026.\n` +
    `Step 2: June 1 is a Monday. First tuesday is June 2. Second tuesday is June 9.\n` +
    `Step 3: no time specified, use 00:00.\n` +
    `{"iso":"2026-06-09T00:00:00","confident":true}\n` +
    `\n` +
    `Expression: "7 hours from now", now is 2026-05-25T22:30:00\n` +
    `Step 1: 22:30 + 7 hours = 05:30 next day.\n` +
    `Step 2: next day is May 26.\n` +
    `{"iso":"2026-05-26T05:30:00","confident":true}\n` +
    `\n` +
    `Now resolve: "${expression}"\n`;

  const llm = await getSharedCtx();
  const result = await llm.completion(
    {prompt, stop: ['\n\n\n'], temperature: 0.1, n_predict: 200},
    () => {},
  );

  const raw = result.text.trim();

  // Extract the last JSON object in the output (after chain-of-thought)
  const matches = [...raw.matchAll(/\{[^{}]*"iso"[^{}]*\}/g)];
  if (matches.length === 0) {
    return {resolved: null, reasoning: raw, confident: false};
  }

  try {
    const parsed = JSON.parse(matches[matches.length - 1][0]);
    const iso = parsed.iso ?? null;
    const confident = parsed.confident !== false;
    // Sanity check: must be a valid date
    if (iso && !isNaN(new Date(iso).getTime())) {
      return {resolved: iso, reasoning: raw, confident};
    }
    return {resolved: null, reasoning: raw, confident: false};
  } catch {
    return {resolved: null, reasoning: raw, confident: false};
  }
}
