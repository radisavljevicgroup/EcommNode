export const MONTH_NAMES_SR = [
  "Januar",
  "Februar",
  "Mart",
  "April",
  "Maj",
  "Jun",
  "Jul",
  "Avgust",
  "Septembar",
  "Oktobar",
  "Novembar",
  "Decembar",
];

// Monday-first, matching the local convention this app otherwise uses.
export const WEEKDAY_SHORT_SR = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

const pad2 = (n) => String(n).padStart(2, "0");

export function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseISODate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date) {
  return isSameDay(date, new Date());
}

// Monday of the week containing `date`.
export function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

export function buildWeekDays(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// 6 full weeks (42 days) covering the month `date` falls in, Monday-first,
// padded with the trailing days of the previous/next month.
export function buildMonthGrid(date) {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function formatMonthYear(date) {
  return `${MONTH_NAMES_SR[date.getMonth()]} ${date.getFullYear()}`;
}

export function minutesFromTime(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function timeFromMinutes(minutes) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

// Side-by-side column layout for same-day timed events, the way most
// calendar UIs render overlapping meetings. Events that overlap in time get
// squeezed into narrower, equal-width columns within their collision
// cluster; non-overlapping events each get the full width.
export function layoutDayEvents(events) {
  const sorted = [...events].sort(
    (a, b) => minutesFromTime(a.startTime) - minutesFromTime(b.startTime)
  );

  const laidOut = [];
  let cluster = [];
  let clusterEnd = -1;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const columnEnds = [];
    cluster.forEach((ev) => {
      const start = minutesFromTime(ev.startTime);
      const end = minutesFromTime(ev.endTime);
      let column = columnEnds.findIndex((endMin) => endMin <= start);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(end);
      } else {
        columnEnds[column] = end;
      }
      laidOut.push({ ...ev, column });
    });
    const columnCount = columnEnds.length;
    cluster.forEach((ev, i) => {
      laidOut[laidOut.length - cluster.length + i].columnCount = columnCount;
    });
    cluster = [];
  };

  sorted.forEach((ev) => {
    const start = minutesFromTime(ev.startTime);
    const end = minutesFromTime(ev.endTime);
    if (cluster.length > 0 && start >= clusterEnd) {
      flushCluster();
      clusterEnd = -1;
    }
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, end);
  });
  flushCluster();

  return laidOut;
}
