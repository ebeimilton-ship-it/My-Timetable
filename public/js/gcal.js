/* ──────────────────────────────────────────────────────────────
   gcal.js — Google Identity OAuth + Google Calendar v3 sync (push and import).
   ────────────────────────────────────────────────────────────── */

// FIX: DAY_MAP now includes Sunday and matches JavaScript's getDay() (0=Sunday through 6=Saturday)
const DAY_MAP = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

// Google Calendar colorId per timetable mode, so events from each mode are
// visually distinct at a glance in the user's calendar. Reference:
// 1 Lavender, 2 Sage, 3 Grape, 4 Flamingo, 5 Banana, 6 Tangerine,
// 7 Peacock, 8 Graphite, 9 Blueberry, 10 Basil, 11 Tomato.
const GCAL_COLOR_CLASS = '9'; // Blueberry (blue)
const GCAL_COLOR_EXAM = '11'; // Tomato (red)
const GCAL_COLOR_GROUP = '6'; // Tangerine (orange)
const GCAL_COLOR_PERSONAL = '3'; // Grape (purple)

const SEMESTER_END_DATE = APP_CONFIG.semesterEnd;

let tokenClient = null;
let gcalToken = null;
let pendingGCalFn = null;
let pendingGCalErrorFn = null;
let gcalPendingTimer = null;

function initGoogleCalendar() {
  if (!window.google || !google.accounts) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GCAL_CLIENT_ID,
    scope: GCAL_SCOPE,
    callback: async (resp) => {
      if (gcalPendingTimer) {
        clearTimeout(gcalPendingTimer);
        gcalPendingTimer = null;
      }
      const errFn = pendingGCalErrorFn;
      if (resp.error) {
        showToast('Google sign-in failed: ' + (resp.error_description || resp.error), 'error');
        pendingGCalFn = null;
        pendingGCalErrorFn = null;
        if (errFn) errFn(resp);
        return;
      }
      gcalToken = {
        access_token: resp.access_token,
        expires_at: Date.now() + (resp.expires_in - 30) * 1000,
      };
      pendingGCalErrorFn = null;
      if (pendingGCalFn) {
        try {
          await pendingGCalFn();
        } catch (err) {
          console.error('Error in pendingGCalFn:', err);
          showToast('Error during sync: ' + (err.message || err), 'error');
        }
        pendingGCalFn = null;
      }
    },
  });
}

function withGCalToken(fn, onError) {
  pendingGCalFn = fn;
  pendingGCalErrorFn = onError || null;
  if (gcalToken && Date.now() < gcalToken.expires_at) {
    pendingGCalErrorFn = null;
    Promise.resolve(fn()).catch((err) => {
      console.error('Error in sync function:', err);
      showToast('Error during sync: ' + (err.message || err), 'error');
    });
    pendingGCalFn = null;
    return;
  }
  if (!tokenClient) {
    setTimeout(() => {
      initGoogleCalendar();
      withGCalToken(fn, onError);
    }, 800);
    return;
  }
  if (gcalPendingTimer) clearTimeout(gcalPendingTimer);

  gcalPendingTimer = setTimeout(() => {
    gcalPendingTimer = null;

    if (pendingGCalFn) {
      showToast('Still waiting for Google sign-in… finish the consent screen and syncing will start automatically.', 'error');
      if (pendingGCalErrorFn) pendingGCalErrorFn({ error: 'still_waiting' });
    }
  }, 45000);
  tokenClient.requestAccessToken({ prompt: gcalToken ? '' : 'consent' });
}

async function createGCalEvent(event) {
  // FIX: Validate event payload before sending
  if (!event.summary || !event.start || !event.end) {
    throw new Error('Invalid event: missing required fields (summary, start, end)');
  }
  if (!event.start.dateTime || !event.end.dateTime) {
    throw new Error('Invalid event: start and end must have dateTime property');
  }

  const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + gcalToken.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error('Google Calendar API Error Response:', errorText);
    console.error('Request Payload:', JSON.stringify(event, null, 2));
    throw new Error(`Google Calendar API Error (${resp.status}): ${errorText}`);
  }
  return resp.json();
}

function nextWeekday(dayIndex) {
  // FIX: Properly calculate next occurrence of weekday
  // dayIndex should be 0-6 matching JavaScript's getDay() (Sunday=0, Saturday=6)
  if (typeof dayIndex !== 'number' || dayIndex < 0 || dayIndex > 6) {
    throw new Error(`Invalid day index: ${dayIndex}. Must be 0-6.`);
  }

  const today = new Date();
  const currentDay = today.getDay();
  let diff = dayIndex - currentDay;

  // If diff is 0, we want today (the class happens today)
  // If diff is negative, we've passed this day this week, so get next week's occurrence
  if (diff < 0) diff += 7;
  // If diff equals 0, we want today's date

  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  d.setHours(0, 0, 0, 0); // Reset time to midnight to avoid timezone issues
  return d;
}

function isoDateTime(date, hourFloat) {
  // FIX: Proper ISO 8601 datetime formatting with validation
  if (!date || isNaN(date.getTime())) {
    throw new Error('Invalid date passed to isoDateTime');
  }
  if (typeof hourFloat !== 'number' || hourFloat < 0 || hourFloat > 24) {
    throw new Error(`Invalid hour value: ${hourFloat}`);
  }

  const h = Math.floor(hourFloat);
  const m = hourFloat % 1 === 0.5 ? 30 : 0;
  const pad = (n) => String(n).padStart(2, '0');

  // FIX: Ensure valid hour/minute ranges
  if (h > 23 || (h === 24 && m > 0)) {
    throw new Error(`Hour value out of range: ${hourFloat}`);
  }

  const result = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(h)}:${pad(m)}:00`;
  return result;
}

function untilDateStr(startDate, weeks) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + weeks * 7);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T000000Z`;
}

const KE_HOLIDAY_CALENDAR_ID = 'en.ke#holiday@group.v.calendar.google.com';
const HOLIDAY_CACHE_KEY = 'mts_ke_holidays_cache';
const HOLIDAY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function ymd(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function fetchKenyaHolidays(weeks = 16) {
  const now = Date.now();
  let cache = null;
  try {
    cache = JSON.parse(localStorage.getItem(HOLIDAY_CACHE_KEY) || 'null');
  } catch (e) {}

  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + weeks * 7 + 7);

  if (
    cache &&
    cache.fetchedAt &&
    now - cache.fetchedAt < HOLIDAY_CACHE_TTL_MS &&
    cache.horizonEnd &&
    new Date(cache.horizonEnd) >= horizonEnd
  ) {
    return new Set(cache.dates);
  }

  if (!gcalToken || Date.now() >= gcalToken.expires_at) {
    return new Set(cache ? cache.dates : []);
  }

  try {
    const timeMin = new Date().toISOString();
    const timeMax = horizonEnd.toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(KE_HOLIDAY_CALENDAR_ID)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&maxResults=100`;
    const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + gcalToken.access_token } });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    const dates = (data.items || []).map((ev) => ev.start && (ev.start.date || (ev.start.dateTime || '').slice(0, 10))).filter(Boolean);
    localStorage.setItem(
      HOLIDAY_CACHE_KEY,
      JSON.stringify({
        fetchedAt: now,
        horizonEnd: horizonEnd.toISOString(),
        dates,
      }),
    );
    return new Set(dates);
  } catch (err) {
    console.warn('Kenya holiday fetch failed, using cached list if any:', err);
    return new Set(cache ? cache.dates : []);
  }
}

function buildClassEvent(unit, holidaySet) {
  // FIX: Proper day mapping and timezone handling
  const dayIdx = DAY_MAP[unit.day];
  if (dayIdx === undefined) {
    throw new Error(`Invalid day: ${unit.day}. Valid days are: ${Object.keys(DAY_MAP).join(', ')}`);
  }

  const startDate = nextWeekday(dayIdx);
  const endHour = unit.startHour + unit.duration;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Nairobi';
  const MAX_WEEKS = 16;

  let WEEKS = MAX_WEEKS;
  for (let w = 0; w < MAX_WEEKS; w++) {
    const occ = new Date(startDate);
    occ.setDate(startDate.getDate() + w * 7);
    if (occ >= SEMESTER_END_DATE) {
      WEEKS = w;
      break;
    }
  }

  // Recurring weekly until the semester ends. If the first occurrence is already
  // past the end date, create a single event (an UNTIL before DTSTART is invalid).
  const recurrence = [];
  if (WEEKS > 0) {
    const pad = (n) => String(n).padStart(2, '0');
    const untilStr = `${SEMESTER_END_DATE.getFullYear()}${pad(SEMESTER_END_DATE.getMonth() + 1)}${pad(SEMESTER_END_DATE.getDate())}T000000Z`;
    const dayNameMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    recurrence.push(`RRULE:FREQ=WEEKLY;UNTIL=${untilStr};BYDAY=${dayNameMap[dayIdx]}`);

    // Skip public holidays. EXDATE is expressed in the event's own time zone
    // (TZID) — the old version tagged local times with "Z", which shifted them.
    if (holidaySet && holidaySet.size) {
      const exDates = [];
      for (let w = 0; w < WEEKS; w++) {
        const occ = new Date(startDate);
        occ.setDate(startDate.getDate() + w * 7);
        if (holidaySet.has(ymd(occ))) exDates.push(isoDateTime(occ, unit.startHour).replace(/[-:]/g, ''));
      }
      if (exDates.length) recurrence.push(`EXDATE;TZID=${tz}:${exDates.join(',')}`);
    }
  }

  return {
    summary: `CLASS: ${unit.code} – ${unit.name}`,
    location: `${unit.venue}, Maseno University`,
    description: `Unit: ${unit.name}\nCode: ${unit.code}${unit.lecturer ? '\nLecturer: ' + unit.lecturer : ''}\nVenue: ${unit.venue}`,
    start: { dateTime: isoDateTime(startDate, unit.startHour), timeZone: tz },
    end: { dateTime: isoDateTime(startDate, endHour), timeZone: tz },
    ...(recurrence.length ? { recurrence } : {}),
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] },
    colorId: GCAL_COLOR_CLASS,
  };
}

function buildExamEvent(exam) {
  // FIX: Proper validation of exam data
  if (!exam.date || !exam.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new Error(`Invalid exam date format: ${exam.date}. Expected YYYY-MM-DD.`);
  }

  const startHour = parseFloat(exam.start);
  const endHour = startHour + parseFloat(exam.dur || 3);

  // FIX: Validate hour values
  if (isNaN(startHour) || startHour < 0 || startHour > 24) {
    throw new Error(`Invalid exam start hour: ${exam.start}`);
  }
  if (isNaN(endHour) || endHour < 0 || endHour > 24) {
    throw new Error(`Invalid exam end hour: ${endHour}`);
  }

  const [y, mo, d] = exam.date.split('-').map(Number);
  const dateObj = new Date(y, mo - 1, d);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Nairobi';

  // FIX: Handle location properly (don't include "Maseno University" if venue is empty)
  const location = exam.venue ? `${exam.venue}, Maseno University` : 'Maseno University';

  return {
    summary: `EXAM: ${exam.code} – ${exam.name}`,
    location: location,
    description: `Exam: ${exam.name}\nCode: ${exam.code}\nTime: ${exam.timeStr || ''}\nVenue: ${exam.venue || 'TBD'}`,
    start: { dateTime: isoDateTime(dateObj, startHour), timeZone: tz },
    end: { dateTime: isoDateTime(dateObj, endHour), timeZone: tz },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
    colorId: GCAL_COLOR_EXAM,
  };
}

const GCAL_STORE_CLASS = 'mts_gcal_class_ids';
const GCAL_STORE_EXAM = 'mts_gcal_exam_ids';

function _gcalLoad(storeKey) {
  try {
    return JSON.parse(localStorage.getItem(storeKey) || '{}');
  } catch (e) {
    return {};
  }
}
function _gcalSave(storeKey, map) {
  try {
    localStorage.setItem(storeKey, JSON.stringify(map));
  } catch (e) {}
}
function _classEventKey(unit) {
  return `${unit.code}_${unit.day}_${unit.startHour}`;
}
function _examEventKey(exam) {
  return `${exam.code}_${exam.date}_${exam.start}`;
}

async function updateGCalEvent(eventId, event) {
  // FIX: Validate event payload before sending
  if (!eventId || typeof eventId !== 'string') {
    throw new Error(`Invalid event ID: ${eventId}`);
  }
  if (!event.summary || !event.start || !event.end) {
    throw new Error('Invalid event: missing required fields (summary, start, end)');
  }

  const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + gcalToken.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error('Google Calendar API Error Response:', errorText);
    console.error('Event ID:', eventId);
    console.error('Request Payload:', JSON.stringify(event, null, 2));
    throw new Error(`Google Calendar API Error (${resp.status}): ${errorText}`);
  }
  return resp.json();
}

async function deleteGCalEvent(eventId) {
  const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + gcalToken.access_token },
  });

  if (!resp.ok && resp.status !== 410) throw new Error(await resp.text());
}

async function upsertGCalEvent(key, storeKey, eventObj) {
  const map = _gcalLoad(storeKey);
  if (map[key]) {
    try {
      const updated = await updateGCalEvent(map[key], eventObj);
      map[key] = updated.id;
    } catch (e) {
      if (e.message && (e.message.includes('404') || e.message.includes('410') || e.message.includes('Gone'))) {
        const created = await createGCalEvent(eventObj);
        map[key] = created.id;
      } else {
        throw e;
      }
    }
  } else {
    const created = await createGCalEvent(eventObj);
    map[key] = created.id;
  }
  _gcalSave(storeKey, map);
}

async function pruneRemovedEvents(currentKeys, storeKey, deleteFromGCal) {
  const map = _gcalLoad(storeKey);
  const toRemove = Object.keys(map).filter((k) => !currentKeys.has(k));
  for (const k of toRemove) {
    if (deleteFromGCal) {
      try {
        await deleteGCalEvent(map[k]);
      } catch (e) {}
    }
    delete map[k];
  }
  _gcalSave(storeKey, map);
}

function _setLastSync(modeKey) {
  try {
    localStorage.setItem('mts_last_sync_' + modeKey, Date.now().toString());
  } catch (e) {}
  renderLastSync(modeKey);
}
function _clearLastSync(modeKey) {
  try {
    localStorage.removeItem('mts_last_sync_' + modeKey);
  } catch (e) {}
  renderLastSync(modeKey);
}
function renderLastSync(modeKey) {
  const el = document.getElementById('lastSync_' + modeKey);
  if (!el) return;
  let ts = null;
  try {
    ts = localStorage.getItem('mts_last_sync_' + modeKey);
  } catch (e) {}
  if (!ts) {
    el.textContent = '';
    el.classList.remove('visible');
    return;
  }
  const d = new Date(parseInt(ts, 10));
  const fmt = d.toLocaleString('en-KE', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  el.textContent = `✅ Last synced to Google Calendar: ${fmt}`;
  el.classList.add('visible');
}

async function syncClassToGCal() {
  if (!selectedUnits || selectedUnits.length === 0) {
    showToast('No units to sync. Please generate your timetable first.', 'error');
    return;
  }
  withGCalToken(async () => {
    const btn = document.querySelector('#outputSection .btn-gcal');
    const orig = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Syncing…';
    }
    try {
      const holidaySet = await fetchKenyaHolidays(16);

      const currentKeys = new Set(selectedUnits.map(_classEventKey));

      await pruneRemovedEvents(currentKeys, GCAL_STORE_CLASS, true);

      let count = 0;
      for (const unit of selectedUnits) {
        const key = _classEventKey(unit);
        await upsertGCalEvent(key, GCAL_STORE_CLASS, buildClassEvent(unit, holidaySet));
        count++;
        if (btn) btn.innerHTML = `⏳ ${count}/${selectedUnits.length}…`;
      }

      const holidayNote = holidaySet.size ? ' Public holidays are automatically skipped.' : '';
      showToast(
        `${count} class event(s) synced to your Google Calendar!\nExisting events were updated and removed events were deleted. Each repeats weekly with a 30-min reminder.${holidayNote} If you don't see them yet, refresh your calendar app.`,
        'success',
      );
      _setLastSync('class');
    } catch (err) {
      console.error(err);
      showToast('Failed to sync some events. Please try again.\n' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    }
  });
}

async function syncExamToGCal() {
  if (!examUnits || examUnits.length === 0) {
    showToast('No exams to sync. Please generate your exam timetable first.', 'error');
    return;
  }
  withGCalToken(async () => {
    const btn = document.querySelector('#examOutputSection .btn-gcal');
    const orig = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Syncing…';
    }
    try {
      const currentKeys = new Set(examUnits.filter((e) => e.date).map(_examEventKey));

      await pruneRemovedEvents(currentKeys, GCAL_STORE_EXAM, true);

      let count = 0;
      for (const exam of examUnits) {
        if (!exam.date) continue;
        const key = _examEventKey(exam);
        await upsertGCalEvent(key, GCAL_STORE_EXAM, buildExamEvent(exam));
        count++;
        if (btn) btn.innerHTML = `⏳ ${count}/${examUnits.length}…`;
      }

      showToast(
        `${count} exam event(s) synced to your Google Calendar!\nExisting events were updated and removed events were deleted. Each exam has a 60-min reminder. If you don't see them yet, refresh your calendar app.`,
        'success',
      );
      _setLastSync('exam');
    } catch (err) {
      console.error(err);
      showToast('Failed to sync some events. Please try again.\n' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// ── Personal Planner module ──
// Custom user events (birthdays, deadlines, meetings, appointments,
// travel, etc.) that aren't part of the class/exam/group/study data.
// Unlike the other modes, events persist in localStorage across visits
// (mts_planner_events) — this is a running personal list, not a
// per-session draft, so leaving the page never clears it.
// ═══════════════════════════════════════════════════════════════════

const PLANNER_STORE_KEY = 'mts_planner_events';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function fmtHour(h) {
  const hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60);
  let hh2 = hh;
  if (mm === 60) {
    mm = 0;
    hh2 += 1;
  }
  const ampm = hh2 < 12 ? 'AM' : 'PM';
  const disp = hh2 % 12 === 0 ? 12 : hh2 % 12;
  return `${disp}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function psCatTimeRange(cat) {
  const [hh, mm] = cat.time.split(':').map(Number);
  const start = hh + mm / 60;
  const end = start + cat.duration;
  return `${fmtHour(start)} – ${fmtHour(end)}`;
}

function populateTimeSelect(el, startH = 5, endH = 23) {
  el.innerHTML = '';
  for (let h = startH; h <= endH; h += 0.5) {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = fmtHour(h);
    el.appendChild(opt);
  }
}

async function fetchGCalClassEvents() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&maxResults=100`;
  const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + gcalToken.access_token } });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return (data.items || [])
    .map((ev) => {
      if (!ev.start || !ev.start.dateTime) return null;
      if (!ev.summary || !ev.summary.startsWith('CLASS:')) return null;

      const desc = ev.description || '';
      const firstLine = desc.split('\n')[0];
      const nameMatch = firstLine.match(/^Unit:\s*(.+)$/);
      const codeMatch = desc.match(/^Code:\s*(.+)$/m);
      const venueMatch = desc.match(/^Venue:\s*(.+)$/m);
      const lecturerMatch = desc.match(/^Lecturer:\s*(.+)$/m);
      if (!nameMatch || !codeMatch) return null;
      const s = new Date(ev.start.dateTime);
      const e = new Date(ev.end.dateTime);
      const day = DAY_NAMES[s.getDay()];
      return {
        code: codeMatch[1].trim(),
        name: nameMatch[1].trim(),
        day,
        start: s.getHours() + s.getMinutes() / 60,
        end: e.getHours() + e.getMinutes() / 60,
        venue: venueMatch ? venueMatch[1].trim() : '',
        lecturer: lecturerMatch ? lecturerMatch[1].trim() : '',
      };
    })
    .filter(Boolean);
}

async function fetchGCalExamEvents() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + 180);
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&maxResults=100`;
  const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + gcalToken.access_token } });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  const pad = (n) => String(n).padStart(2, '0');
  return (data.items || [])
    .map((ev) => {
      if (!ev.start || !ev.start.dateTime) return null;
      if (!ev.summary || !ev.summary.startsWith('EXAM:')) return null;

      const desc = ev.description || '';
      const nameMatch = desc.match(/^Exam:\s*(.+)$/m);
      const codeMatch = desc.match(/^Code:\s*(.+)$/m);
      const venueMatch = desc.match(/^Venue:\s*(.+)$/m);
      if (!nameMatch || !codeMatch) return null;
      const s = new Date(ev.start.dateTime);
      const e = new Date(ev.end.dateTime);
      const date = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
      const start = s.getHours() + s.getMinutes() / 60;
      const dur = (e - s) / 3600000;
      return { code: codeMatch[1].trim(), name: nameMatch[1].trim(), date, start, dur, venue: venueMatch ? venueMatch[1].trim() : '' };
    })
    .filter(Boolean);
}

async function fetchGCalWeekSchedule(weekStartVal) {
  const [y, m, d] = weekStartVal.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=250`;
  const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + gcalToken.access_token } });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return (data.items || [])
    .map((ev) => {
      if (ev.status === 'cancelled') return null;
      if (!ev.start || !ev.start.dateTime || !ev.end || !ev.end.dateTime) return null; // skip all-day events
      const s = new Date(ev.start.dateTime);
      const e = new Date(ev.end.dateTime);
      if (e <= s) return null;
      return {
        day: DAY_NAMES[s.getDay()],
        start: s.getHours() + s.getMinutes() / 60,
        end: e.getHours() + e.getMinutes() / 60,
        title: ev.summary || '(untitled event)',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

function computeFreeSlots(busyBlocks, dayStart, dayEnd, minSlot) {
  const sorted = [...busyBlocks].sort((a, b) => a.start - b.start);
  const slots = [];
  let cursor = dayStart;
  for (const b of sorted) {
    if (b.start > cursor + minSlot) slots.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (dayEnd > cursor + minSlot) slots.push({ start: cursor, end: dayEnd });
  return slots.filter((s) => s.end - s.start >= minSlot);
}

let grpMembers = [];
let grpUnits = [];
let grpSessionBlocks = {};
let grpScheduleBuilt = false;
let grpEditingIndex = null;
