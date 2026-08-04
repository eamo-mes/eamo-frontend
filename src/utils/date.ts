import dayjs, { type Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Returns current Dayjs object in Vietnam Time (UTC+7).
 * Use for UI display / DatePicker initialization.
 */
export function getVNNow(): Dayjs {
  return dayjs().tz(VN_TIMEZONE);
}

/**
 * Returns current timestamp as Vietnam local time string formatted as 'YYYY-MM-DD HH:mm:ss'.
 * Backend (StoreEquipmentErrorLogRequest / UpdateEquipmentErrorLogRequest) receives this string
 * and converts from VN timezone (Asia/Ho_Chi_Minh) to UTC before persisting.
 */
export function getVNNowString(format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs().tz(VN_TIMEZONE).format(format);
}

/**
 * Formats any date string or Dayjs object to Vietnam Time (UTC+7) for display.
 * - ISO strings with Z or timezone offset are treated as UTC → converted to VN time (+7h).
 * - Plain strings without offset are assumed to be UTC and converted to VN time.
 */
export function formatVNTime(date?: string | Dayjs | null, format = 'YYYY-MM-DD HH:mm:ss'): string {
  if (!date) return '-';
  if (dayjs.isDayjs(date)) {
    return date.tz(VN_TIMEZONE).format(format);
  }
  if (typeof date === 'string' && (date.includes('Z') || date.includes('+') || date.includes('T'))) {
    return dayjs.utc(date).tz(VN_TIMEZONE).format(format);
  }
  // Plain datetime string — assume UTC (e.g. backend returned without Z), convert to VN
  return dayjs.utc(date).tz(VN_TIMEZONE).format(format);
}

/**
 * Converts a Dayjs instance (from DatePicker, which is in VN local time) to VN-local string for API.
 * Backend will interpret this string as VN timezone and convert to UTC before storing.
 * Use in form modals when you have a Dayjs value from DatePicker.
 */
export function dayjsToVNString(d?: Dayjs | null, format = 'YYYY-MM-DD HH:mm:ss'): string | null {
  if (!d) return null;
  return d.tz(VN_TIMEZONE).format(format);
}

/**
 * Parses a date string into a Dayjs instance set to Vietnam Time (UTC+7).
 * Use to populate DatePicker with existing record values from backend (which stores UTC with Z).
 */
export function parseVNTime(date?: string | null): Dayjs | undefined {
  if (!date) return undefined;
  if (date.includes('Z') || date.includes('+') || date.includes('T')) {
    return dayjs.utc(date).tz(VN_TIMEZONE);
  }
  return dayjs.utc(date).tz(VN_TIMEZONE);
}

export { dayjs };
