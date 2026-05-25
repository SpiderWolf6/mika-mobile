import * as chrono from 'chrono-node';

/**
 * Resolves a natural language date/time expression to a local ISO string.
 * Uses chrono-node for all parsing — no SLM involved.
 *
 * Returns:
 *   resolved: local ISO string e.g. "2026-05-29T15:00:00", or null if unparseable
 *   confident: false if expression is ambiguous (e.g. "4" with no AM/PM)
 *   display: human-readable string for the UI
 */
export function resolveDateTime(
  expression: string,
  refDate: Date = new Date(),
): {resolved: string | null; confident: boolean; display: string} {
  // chrono.parse returns an array of results with start/end and certainty
  const results = chrono.parse(expression, refDate, {forwardDate: false});

  if (results.length === 0) {
    return {resolved: null, confident: false, display: 'Could not parse'};
  }

  const result = results[0];
  const date = result.start.date();

  // Check if AM/PM was implied (not explicit) — chrono marks this as not certain
  const hourCertain = result.start.isCertain('hour');
  const meridemCertain = result.start.isCertain('meridiem');
  const confident = hourCertain && meridemCertain;

  const iso = localISOString(date);
  const display = date.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  return {resolved: iso, confident, display};
}

// Returns ISO string in local time without UTC offset: "2026-05-25T14:27:00"
export function localISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
