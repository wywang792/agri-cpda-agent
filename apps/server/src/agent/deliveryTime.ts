export interface NormalizedDeliveryTime {
  text: string;
  startAt?: Date;
  endAt?: Date;
}

const dayOffsets: Array<[RegExp, number]> = [
  [/今天|今日|当日/, 0],
  [/明天|明日/, 1],
  [/后天/, 2],
];

function getDayOffset(text: string): number | null {
  for (const [pattern, offset] of dayOffsets) {
    if (pattern.test(text)) {
      return offset;
    }
  }

  return null;
}

function withDateAndTime(referenceDate: Date, dayOffset: number, hour: number, minute = 0): Date {
  const value = new Date(referenceDate);
  value.setDate(value.getDate() + dayOffset);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function getWindow(text: string): { startHour: number; endHour: number } | null {
  if (/上午/.test(text)) return { startHour: 9, endHour: 12 };
  if (/中午/.test(text)) return { startHour: 11, endHour: 13 };
  if (/下午/.test(text)) return { startHour: 14, endHour: 18 };
  if (/晚上|夜间/.test(text)) return { startHour: 18, endHour: 22 };
  return null;
}

export function normalizeDeliveryTime(
  rawText: string | null | undefined,
  referenceDate = new Date(),
): NormalizedDeliveryTime | null {
  const text = rawText?.trim();
  if (!text) return null;

  const dayOffset = getDayOffset(text);
  if (dayOffset === null) {
    return { text };
  }

  const preciseTime = text.match(/(\d{1,2})(?::|：)?(\d{1,2})?\s*点?/);
  if (preciseTime) {
    const hour = Number(preciseTime[1]);
    const minute = preciseTime[2] ? Number(preciseTime[2]) : 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { text, startAt: withDateAndTime(referenceDate, dayOffset, hour, minute) };
    }
  }

  const window = getWindow(text);
  if (window) {
    return {
      text,
      startAt: withDateAndTime(referenceDate, dayOffset, window.startHour),
      endAt: withDateAndTime(referenceDate, dayOffset, window.endHour),
    };
  }

  return {
    text,
    startAt: withDateAndTime(referenceDate, dayOffset, 0),
    endAt: withDateAndTime(referenceDate, dayOffset + 1, 0),
  };
}
