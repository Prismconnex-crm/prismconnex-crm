/**
 * Formatting and parsing helpers for Find Shows event start and end clock times.
 * 
 * Strict non-fabrication:
 * - Only verified times are formatted; missing, invalid, or date-only inputs return null.
 * - Timezone is included ONLY when reliably available (valid IANA timezone or explicit offset).
 * - Never guesses, infers, or hardcodes times.
 */

export function isValidIanaTimeZone(timeZone: string | null | undefined): boolean {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timeZone.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a string contains an actual clock time (hours and minutes).
 * Rejects date-only strings like "2027-05-15".
 */
export function containsClockTime(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  // ISO with time: e.g. T09:00, T09:00:00, or space-separated date + time
  if (/T\d{1,2}:\d{2}/i.test(trimmed) || /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(trimmed)) {
    return true;
  }
  // Standalone clock time: e.g. "09:00", "09:00:00", "9:00 AM", "6:00 PM", "18:00"
  if (/^\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?$/i.test(trimmed)) {
    return true;
  }
  if (/^\d{1,2}\s*(?:am|pm)$/i.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Extracts standard 24h { hours, minutes } and optional timezone offset or IANA zone from a string.
 */
export function parseClockTime(
  value: string | null | undefined
): { hours: number; minutes: number; offsetMinutes?: number; isIso: boolean } | null {
  if (!value || !containsClockTime(value)) return null;

  const trimmed = value.trim();

  // 1. ISO 8601 with time
  const isoMatch = trimmed.match(
    /[T\s](\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:(Z)|([+-]\d{2}):?(\d{2})?)?/i
  );
  if (isoMatch) {
    const hours = Number(isoMatch[1]);
    const minutes = Number(isoMatch[2]);
    let offsetMinutes: number | undefined;

    if (isoMatch[3]?.toUpperCase() === 'Z') {
      offsetMinutes = 0;
    } else if (isoMatch[4]) {
      const sign = isoMatch[4].startsWith('-') ? -1 : 1;
      const hOffset = Math.abs(Number(isoMatch[4]));
      const mOffset = Number(isoMatch[5] ?? '0');
      offsetMinutes = sign * (hOffset * 60 + mOffset);
    }

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes, offsetMinutes, isIso: true };
    }
  }

  // 2. 12-hour format: "09:30 AM", "9:30 PM", "9 AM"
  const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = Number(ampmMatch[2] ?? '0');
    const meridian = ampmMatch[3].toUpperCase();

    if (hours >= 1 && hours <= 12 && minutes >= 0 && minutes <= 59) {
      if (meridian === 'AM' && hours === 12) hours = 0;
      if (meridian === 'PM' && hours < 12) hours += 12;
      return { hours, minutes, isIso: false };
    }
  }

  // 3. 24-hour format: "09:30", "18:00"
  const simpleMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (simpleMatch) {
    const hours = Number(simpleMatch[1]);
    const minutes = Number(simpleMatch[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes, isIso: false };
    }
  }

  return null;
}

/**
 * Formats hours (0-23) and minutes into standard display string (e.g. "09:00 AM", "06:00 PM").
 */
function format12Hour(hours: number, minutes: number): string {
  const meridian = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const padHours = String(displayHours).padStart(2, '0');
  const padMinutes = String(minutes).padStart(2, '0');
  return `${padHours}:${padMinutes} ${meridian}`;
}

/**
 * Formats a verified event clock time with optional verified timezone.
 * Returns null if input does not contain a verified clock time.
 */
export function formatEventClockTime(
  time: string | null | undefined,
  timeZone?: string | null | undefined
): string | null {
  if (!time) return null;

  const parsed = parseClockTime(time);
  if (!parsed) return null;

  const trimmedZone = timeZone?.trim() || null;
  const hasValidIana = isValidIanaTimeZone(trimmedZone);
  const baseTime = format12Hour(parsed.hours, parsed.minutes);

  // If input is an ISO string and a valid IANA timezone is provided, format using Intl
  if (parsed.isIso && hasValidIana) {
    try {
      const date = new Date(time.trim());
      if (!isNaN(date.getTime())) {
        const dtf = new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: trimmedZone!,
          timeZoneName: 'short',
        });
        return dtf.format(date);
      }
    } catch {
      // Fallback to parsed hours/minutes
    }
  }

  // If a timezone abbreviation was provided (e.g. "CET", "EST", "BST"), append it directly
  const isAbbreviation = trimmedZone ? /^[A-Z]{2,5}$/.test(trimmedZone) : false;
  if (isAbbreviation && !parsed.isIso) {
    return `${baseTime} ${trimmedZone}`;
  }

  // If valid IANA timezone provided but not ISO (just clock time), append zone label
  if (hasValidIana && !isAbbreviation) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: trimmedZone!,
        timeZoneName: 'short',
      }).formatToParts(new Date());
      const zoneName = parts.find((p) => p.type === 'timeZoneName')?.value;
      if (zoneName) {
        return `${baseTime} ${zoneName}`;
      }
    } catch {
      // Ignore
    }
  }

  // If ISO string had an explicit offset (e.g. +02:00 or Z) and no IANA timezone
  if (parsed.offsetMinutes !== undefined && !hasValidIana) {
    if (parsed.offsetMinutes === 0) {
      return `${baseTime} UTC`;
    }
    const sign = parsed.offsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(parsed.offsetMinutes);
    const h = Math.floor(absOffset / 60);
    const m = absOffset % 60;
    const offsetStr = m > 0 ? `${sign}${h}:${String(m).padStart(2, '0')}` : `${sign}${h}`;
    return `${baseTime} (UTC${offsetStr})`;
  }

  // Pure clock time without timezone: display clean 12h format
  return baseTime;
}
