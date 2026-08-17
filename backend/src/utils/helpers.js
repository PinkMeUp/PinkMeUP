/**
 * Helper functions for date/time operations and validation
 */

const moment = require('moment');

const TIME_PATTERN =
  /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;


/*
|--------------------------------------------------------------------------
| TIME HELPERS
|--------------------------------------------------------------------------
*/

/**
 * Convert HH:MM into minutes since midnight.
 */
const parseTimeToMinutes = (timeStr) => {
  if (!isValidTimeFormat(timeStr)) {
    return NaN;
  }

  const [hours, minutes] = timeStr.split(':').map(Number);

  return (hours * 60) + minutes;
};


/**
 * Convert minutes since midnight into HH:MM.
 *
 * Returns null if the value falls outside one calendar day.
 */
const minutesToTimeString = (totalMinutes) => {
  if (
    !Number.isFinite(totalMinutes) ||
    totalMinutes < 0 ||
    totalMinutes >= 24 * 60
  ) {
    return null;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};


/**
 * Generate appointment start-time slots between business opening
 * and closing time.
 *
 * The closing time itself is not returned as a start slot.
 */
const generateTimeSlots = (
  startStr,
  endStr,
  intervalMinutes = 30
) => {
  if (
    !isValidTimeFormat(startStr) ||
    !isValidTimeFormat(endStr)
  ) {
    return [];
  }

  if (
    !Number.isInteger(intervalMinutes) ||
    intervalMinutes <= 0
  ) {
    return [];
  }

  const start = parseTimeToMinutes(startStr);
  const end = parseTimeToMinutes(endStr);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start >= end
  ) {
    return [];
  }

  const slots = [];

  for (
    let current = start;
    current < end;
    current += intervalMinutes
  ) {
    const time = minutesToTimeString(current);

    if (time) {
      slots.push(time);
    }
  }

  return slots;
};


/**
 * Validate HH:MM time format.
 */
const isValidTimeFormat = (timeStr) => {
  return (
    typeof timeStr === 'string' &&
    TIME_PATTERN.test(timeStr)
  );
};


/*
|--------------------------------------------------------------------------
| DATE HELPERS
|--------------------------------------------------------------------------
*/

/**
 * Get the business day name from a date.
 *
 * Important:
 * For YYYY-MM-DD values, the date is treated as a calendar date
 * rather than allowing UTC conversion to move it to another day.
 */
const getDayOfWeek = (date) => {
  if (!date) {
    return null;
  }

  const days = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
  ];

  let dayIndex;

  if (typeof date === 'string') {
    const dateOnlyMatch =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);

      const calendarDate =
        new Date(year, month - 1, day);

      if (
        calendarDate.getFullYear() !== year ||
        calendarDate.getMonth() !== month - 1 ||
        calendarDate.getDate() !== day
      ) {
        return null;
      }

      dayIndex = calendarDate.getDay();
    } else {
      const parsedDate = new Date(date);

      if (Number.isNaN(parsedDate.getTime())) {
        return null;
      }

      dayIndex = parsedDate.getDay();
    }
  } else if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    dayIndex = date.getDay();
  } else {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    dayIndex = parsedDate.getDay();
  }

  return days[dayIndex] || null;
};


/**
 * Calculate the end time of an appointment.
 *
 * Returns null if the resulting time would pass midnight.
 */
const calculateEndTime = (
  startTime,
  durationMinutes
) => {
  if (!isValidTimeFormat(startTime)) {
    return null;
  }

  if (
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return null;
  }

  const startMinutes =
    parseTimeToMinutes(startTime);

  const endMinutes =
    startMinutes + durationMinutes;

  return minutesToTimeString(endMinutes);
};


/*
|--------------------------------------------------------------------------
| FORMATTING HELPERS
|--------------------------------------------------------------------------
*/

const formatDate = (
  date,
  format = 'YYYY-MM-DD'
) => {
  if (!date) {
    return null;
  }

  const parsedDate = moment(date);

  if (!parsedDate.isValid()) {
    return null;
  }

  return parsedDate.format(format);
};


const formatTime = (
  time,
  format = 'HH:mm'
) => {
  if (!time) {
    return null;
  }

  const parsedTime =
    moment(time, 'HH:mm', true);

  if (!parsedTime.isValid()) {
    return null;
  }

  return parsedTime.format(format);
};


/*
|--------------------------------------------------------------------------
| RANGE HELPERS
|--------------------------------------------------------------------------
*/

/**
 * Check whether a time falls within a range.
 *
 * Start is inclusive.
 * End is inclusive.
 */
const isTimeWithinRange = (
  timeStr,
  startStr,
  endStr
) => {
  if (
    !isValidTimeFormat(timeStr) ||
    !isValidTimeFormat(startStr) ||
    !isValidTimeFormat(endStr)
  ) {
    return false;
  }

  const time =
    parseTimeToMinutes(timeStr);

  const start =
    parseTimeToMinutes(startStr);

  const end =
    parseTimeToMinutes(endStr);

  return (
    time >= start &&
    time <= end
  );
};


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  formatDate,
  formatTime,
  parseTimeToMinutes,
  minutesToTimeString,
  isTimeWithinRange,
  generateTimeSlots,
  isValidTimeFormat,
  getDayOfWeek,
  calculateEndTime
};