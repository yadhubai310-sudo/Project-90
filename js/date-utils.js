export const IST_TIMEZONE = 'Asia/Kolkata';

export function toISTDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

export function todayIST() {
  return toISTDateString(new Date());
}

export function formatISTDisplay(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE, weekday: 'long', day: 'numeric', month: 'long',
  }).format(date);
}

// 0 = Sunday .. 6 = Saturday, for a 'YYYY-MM-DD' string
export function istWeekday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.getUTCDay();
}

export function addDaysToDateString(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Monday-start calendar week containing dateStr, as 'YYYY-MM-DD'
export function getWeekStartIST(dateStr) {
  const diffToMonday = (istWeekday(dateStr) + 6) % 7;
  return addDaysToDateString(dateStr, -diffToMonday);
}
