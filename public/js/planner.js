/* ──────────────────────────────────────────────────────────────
   planner.js — Personal Planner mode: events, recurrence, filters, GCal sync.
   ────────────────────────────────────────────────────────────── */

const GCAL_STORE_PLANNER = 'mts_gcal_planner_ids';
const GCAL_COLOR_PLANNER = '5'; // Banana (yellow) — keeps planner events visually distinct

const PLANNER_CATEGORIES = {
  personal: { label: 'Personal', emoji: '🏠', color: '#8b5cf6' },
  academic: { label: 'Academic', emoji: '📚', color: '#3b82f6' },
  work: { label: 'Work', emoji: '💼', color: '#f97316' },
  social: { label: 'Social', emoji: '🎉', color: '#ec4899' },
  health: { label: 'Health', emoji: '🩺', color: '#10b981' },
  finance: { label: 'Finance', emoji: '💰', color: '#eab308' },
  travel: { label: 'Travel', emoji: '✈️', color: '#06b6d4' },
  other: { label: 'Other', emoji: '📌', color: '#6b7280' },
};
const PLANNER_PRIORITIES = {
  high: { label: 'High', emoji: '🔴', color: '#ef4444' },
  medium: { label: 'Medium', emoji: '🟡', color: '#eab308' },
  low: { label: 'Low', emoji: '🟢', color: '#22c55e' },
};

let plannerEvents = [];
let plannerEditingId = null;
let plannerFilters = { search: '', category: 'all', priority: 'all' };

function _plannerCat(key) {
  return PLANNER_CATEGORIES[key] || PLANNER_CATEGORIES.other;
}
function _plannerPri(key) {
  return PLANNER_PRIORITIES[key] || PLANNER_PRIORITIES.medium;
}

function _plannerPopulateSelects() {
  const catOptions = Object.entries(PLANNER_CATEGORIES)
    .map(([k, v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`)
    .join('');
  const priOptions = Object.entries(PLANNER_PRIORITIES)
    .map(([k, v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`)
    .join('');

  const formCat = document.getElementById('plCategory');
  const formPri = document.getElementById('plPriority');
  if (formCat) formCat.innerHTML = catOptions;
  if (formPri) formPri.innerHTML = priOptions;
  if (formPri) formPri.value = 'medium';

  const filterCat = document.getElementById('plFilterCategory');
  const filterPri = document.getElementById('plFilterPriority');
  if (filterCat) filterCat.innerHTML = '<option value="all">All categories</option>' + catOptions;
  if (filterPri) filterPri.innerHTML = '<option value="all">All priorities</option>' + priOptions;
}

function plannerToggleRepeatUntil() {
  const repeatEl = document.getElementById('plRepeat');
  const wrap = document.getElementById('plRepeatUntilWrap');
  if (!repeatEl || !wrap) return;
  wrap.style.display = repeatEl.value === 'none' ? 'none' : 'block';
}

const PLANNER_MAX_OCCURRENCES = 60;
const PLANNER_REPEAT_LABELS = { daily: 'Repeats daily', weekly: 'Repeats weekly', monthly: 'Repeats monthly', yearly: 'Repeats yearly' };

// Generates an array of yyyy-mm-dd date strings starting at startDate,
// stepping by repeatType, stopping at untilDate (inclusive) or the
// occurrence cap — whichever comes first. Purely local, no server calls.
function plannerGenerateRecurrenceDates(startDate, repeatType, untilDate) {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const until = untilDate ? new Date(...untilDate.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v)))) : null;
  const pad = (n) => String(n).padStart(2, '0');
  const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dates = [];
  let guard = 0;
  while (guard < PLANNER_MAX_OCCURRENCES) {
    if (until && cur > until) break;
    dates.push(toStr(cur));
    guard++;
    if (repeatType === 'daily') cur.setDate(cur.getDate() + 1);
    else if (repeatType === 'weekly') cur.setDate(cur.getDate() + 7);
    else if (repeatType === 'monthly') cur.setMonth(cur.getMonth() + 1);
    else if (repeatType === 'yearly') cur.setFullYear(cur.getFullYear() + 1);
    else break;
    if (!until && dates.length >= PLANNER_MAX_OCCURRENCES) break;
  }
  return dates;
}

let _plannerSearchTimer = null;
function plannerApplyFiltersDebounced() {
  clearTimeout(_plannerSearchTimer);
  _plannerSearchTimer = setTimeout(plannerApplyFilters, 220);
}

function plannerApplyFilters() {
  const searchEl = document.getElementById('plSearch');
  const catEl = document.getElementById('plFilterCategory');
  const priEl = document.getElementById('plFilterPriority');
  plannerFilters.search = searchEl ? searchEl.value.trim().toLowerCase() : '';
  plannerFilters.category = catEl ? catEl.value : 'all';
  plannerFilters.priority = priEl ? priEl.value : 'all';
  renderPlannerEvents();
}

function plannerClearFilters() {
  const searchEl = document.getElementById('plSearch');
  const catEl = document.getElementById('plFilterCategory');
  const priEl = document.getElementById('plFilterPriority');
  if (searchEl) searchEl.value = '';
  if (catEl) catEl.value = 'all';
  if (priEl) priEl.value = 'all';
  plannerFilters = { search: '', category: 'all', priority: 'all' };
  renderPlannerEvents();
}

function _plannerLoad() {
  try {
    plannerEvents = JSON.parse(localStorage.getItem(PLANNER_STORE_KEY) || '[]');
  } catch (e) {
    plannerEvents = [];
  }
}
function _plannerSave() {
  try {
    localStorage.setItem(PLANNER_STORE_KEY, JSON.stringify(plannerEvents));
  } catch (e) {}
}

function plannerReminderLabel(mins) {
  mins = parseInt(mins, 10) || 0;
  if (!mins) return 'No reminder';
  if (mins < 60) return mins + ' min before';
  if (mins < 1440) {
    const hrs = mins / 60;
    return hrs + ' hour' + (hrs !== 1 ? 's' : '') + ' before';
  }
  if (mins < 10080) {
    const days = mins / 1440;
    return days + ' day' + (days !== 1 ? 's' : '') + ' before';
  }
  const weeks = mins / 10080;
  return weeks + ' week' + (weeks !== 1 ? 's' : '') + ' before';
}

function formatPlannerDate(dateStr) {
  if (!dateStr) return '';
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPlannerTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function _plannerTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function plannerUrgencyBadge(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const evDate = new Date(y, mo - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((evDate - today) / 86400000);
  if (diffDays < 0) return { label: 'Overdue', color: '#ef4444', emoji: '⚠️' };
  if (diffDays === 0) return { label: 'Today', color: '#ef4444', emoji: '🔴' };
  if (diffDays === 1) return { label: 'Tomorrow', color: '#f97316', emoji: '🟠' };
  if (diffDays <= 7) return { label: `In ${diffDays} days`, color: '#eab308', emoji: '🟡' };
  return null;
}

let plannerShowPast = false;
function plannerTogglePastEvents() {
  plannerShowPast = !plannerShowPast;
  renderPlannerEvents();
}

function renderPlannerEvents() {
  const listEl = document.getElementById('plannerList');
  const countEl = document.getElementById('plannerCount');
  if (!listEl) return;
  if (!plannerEvents.length) {
    listEl.innerHTML =
      '<div style="font-size:0.78rem;color:var(--muted);text-align:center;padding:18px 0;">No personal events yet — add one above.</div>';
    if (countEl) countEl.textContent = '0 events';
    return;
  }

  const todayStr = _plannerTodayStr();
  const { search, category, priority } = plannerFilters;
  const matchesFilters = (ev) => {
    if (category !== 'all' && (ev.category || 'other') !== category) return false;
    if (priority !== 'all' && (ev.priority || 'medium') !== priority) return false;
    if (search) {
      const hay = `${ev.title || ''} ${ev.notes || ''} ${ev.location || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  };

  // Past events are hidden by default — keeps the list short and fast to
  // render once a planner has months of history or a long recurring series.
  const matched = plannerEvents.filter(matchesFilters);
  const pastCount = matched.filter((ev) => ev.date < todayStr).length;
  const filtered = plannerShowPast ? matched : matched.filter((ev) => ev.date >= todayStr);

  const toggleHtml = pastCount
    ? `<div style="text-align:center;margin-bottom:10px;">
<span class="planner-filter-clear" onclick="plannerTogglePastEvents()">${plannerShowPast ? 'Hide past events' : `Show ${pastCount} past event${pastCount !== 1 ? 's' : ''}`}</span>
</div>`
    : '';

  if (!filtered.length) {
    listEl.innerHTML =
      toggleHtml +
      '<div style="font-size:0.78rem;color:var(--muted);text-align:center;padding:18px 0;">No events match your search/filters.</div>';
    if (countEl) countEl.textContent = `0 of ${plannerEvents.length} event${plannerEvents.length !== 1 ? 's' : ''}`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
  listEl.innerHTML =
    toggleHtml +
    sorted
      .map((ev) => {
        const cat = _plannerCat(ev.category);
        const pri = _plannerPri(ev.priority);
        const repeatBadge = ev.recurrenceId
          ? `<span class="planner-badge" style="background:#6366f122;color:#6366f1;border-color:#6366f155;">🔁 ${PLANNER_REPEAT_LABELS[ev.recurrenceType] || 'Repeats'}</span>`
          : '';
        const urgency = plannerUrgencyBadge(ev.date);
        const urgencyBadge = urgency
          ? `<span class="planner-badge" style="background:${urgency.color}22;color:${urgency.color};border-color:${urgency.color}55;">${urgency.emoji} ${urgency.label}</span>`
          : '';
        return `
<div class="planner-card" id="plannerCard_${ev.id}">
<div class="planner-card-head">
<div class="planner-card-title">🎯 ${escapeHtml(ev.title)}</div>
<div style="display:flex;gap:2px;flex-shrink:0;">
<button class="planner-del" onclick="editPlannerEvent('${ev.id}')" title="Edit event">✎</button>
<button class="planner-del" onclick="deletePlannerEvent('${ev.id}')" title="Delete this occurrence">✕</button>
</div>
</div>
<div class="planner-badges">
${urgencyBadge}
<span class="planner-badge" style="background:${cat.color}22;color:${cat.color};border-color:${cat.color}55;">${cat.emoji} ${cat.label}</span>
<span class="planner-badge" style="background:${pri.color}22;color:${pri.color};border-color:${pri.color}55;">${pri.emoji} ${pri.label} priority</span>
${repeatBadge}
</div>
<div class="planner-card-meta">📅 ${formatPlannerDate(ev.date)}</div>
${ev.startTime || ev.endTime ? `<div class="planner-card-meta">⏰ ${formatPlannerTime(ev.startTime)}${ev.endTime ? ' – ' + formatPlannerTime(ev.endTime) + (ev.startTime && ev.endTime <= ev.startTime ? ' <span style="opacity:0.7;">(next day)</span>' : '') : ''}</div>` : ''}
${ev.location ? `<div class="planner-card-meta">📍 ${escapeHtml(ev.location)}</div>` : ''}
${ev.notes ? `<div class="planner-card-notes">${escapeHtml(ev.notes)}</div>` : ''}
<div class="planner-card-meta">🔔 ${plannerReminderLabel(ev.reminder)}</div>
<div class="planner-card-actions">
<button class="btn-gcal" onclick="syncPlannerEvent('${ev.id}', this)">
<svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19.5 3h-2.25V1.5h-1.5V3h-7.5V1.5h-1.5V3H4.5A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zm0 16.5h-15V9h15v10.5zm0-12h-15V4.5h2.25V6h1.5V4.5h7.5V6h1.5V4.5h2.25V7.5z" fill="#4285F4"/></svg>
Add to Google Calendar
</button>

${ev.recurrenceId ? `<button class="planner-del" style="border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:0.68rem;" onclick="deletePlannerSeries('${ev.recurrenceId}')" title="Delete entire series">🗑 Delete series</button>` : ''}
</div>
<div class="planner-sync-label" id="plannerSynced_${ev.id}">${ev.synced ? '✅ Synced to Google Calendar' : ''}</div>
</div>
`;
      })
      .join('');
  if (countEl)
    countEl.textContent =
      filtered.length === plannerEvents.length
        ? `${plannerEvents.length} event${plannerEvents.length !== 1 ? 's' : ''}`
        : `${filtered.length} of ${plannerEvents.length} event${plannerEvents.length !== 1 ? 's' : ''}`;
}

function _plannerResetForm() {
  document.getElementById('plTitle').value = '';
  document.getElementById('plDate').value = '';
  document.getElementById('plStart').value = '';
  document.getElementById('plEnd').value = '';
  document.getElementById('plLocation').value = '';
  document.getElementById('plNotes').value = '';
  document.getElementById('plReminder').value = '30';
  document.getElementById('plCategory').value = 'other';
  document.getElementById('plPriority').value = 'medium';
  document.getElementById('plRepeat').value = 'none';
  document.getElementById('plRepeat').disabled = false;
  document.getElementById('plRepeatUntil').value = '';
  document.getElementById('plRepeatUntilWrap').style.display = 'none';
  document.getElementById('plRepeatEditNote').style.display = 'none';
  plannerEditingId = null;
  const addBtn = document.getElementById('plAddBtn');
  const cancelBtn = document.getElementById('plCancelEditBtn');
  if (addBtn) addBtn.textContent = '+ Add Event';
  if (cancelBtn) cancelBtn.style.display = 'none';
  const errEl = document.getElementById('plannerError');
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.remove('visible');
  }
}

function editPlannerEvent(id) {
  const ev = plannerEvents.find((e) => e.id === id);
  if (!ev) return;
  plannerEditingId = id;
  document.getElementById('plTitle').value = ev.title || '';
  document.getElementById('plDate').value = ev.date || '';
  document.getElementById('plStart').value = ev.startTime || '';
  document.getElementById('plEnd').value = ev.endTime || '';
  document.getElementById('plLocation').value = ev.location || '';
  document.getElementById('plNotes').value = ev.notes || '';
  document.getElementById('plReminder').value = String(ev.reminder || 0);
  document.getElementById('plCategory').value = ev.category || 'other';
  document.getElementById('plPriority').value = ev.priority || 'medium';
  // A single occurrence of a series is edited on its own — the repeat
  // controls are locked so editing one date never regenerates the series.
  document.getElementById('plRepeat').value = 'none';
  document.getElementById('plRepeat').disabled = !!ev.recurrenceId;
  document.getElementById('plRepeatUntilWrap').style.display = 'none';
  document.getElementById('plRepeatEditNote').style.display = ev.recurrenceId ? 'block' : 'none';
  const addBtn = document.getElementById('plAddBtn');
  const cancelBtn = document.getElementById('plCancelEditBtn');
  if (addBtn) addBtn.textContent = 'Save Changes';
  if (cancelBtn) cancelBtn.style.display = 'inline';
  addBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelPlannerEdit() {
  _plannerResetForm();
}

function addPlannerEvent() {
  const title = document.getElementById('plTitle').value.trim();
  const date = document.getElementById('plDate').value;
  const startTime = document.getElementById('plStart').value;
  const endTime = document.getElementById('plEnd').value;
  const location = document.getElementById('plLocation').value.trim();
  const notes = document.getElementById('plNotes').value.trim();
  const reminder = parseInt(document.getElementById('plReminder').value, 10) || 0;
  const category = document.getElementById('plCategory').value || 'other';
  const priority = document.getElementById('plPriority').value || 'medium';
  const repeat = document.getElementById('plRepeat').value || 'none';
  const repeatUntil = document.getElementById('plRepeatUntil').value;
  const errEl = document.getElementById('plannerError');

  if (!title) {
    errEl.textContent = 'Please enter an event title.';
    errEl.classList.add('visible');
    return;
  }
  if (!date) {
    errEl.textContent = 'Please select a date.';
    errEl.classList.add('visible');
    return;
  }
  if (repeat !== 'none' && !plannerEditingId) {
    if (!repeatUntil) {
      errEl.textContent = 'Please choose an end date for the repeat.';
      errEl.classList.add('visible');
      return;
    }
    if (repeatUntil < date) {
      errEl.textContent = '"Repeat until" must be on or after the event date.';
      errEl.classList.add('visible');
      return;
    }
  }
  errEl.textContent = '';
  errEl.classList.remove('visible');

  if (plannerEditingId) {
    const ev = plannerEvents.find((e) => e.id === plannerEditingId);
    if (ev) {
      Object.assign(ev, { title, date, startTime, endTime, location, notes, reminder, category, priority, synced: false });
    }
    _plannerSave();
    renderPlannerEvents();
    _plannerResetForm();
    showToast('Event updated! Re-sync it to Google Calendar to update the reminder there too.', 'success');
    return;
  }

  if (repeat !== 'none') {
    const dates = plannerGenerateRecurrenceDates(date, repeat, repeatUntil);
    const recurrenceId = 'plrec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    dates.forEach((d) => {
      plannerEvents.push({
        id: 'pl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        title,
        date: d,
        startTime,
        endTime,
        location,
        notes,
        reminder,
        category,
        priority,
        recurrenceId,
        recurrenceType: repeat,
        synced: false,
      });
    });
    _plannerSave();
    renderPlannerEvents();
    _plannerResetForm();
    showToast(`${dates.length} recurring event(s) added! Sync them to Google Calendar below.`, 'success');
    return;
  }

  plannerEvents.push({
    id: 'pl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    title,
    date,
    startTime,
    endTime,
    location,
    notes,
    reminder,
    category,
    priority,
    synced: false,
  });
  _plannerSave();
  renderPlannerEvents();
  _plannerResetForm();

  showToast('Event added! Sync it to Google Calendar below to get your reminder.', 'success');
}

function deletePlannerEvent(id) {
  const ev = plannerEvents.find((e) => e.id === id);
  if (!ev) return;
  if (!confirm(`Delete "${ev.title}"?`)) return;
  plannerEvents = plannerEvents.filter((e) => e.id !== id);
  _plannerSave();
  renderPlannerEvents();
  if (ev.synced) {
    withGCalToken(
      async () => {
        try {
          const map = _gcalLoad(GCAL_STORE_PLANNER);
          if (map[id]) {
            await deleteGCalEvent(map[id]);
            delete map[id];
            _gcalSave(GCAL_STORE_PLANNER, map);
          }
        } catch (e) {
          /* best-effort cleanup only */
        }
      },
      () => {},
    );
  }
  showUndoToast(`"${ev.title}" deleted.`, () => {
    // Restored locally as unsynced — if it was on Google Calendar before,
    // re-sync it from its card to put the reminder back.
    plannerEvents.push({ ...ev, synced: false });
    _plannerSave();
    renderPlannerEvents();
    showToast('Event restored.', 'success');
  });
}

function deletePlannerSeries(recurrenceId) {
  if (!recurrenceId) return;
  const toRemove = plannerEvents.filter((e) => e.recurrenceId === recurrenceId);
  if (!toRemove.length) return;
  if (!confirm(`Delete all ${toRemove.length} occurrences in this repeating series?`)) return;
  plannerEvents = plannerEvents.filter((e) => e.recurrenceId !== recurrenceId);
  _plannerSave();
  renderPlannerEvents();
  const synced = toRemove.filter((e) => e.synced);
  if (synced.length) {
    withGCalToken(
      async () => {
        const map = _gcalLoad(GCAL_STORE_PLANNER);
        for (const ev of synced) {
          try {
            if (map[ev.id]) {
              await deleteGCalEvent(map[ev.id]);
              delete map[ev.id];
            }
          } catch (e) {
            /* best-effort cleanup only */
          }
        }
        _gcalSave(GCAL_STORE_PLANNER, map);
      },
      () => {},
    );
  }
  showUndoToast(`${toRemove.length} recurring event(s) deleted.`, () => {
    plannerEvents.push(...toRemove.map((ev) => ({ ...ev, synced: false })));
    _plannerSave();
    renderPlannerEvents();
    showToast('Series restored.', 'success');
  });
}

function buildPlannerEvent(ev) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Nairobi';
  const pad = (n) => String(n).padStart(2, '0');
  let startObj, endObj;

  if (ev.startTime) {
    const [y, mo, d] = ev.date.split('-').map(Number);
    const startDateObj = new Date(y, mo - 1, d);
    const [sh, sm] = ev.startTime.split(':').map(Number);
    const startDT = `${ev.date}T${pad(sh)}:${pad(sm)}:00`;
    let endDT;
    if (ev.endTime) {
      const [eh, em] = ev.endTime.split(':').map(Number);
      // If the end time is at or before the start time, treat it as
      // rolling past midnight into the next day (e.g. 8 PM – 2 AM).
      const endsNextDay = eh * 60 + em <= sh * 60 + sm;
      const endDateObj = new Date(startDateObj);
      if (endsNextDay) endDateObj.setDate(endDateObj.getDate() + 1);
      const endDateStr = `${endDateObj.getFullYear()}-${pad(endDateObj.getMonth() + 1)}-${pad(endDateObj.getDate())}`;
      endDT = `${endDateStr}T${pad(eh)}:${pad(em)}:00`;
    } else {
      const endHourFloat = sh + sm / 60 + 1; // default 1-hour duration if no end time given
      const eh = Math.floor(endHourFloat) % 24,
        em = Math.round((endHourFloat % 1) * 60);
      endDT = `${ev.date}T${pad(eh)}:${pad(em)}:00`;
    }
    startObj = { dateTime: startDT, timeZone: tz };
    endObj = { dateTime: endDT, timeZone: tz };
  } else {
    const [y, mo, d] = ev.date.split('-').map(Number);
    const nextDay = new Date(y, mo - 1, d);
    nextDay.setDate(nextDay.getDate() + 1);
    startObj = { date: ev.date };
    endObj = { date: `${nextDay.getFullYear()}-${pad(nextDay.getMonth() + 1)}-${pad(nextDay.getDate())}` };
  }

  return {
    summary: ev.title,
    location: ev.location || '',
    description: ev.notes || '',
    start: startObj,
    end: endObj,
    reminders: ev.reminder
      ? { useDefault: false, overrides: [{ method: 'popup', minutes: parseInt(ev.reminder, 10) }] }
      : { useDefault: false, overrides: [] },
    colorId: GCAL_COLOR_PLANNER,
  };
}

function syncPlannerEvent(id, btnEl) {
  const ev = plannerEvents.find((e) => e.id === id);
  if (!ev) return;
  withGCalToken(
    async () => {
      const orig = btnEl ? btnEl.innerHTML : '';
      if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = '⏳ Syncing…';
      }
      try {
        await upsertGCalEvent(id, GCAL_STORE_PLANNER, buildPlannerEvent(ev));
        ev.synced = true;
        _plannerSave();
        const label = document.getElementById('plannerSynced_' + id);
        if (label) label.textContent = '✅ Synced to Google Calendar';
        showToast(`"${ev.title}" synced to your Google Calendar with a reminder set.`, 'success');
        _setLastSync('planner');
      } catch (err) {
        console.error(err);
        showToast('Failed to sync this event to Google Calendar. Please check your connection and try again.\n' + err.message, 'error');
      } finally {
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.innerHTML = orig;
        }
      }
    },
    () => {
      showToast('Google sign-in was cancelled or timed out. Tap "Add to Google Calendar" again to retry.', 'error');
    },
  );
}

function syncAllPlannerEvents() {
  if (!plannerEvents.length) {
    showToast('No personal events to sync yet. Add one first.', 'error');
    return;
  }
  withGCalToken(async () => {
    const btn = document.getElementById('plannerSyncAllBtn');
    const orig = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Syncing…';
    }
    try {
      let count = 0;
      for (const ev of plannerEvents) {
        await upsertGCalEvent(ev.id, GCAL_STORE_PLANNER, buildPlannerEvent(ev));
        ev.synced = true;
        count++;
        if (btn) btn.innerHTML = `⏳ ${count}/${plannerEvents.length}…`;
      }
      _plannerSave();
      renderPlannerEvents();
      showToast(`${count} personal event(s) synced to your Google Calendar!`, 'success');
      _setLastSync('planner');
    } catch (err) {
      console.error(err);
      showToast('Failed to sync some events. Please check your connection and try again.\n' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    }
  });
}
