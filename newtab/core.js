/*
 * Countdown maths for the In Time new-tab page.
 * Pure functions only (no DOM) so the same file runs in the browser and under `node tools/test-core.js`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InTimeCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const pad2 = (n) => String(n).padStart(2, '0');

  /** 'YYYY-MM-DD' -> { year, month (0-11), day }, or null when it is not a real calendar date. */
  function parseBirthday(text) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '');
    if (!m) return null;
    const year = +m[1];
    const month = +m[2] - 1;
    const day = +m[3];
    const probe = new Date(year, month, day);
    const real = probe.getFullYear() === year && probe.getMonth() === month && probe.getDate() === day;
    return real ? { year, month, day } : null;
  }

  /** Local midnight of the birthday in calendar year `y`. Feb 29 babies celebrate on Mar 1 in common years. */
  function birthdayInYear(bday, y) {
    const leapling = bday.month === 1 && bday.day === 29;
    if (leapling && !isLeapYear(y)) return new Date(y, 2, 1);
    return new Date(y, bday.month, bday.day);
  }

  /** `prev` is the latest birthday at or before `nowMs`, `next` the first one after it. */
  function surroundingBirthdays(bday, nowMs) {
    const y = new Date(nowMs).getFullYear();
    const thisYear = birthdayInYear(bday, y);
    return +thisYear <= nowMs
      ? { prev: thisYear, next: birthdayInYear(bday, y + 1) }
      : { prev: birthdayInYear(bday, y - 1), next: thisYear };
  }

  /** Calendar-aware add that keeps the wall-clock time of day: Jan 31 + 1 month = Feb 28 (or 29). */
  function addMonths(date, n) {
    const d = new Date(date);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return d;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  /**
   * Splits the time between `nowMs` and the Date `to` into years / months / days / hours / minutes / seconds.
   *
   * Months and days are counted *backwards from the target*, not forwards from now. Counting forwards
   * clamps at month ends (Jan 31 + 1 month = Feb 28), which makes the readout jump up by a day when
   * the clock crosses one. Anchoring on the fixed target keeps every field monotonic.
   * Seconds are whole: the readout shows what remains at the start of the current second.
   */
  function breakdown(nowMs, to) {
    const now = Math.floor(nowMs / SECOND) * SECOND;
    const totalMs = Math.max(0, +to - now);
    if (totalMs === 0) return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, totalMs };

    const nowDate = new Date(now);
    let k = (to.getFullYear() - nowDate.getFullYear()) * 12 + (to.getMonth() - nowDate.getMonth());
    while (k > 0 && +addMonths(to, -k) < now) k--;
    while (+addMonths(to, -(k + 1)) >= now) k++;
    const monthAnchor = addMonths(to, -k);

    let d = Math.floor((+monthAnchor - now) / DAY);
    while (d > 0 && +addDays(monthAnchor, -d) < now) d--;
    while (+addDays(monthAnchor, -(d + 1)) >= now) d++;
    const rest = +addDays(monthAnchor, -d) - now;

    return {
      years: Math.floor(k / 12),
      months: k % 12,
      days: d,
      hours: Math.floor(rest / HOUR),
      minutes: Math.floor((rest % HOUR) / MINUTE),
      seconds: Math.floor((rest % MINUTE) / SECOND),
      totalMs,
    };
  }

  /** Everything the page needs to draw one frame of the countdown to the next birthday. */
  function snapshot(bday, nowMs) {
    const { prev, next } = surroundingBirthdays(bday, nowMs);
    const parts = breakdown(nowMs, next);
    const span = +next - +prev;
    const elapsed = Math.min(1, Math.max(0, (nowMs - +prev) / span));
    return {
      ...parts,
      prev,
      next,
      elapsed,
      remaining: 1 - elapsed,
      turning: next.getFullYear() - bday.year,
      isBirthday: new Date(nowMs).toDateString() === prev.toDateString(),
      totalSeconds: Math.floor(parts.totalMs / SECOND),
      totalHours: Math.floor(parts.totalMs / HOUR),
      totalDays: Math.floor(parts.totalMs / DAY),
    };
  }

  /** The twelve digits shown on the clock: YYMMDDHHMMSS. */
  function digits(s) {
    return pad2(s.years) + pad2(s.months) + pad2(s.days) + pad2(s.hours) + pad2(s.minutes) + pad2(s.seconds);
  }

  return { SECOND, MINUTE, HOUR, DAY, isLeapYear, pad2, parseBirthday, birthdayInYear, surroundingBirthdays, addMonths, addDays, breakdown, snapshot, digits };
});
