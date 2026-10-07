#!/usr/bin/env node
/*
 * Checks for newtab/core.js. The maths runs in local time, so run it under a few zones, including
 * ones with DST, half-hour DST (Lord Howe) and odd offsets (Kathmandu):
 *
 *   for tz in UTC America/New_York Europe/London Asia/Kolkata Asia/Kathmandu Pacific/Auckland Australia/Lord_Howe; do
 *     TZ=$tz node tools/test-core.js; done
 */
'use strict';

const assert = require('node:assert/strict');
const Core = require('../newtab/core.js');

const at = (y, mo, d, h = 0, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s).getTime();
const fmt = (b) => Core.digits(b).replace(/(..)(?=.)/g, '$1:');
const bday = (text) => Core.parseBirthday(text);
// Strictly ordered scalar for a readout. Fields are < 100 so base 100 is safe (hours can hit 24-25 on DST days).
const key = (b) => ((((b.years * 100 + b.months) * 100 + b.days) * 100 + b.hours) * 100 + b.minutes) * 100 + b.seconds;

let checks = 0;
const eq = (actual, expected, msg) => { checks++; assert.deepEqual(actual, expected, msg); };
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };

// --- parsing -----------------------------------------------------------------------------------
eq(bday('1990-10-21'), { year: 1990, month: 9, day: 21 });
eq(bday('2000-02-29'), { year: 2000, month: 1, day: 29 });
for (const bad of ['2001-02-29', '1990-13-01', '1990-00-10', '1990-04-31', '90-1-1', '', 'nope', null, undefined]) {
  eq(bday(bad), null, `rejects ${bad}`);
}

// --- leaplings celebrate on Mar 1 in common years ---------------------------------------------------
const leapling = bday('2000-02-29');
const md = (d) => [d.getMonth() + 1, d.getDate()];
eq(md(Core.birthdayInYear(leapling, 2028)), [2, 29]);
eq(md(Core.birthdayInYear(leapling, 2027)), [3, 1]);
eq(md(Core.birthdayInYear(leapling, 2100)), [3, 1]); // divisible by 100, not by 400
eq(md(Core.birthdayInYear(leapling, 2400)), [2, 29]);

// --- surrounding birthdays ---------------------------------------------------------------------------
const oct21 = bday('1990-10-21');
let around = Core.surroundingBirthdays(oct21, at(2026, 10, 7, 15, 30, 12));
eq([around.prev.getFullYear(), around.next.getFullYear()], [2025, 2026]);
around = Core.surroundingBirthdays(oct21, at(2026, 10, 21, 0, 0, 0)); // exactly at midnight: it is the birthday
eq([around.prev.getFullYear(), around.next.getFullYear()], [2026, 2027]);
around = Core.surroundingBirthdays(oct21, at(2026, 10, 20, 23, 59, 59));
eq([around.prev.getFullYear(), around.next.getFullYear()], [2025, 2026]);
around = Core.surroundingBirthdays(leapling, at(2026, 10, 7)); // leapling: Mar 1 2026 -> Mar 1 2027
eq([md(around.prev), md(around.next)], [[3, 1], [3, 1]]);
around = Core.surroundingBirthdays(leapling, at(2027, 10, 7)); // ... then Mar 1 2027 -> Feb 29 2028
eq([md(around.prev), md(around.next)], [[3, 1], [2, 29]]);

// --- known readouts ---------------------------------------------------------------------------------
let s = Core.snapshot(oct21, at(2026, 10, 7, 15, 30, 12));
eq(fmt(s), '00:00:13:08:29:48');
eq([s.turning, s.isBirthday], [36, false]);
eq(s.totalSeconds, 13 * 86400 + 8 * 3600 + 29 * 60 + 48);

s = Core.snapshot(oct21, at(2026, 10, 21, 0, 0, 0)); // birthday: a fresh year is granted
eq(fmt(s), '01:00:00:00:00:00');
eq(s.isBirthday, true);

s = Core.snapshot(oct21, at(2026, 10, 21, 0, 0, 1));
eq(fmt(s), '00:11:30:23:59:59');

s = Core.snapshot(oct21, at(2026, 10, 20, 23, 59, 59));
eq(fmt(s), '00:00:00:00:00:01');

s = Core.snapshot(oct21, at(2026, 10, 21, 18, 0, 0));
eq(s.isBirthday, true);
s = Core.snapshot(oct21, at(2026, 10, 22, 0, 0, 0));
eq(s.isBirthday, false);

// Sub-second times show the readout for the start of that second.
eq(fmt(Core.snapshot(oct21, at(2026, 10, 20, 23, 59, 58) + 999)), '00:00:00:00:00:02');

// Month-end clamp: a Mar 1 target in a common year. Forward counting would plateau/jump here.
const mar1 = bday('1990-03-01');
eq(fmt(Core.snapshot(mar1, at(2027, 1, 30, 10))), '00:01:01:14:00:00');
eq(fmt(Core.snapshot(mar1, at(2027, 1, 31, 10))), '00:01:00:14:00:00');

// --- sweeps: the readout must strictly decrease every step until the target rolls over -----------
function sweep(label, b, startMs, endMs, stepMs) {
  let prev = Core.snapshot(b, startMs);
  for (let t = startMs + stepMs; t <= endMs; t += stepMs) {
    const cur = Core.snapshot(b, t);
    checks++;
    ok(cur.months <= 11 && cur.days <= 31 && cur.hours <= 25 && cur.minutes <= 59 && cur.seconds <= 59, `${label}: field out of range at ${new Date(t)}`);
    ok(cur.totalMs === +cur.next - Math.floor(t / 1000) * 1000, `${label}: totalMs mismatch at ${new Date(t)}`);
    if (+cur.next === +prev.next) {
      ok(key(cur) < key(prev), `${label}: readout did not decrease at ${new Date(t)}: ${fmt(prev)} -> ${fmt(cur)}`);
    } else {
      ok(+cur.next > +prev.next, `${label}: target moved backwards at ${new Date(t)}`);
    }
    prev = cur;
  }
}

const HOURS = 3600 * 1000;
// Around month ends, year end, leap day, and each birthday rollover, second by second.
sweep('month-end (Mar 1 target)', mar1, at(2027, 1, 30), at(2027, 2, 2), 1000);
sweep('rollover', oct21, at(2026, 10, 20, 22), at(2026, 10, 21, 2), 1000);
sweep('new year', bday('1999-12-31'), at(2026, 12, 30, 23), at(2027, 1, 1, 1), 1000);
sweep('leap day', leapling, at(2027, 2, 27), at(2027, 3, 2), 1000 * 7);
sweep('leap day (real)', leapling, at(2028, 2, 27), at(2028, 3, 2), 1000 * 7);

// DST transitions in every zone we test (a zone without DST simply passes), second by second.
const dstDays = [[2026, 3, 8], [2026, 11, 1], [2026, 3, 29], [2026, 10, 25], [2026, 4, 5], [2026, 9, 27], [2026, 10, 4], [2026, 4, 5]];
for (const [y, m, d] of dstDays) {
  const day = at(y, m, d);
  const next = new Date(y, m - 1, d + 1);
  const b = { year: 1990, month: next.getMonth(), day: next.getDate() }; // birthday the day after
  sweep(`dst ${y}-${m}-${d}`, b, day - 3 * HOURS, day + 6 * HOURS, 1000);
  sweep(`dst ${y}-${m}-${d} (a week out)`, b, day - 8 * 24 * HOURS, day - 8 * 24 * HOURS + 6 * HOURS, 1000);
}

// A wide, coarse pass for several birthdays (about 5 minute steps; ordering holds at any step size).
for (const text of ['1990-01-31', '1992-02-29', '1985-03-01', '1999-12-31', '2000-01-01', '1988-07-15', '1991-08-31']) {
  sweep(`wide ${text}`, bday(text), at(2026, 1, 1), at(2027, 7, 1), 311 * 1000);
}

console.log(`${process.env.TZ || 'local tz'}: ${checks} checks passed`);
