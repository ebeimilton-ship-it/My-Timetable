/* ──────────────────────────────────────────────────────────────
   study.js — Group Discussion and Personal Study/CAT modes.
   ────────────────────────────────────────────────────────────── */

const GRP_BLOCK_LABEL_MAX = 60;

const GRP_DAY_START = 5;
const GRP_DAY_END = 23;

let _grpPrevWeekStart = null;
function grpWeekChanged() {
  const el = document.getElementById('grpWeekStart');
  if (Object.keys(grpSessionBlocks).length && _grpPrevWeekStart && el.value !== _grpPrevWeekStart) {
    if (!confirm('Changing the week will apply your existing discussion sessions to the new week dates. Continue?')) {
      el.value = _grpPrevWeekStart;
      grpUpdateWeekEnd();
      return;
    }
  }
  _grpPrevWeekStart = el.value;
  grpUpdateWeekEnd();
  grpSessionDayChanged();
  saveGroupDraft();
}

function saveGroupDraft() {
  saveDraft('mts_draft_group', {
    members: grpMembers,
    units: grpUnits,
    sessions: grpSessionBlocks,
    weekStart: document.getElementById('grpWeekStart').value,
  });
}

function restoreGroupDraft() {
  const draft = loadDraft('mts_draft_group');
  if (!draft) return;
  const hasData =
    (Array.isArray(draft.members) && draft.members.length) ||
    (Array.isArray(draft.units) && draft.units.length) ||
    (draft.sessions && Object.keys(draft.sessions).length);
  if (!hasData) return;
  if (Array.isArray(draft.members)) grpMembers = draft.members;
  if (Array.isArray(draft.units)) grpUnits = draft.units;
  if (draft.sessions && typeof draft.sessions === 'object') grpSessionBlocks = draft.sessions;
  if (draft.weekStart) {
    const weekStartEl = document.getElementById('grpWeekStart');
    if (weekStartEl) {
      weekStartEl.value = draft.weekStart;
      _grpPrevWeekStart = draft.weekStart;
      grpUpdateWeekEnd();
    }
  }
  grpRenderMembers();
  grpRenderUnits();
  grpRenderSessionList();
}

function grpUpdateWeekEnd() {
  const startVal = document.getElementById('grpWeekStart').value;
  const endEl = document.getElementById('grpWeekEnd');
  if (!endEl) return;
  if (!startVal) {
    endEl.value = '';
    return;
  }
  const [y, m, d] = startVal.split('-').map(Number);
  const picked = new Date(y, m - 1, d);
  const end = new Date(picked);
  end.setDate(picked.getDate() + 6);
  const pad = (n) => String(n).padStart(2, '0');
  endEl.value = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

function grpSessionDayChanged() {
  const dayEl = document.getElementById('grpSessionDay');
  const dateEl = document.getElementById('grpSessionDayDate');
  if (!dayEl || !dateEl) return;
  if (!dayEl.value) {
    dateEl.textContent = '';
    return;
  }
  const dt = grpDateForDay(dayEl.value);
  dateEl.textContent = '📅 ' + dt.toLocaleDateString('en-KE', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

function grpInit() {
  populateTimeSelect(document.getElementById('grpSessionStart'), 5, 22.5);
  document.getElementById('grpSessionStart').value = 8;

  const weekStartEl = document.getElementById('grpWeekStart');
  if (weekStartEl) {
    weekStartEl.min = todayISO();
    if (!weekStartEl.value) {
      const today = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      weekStartEl.value = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    }
  }
  _grpPrevWeekStart = document.getElementById('grpWeekStart').value;
  grpUpdateWeekEnd();
}

function grpWeekLabel() {
  const weekStartVal = document.getElementById('grpWeekStart').value;
  if (!weekStartVal) return '';
  const [y, m, d] = weekStartVal.split('-').map(Number);
  const picked = new Date(y, m - 1, d);
  const end = new Date(picked);
  end.setDate(picked.getDate() + 6);
  const fmt = (dt) => dt.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
  return `Week of ${fmt(picked)} – ${fmt(end)}`;
}

function grpAddMember() {
  const name = document.getElementById('grpMemberName').value.trim();
  const reg = document.getElementById('grpMemberReg').value.trim();
  if (!name) return;
  grpMembers.push({ name, reg });
  document.getElementById('grpMemberName').value = '';
  document.getElementById('grpMemberReg').value = '';
  grpRenderMembers();
}

function grpRenderMembers() {
  const container = document.getElementById('grpMemberTags');
  container.innerHTML = grpMembers
    .map(
      (m, i) => `
<div class="unit-tag">
<span>👤 ${escapeHtml(m.name)}${m.reg ? ' · ' + escapeHtml(m.reg) : ''}</span>
<span class="rm" onclick="grpRemoveMember(${i})">×</span>
</div>`,
    )
    .join('');
  document.getElementById('grpMemberCount').textContent = `${grpMembers.length} member${grpMembers.length !== 1 ? 's' : ''} added`;
  saveGroupDraft();
}

function grpRemoveMember(i) {
  grpMembers.splice(i, 1);
  grpRenderMembers();
}

function grpLoadFromGCal() {
  const statusEl = document.getElementById('grpGCalStatus');
  const noticeEl = document.getElementById('grpNoSyncNotice');
  statusEl.style.display = 'block';
  statusEl.style.color = 'var(--muted)';
  noticeEl.style.display = 'none';
  statusEl.textContent = '⏳ Connecting to Google Calendar…';
  withGCalToken(
    async () => {
      try {
        const events = await fetchGCalClassEvents();
        if (!events.length) {
          statusEl.style.display = 'none';
          noticeEl.style.display = 'block';
          return;
        }

        let added = 0;
        for (const ev of events) {
          const dup = grpUnits.find((u) => u.code === ev.code);
          if (!dup) {
            grpUnits.push({ code: ev.code, name: ev.name });
            added++;
          }
        }
        statusEl.style.color = '#22c55e';
        statusEl.textContent = `✅ Imported ${added} unit${added !== 1 ? 's' : ''} from Google Calendar.`;
        grpRenderUnits();
      } catch (e) {
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = '❌ Failed to load from Google Calendar. Please try again.';
      }
    },
    () => {
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = '❌ Google sign-in was cancelled or failed. Please try again.';
    },
  );
}

function grpAddManualUnit() {
  const errEl = document.getElementById('grpManualError');
  const codeEl = document.getElementById('grpManualCode');
  const nameEl = document.getElementById('grpManualName');
  const code = codeEl.value.trim().toUpperCase();
  const name = nameEl.value.trim();

  if (!code || !name) {
    errEl.textContent = 'Please enter both a unit code and a unit name.';
    return;
  }
  if (grpUnits.some((u) => u.code === code)) {
    errEl.textContent = 'That unit code has already been added.';
    return;
  }

  errEl.textContent = '';
  grpUnits.push({ code, name, manual: true });
  codeEl.value = '';
  nameEl.value = '';
  document.getElementById('grpNoSyncNotice').style.display = 'none';
  grpRenderUnits();
}

function grpRenderUnits() {
  const container = document.getElementById('grpUnitTags');
  container.innerHTML = grpUnits
    .map((u, i) => {
      if (grpEditingIndex === i) {
        return `
<div class="unit-tag" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:var(--bg);border:1px solid var(--accent);">
<input type="text" id="grpEditCode${i}" value="${escapeHtml(u.code)}" style="width:90px;max-width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:4px 6px;font-family:'Inter',sans-serif;font-size:0.7rem;outline:none;" />
<input type="text" id="grpEditName${i}" value="${escapeHtml(u.name)}" style="width:140px;max-width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:4px 6px;font-family:'Inter',sans-serif;font-size:0.7rem;outline:none;" />
<span class="rm" style="color:var(--accent);" onclick="grpSaveUnitEdit(${i})">✓</span>
<span class="rm" onclick="grpCancelUnitEdit()">×</span>
</div>`;
      }
      return `
<div class="unit-tag">
<span onclick="grpEditUnit(${i})" style="cursor:pointer;" title="Tap to edit">${escapeHtml(u.code)} – ${escapeHtml(u.name)}</span>
<span class="rm" onclick="grpRemoveUnit(${i})">×</span>
</div>`;
    })
    .join('');
  document.getElementById('grpUnitCount').textContent = `${grpUnits.length} unit${grpUnits.length !== 1 ? 's' : ''} loaded`;
  grpRefreshSessionUnitOptions();
  saveGroupDraft();
}

function grpEditUnit(i) {
  grpEditingIndex = i;
  grpRenderUnits();
  const codeEl = document.getElementById(`grpEditCode${i}`);
  if (codeEl) codeEl.focus();
}

function grpCancelUnitEdit() {
  grpEditingIndex = null;
  grpRenderUnits();
}

function grpBuildLabel(code, venue, notes) {
  return `📚 ${code}\u001F${venue || ''}\u001F${notes || ''}`;
}
function grpParseLabel(label) {
  const rest = label.replace(/^📚\s*/, '');
  const parts = rest.split('\u001F');
  if (parts.length >= 3) return { code: parts[0], venue: parts[1], notes: parts[2] };

  const sepIdx = parts[0].indexOf(' — ');
  return sepIdx !== -1
    ? { code: parts[0].slice(0, sepIdx), venue: '', notes: parts[0].slice(sepIdx + 3) }
    : { code: parts[0], venue: '', notes: '' };
}

function grpSaveUnitEdit(i) {
  const codeEl = document.getElementById(`grpEditCode${i}`);
  const nameEl = document.getElementById(`grpEditName${i}`);
  const code = codeEl.value.trim().toUpperCase();
  const name = nameEl.value.trim();
  if (!code || !name) return;
  if (grpUnits.some((u, idx) => idx !== i && u.code === code)) return;

  const oldCode = grpUnits[i].code;
  grpUnits[i].code = code;
  grpUnits[i].name = name;
  if (oldCode !== code) {
    const oldPrefix = `📚 ${oldCode}`;
    const newPrefix = `📚 ${code}`;
    Object.keys(grpSessionBlocks).forEach((k) => {
      if (
        grpSessionBlocks[k] === oldPrefix ||
        grpSessionBlocks[k].startsWith(oldPrefix + '\u001F') ||
        grpSessionBlocks[k].startsWith(oldPrefix + ' ')
      ) {
        grpSessionBlocks[k] = newPrefix + grpSessionBlocks[k].slice(oldPrefix.length);
      }
    });
  }
  grpEditingIndex = null;
  grpRenderUnits();
  grpRenderSessionList();
  if (grpScheduleBuilt) grpShowSchedule(false);
}

function grpRemoveUnit(i) {
  grpUnits.splice(i, 1);
  grpRenderUnits();
}

function grpRefreshSessionUnitOptions() {
  const sel = document.getElementById('grpSessionUnit');
  if (!sel) return;
  const prevValue = sel.value;
  const seen = new Map();
  grpUnits.forEach((u) => {
    if (!seen.has(u.code)) seen.set(u.code, u.name);
  });
  sel.innerHTML =
    '<option value="">Select a unit…</option>' +
    [...seen.entries()]
      .map(([code, name]) => `<option value="${escapeHtml(code)}">${escapeHtml(code)} – ${escapeHtml(name)}</option>`)
      .join('');
  if (seen.has(prevValue)) sel.value = prevValue;
}

function grpAddSession() {
  const errEl = document.getElementById('grpSessionError');
  const sel = document.getElementById('grpSessionUnit');
  const code = sel.value;
  const day = document.getElementById('grpSessionDay').value;
  const start = parseFloat(document.getElementById('grpSessionStart').value);
  const duration = parseFloat(document.getElementById('grpSessionDuration').value);
  const end = start + duration;
  const venue = document.getElementById('grpSessionVenue').value.trim().slice(0, GRP_BLOCK_LABEL_MAX);
  const notes = document.getElementById('grpSessionNotes').value.trim().slice(0, GRP_BLOCK_LABEL_MAX);

  if (!code) {
    errEl.textContent = 'Please select a unit (add it manually or import from Google Calendar in Step 3).';
    return;
  }
  if (!day) {
    errEl.textContent = 'Please select a day.';
    return;
  }
  if (isNaN(start) || isNaN(duration)) {
    errEl.textContent = 'Please choose a valid start time and duration.';
    return;
  }

  const dayStart = GRP_DAY_START;
  const dayEnd = GRP_DAY_END;
  if (start < dayStart || end > dayEnd) {
    errEl.textContent = `Please keep the time within ${fmtHour(dayStart)} – ${fmtHour(dayEnd)}.`;
    return;
  }

  for (let h = start; h < end; h += 0.5) {
    if (grpSessionBlocks[`${day}_${h}`]) {
      errEl.textContent = `${day} ${fmtHour(h)} already has a session — pick a different time.`;
      return;
    }
  }

  errEl.textContent = '';
  const label = grpBuildLabel(code, venue, notes);
  for (let h = start; h < end; h += 0.5) {
    grpSessionBlocks[`${day}_${h}`] = label;
  }

  document.getElementById('grpSessionUnit').value = '';
  document.getElementById('grpSessionDay').value = '';
  grpSessionDayChanged();
  document.getElementById('grpSessionStart').value = 8;
  document.getElementById('grpSessionDuration').value = 1;
  document.getElementById('grpSessionVenue').value = '';
  document.getElementById('grpSessionNotes').value = '';
  grpRenderSessionList();
}

function grpGetSessions() {
  const sessions = [];
  ALL_DAYS.forEach((day) => {
    const dayStart = GRP_DAY_START;
    const dayEnd = GRP_DAY_END;
    let h = dayStart;
    while (h < dayEnd) {
      const label = grpSessionBlocks[`${day}_${h}`];
      if (label) {
        let end = h + 0.5;
        while (end < dayEnd && grpSessionBlocks[`${day}_${end}`] === label) end += 0.5;
        sessions.push({ day, start: h, end, label });
        h = end;
      } else {
        h += 0.5;
      }
    }
  });
  return sessions;
}

function grpRenderSessionList() {
  const container = document.getElementById('grpSessionList');
  const sessions = grpGetSessions();
  if (!sessions.length) {
    container.innerHTML = '';
    saveGroupDraft();
    return;
  }
  container.innerHTML = sessions
    .map((s, i) => {
      const { code, venue, notes } = grpParseLabel(s.label);
      const unit = grpUnits.find((u) => u.code === code);
      const desc = escapeHtml((unit ? `${code} – ${unit.name}` : code) + (notes ? ` — ${notes}` : ''));
      return `
<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 12px;">
<div style="font-size:0.82rem;color:var(--text);cursor:pointer;" onclick="grpEditSession(${i})" title="Tap to edit">
<span style="font-family:var(--font-display);font-weight:700;color:#22c55e;">${s.day}</span>
<span style="color:var(--muted);"> · ${fmtHour(s.start)} – ${fmtHour(s.end)}${venue ? ' · 📍 ' + escapeHtml(venue) : ''} · </span>${desc}
</div>
<span class="rm" onclick="grpRemoveSession(${i})">×</span>
</div>`;
    })
    .join('');
  saveGroupDraft();
}

function grpEditSession(i) {
  const sessions = grpGetSessions();
  const s = sessions[i];
  if (!s) return;

  const { code, venue, notes } = grpParseLabel(s.label);

  for (let h = s.start; h < s.end; h += 0.5) delete grpSessionBlocks[`${s.day}_${h}`];

  document.getElementById('grpSessionUnit').value = code;
  document.getElementById('grpSessionDay').value = s.day;
  grpSessionDayChanged();
  document.getElementById('grpSessionStart').value = s.start;
  document.getElementById('grpSessionDuration').value = s.end - s.start;
  document.getElementById('grpSessionVenue').value = venue;
  document.getElementById('grpSessionNotes').value = notes;
  document.getElementById('grpSessionError').textContent =
    'Editing this session — adjust the fields above, then tap "+ Add Discussion Session" to save it.';

  grpRenderSessionList();
  if (grpScheduleBuilt) grpShowSchedule(false);
  document.getElementById('grpSessionUnit').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function grpRemoveSession(i) {
  const sessions = grpGetSessions();
  const s = sessions[i];
  if (!s) return;
  for (let h = s.start; h < s.end; h += 0.5) delete grpSessionBlocks[`${s.day}_${h}`];
  grpRenderSessionList();
  if (grpScheduleBuilt) grpShowSchedule(false);
}

function grpClearSessions() {
  if (!Object.keys(grpSessionBlocks).length) return;
  if (confirm('Clear all discussion sessions? This cannot be undone.')) {
    grpSessionBlocks = {};
    grpRenderSessionList();
    grpShowSchedule(false);
  }
}

function grpDateForDay(dayName) {
  const ORDER = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  const weekStartVal = document.getElementById('grpWeekStart').value;
  const [y, m, d] = weekStartVal ? weekStartVal.split('-').map(Number) : [null, null, null];
  const picked = y ? new Date(y, m - 1, d) : new Date();

  const startDow = picked.getDay();
  const targetDow = ORDER[dayName] ?? startDow;
  const diff = (targetDow - startDow + 7) % 7;
  const result = new Date(picked);
  result.setDate(picked.getDate() + diff);
  return result;
}

function buildGroupSessionEvent(session) {
  // FIX: Proper validation of session data
  if (!session.day || !session.label) {
    throw new Error('Invalid session: missing day or label');
  }
  if (typeof session.start !== 'number' || typeof session.end !== 'number') {
    throw new Error(`Invalid session times: start=${session.start}, end=${session.end}`);
  }

  const { code, venue, notes } = grpParseLabel(session.label);
  const unit = grpUnits.find((u) => u.code === code);
  const name = unit ? unit.name : '';
  const startDate = grpDateForDay(session.day);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Nairobi';

  // FIX: Only include location if it exists
  const location = venue && venue.trim() ? venue : undefined;

  return {
    summary: `Group Discussion: ${code}${name ? ' – ' + name : ''}`,
    description: `Group Discussion\nUnit: ${name}\nCode: ${code}${venue ? '\nVenue: ' + venue : ''}${notes ? '\nNotes: ' + notes : ''}`,
    location: location,
    start: { dateTime: isoDateTime(startDate, session.start), timeZone: tz },
    end: { dateTime: isoDateTime(startDate, session.end), timeZone: tz },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] },
    colorId: GCAL_COLOR_GROUP,
  };
}

const GCAL_STORE_GROUP = 'mts_gcal_group_ids';
function _groupEventKey(session) {
  return `${session.day}_${session.start}_${session.end}`;
}

async function syncGroupToGCal() {
  const sessions = grpGetSessions();
  if (!sessions.length) {
    showToast('No discussion sessions to sync. Add a session first.', 'error');
    return;
  }

  const weekStartVal = document.getElementById('grpWeekStart').value;
  if (weekStartVal) {
    const [y, m, d] = weekStartVal.split('-').map(Number);
    const picked = new Date(y, m - 1, d);
    const weekEnd = new Date(picked);
    weekEnd.setDate(picked.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const today = new Date();
    if (weekEnd < today) {
      const proceed = confirm(`The week of ${weekStartVal} has already passed. Sync anyway?`);
      if (!proceed) return;
    }
  }
  withGCalToken(async () => {
    const btn = document.querySelector('#grpResults .btn-gcal');
    const orig = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Syncing…';
    }
    try {
      const currentKeys = new Set(sessions.map(_groupEventKey));

      await pruneRemovedEvents(currentKeys, GCAL_STORE_GROUP, true);

      let count = 0;
      for (const session of sessions) {
        const key = _groupEventKey(session);
        await upsertGCalEvent(key, GCAL_STORE_GROUP, buildGroupSessionEvent(session));
        count++;
        if (btn) btn.innerHTML = `⏳ ${count}/${sessions.length}…`;
      }

      showToast(
        `${count} discussion session(s) synced to your Google Calendar for the week of ${document.getElementById('grpWeekStart').value}!\nExisting sessions were updated and removed sessions were deleted. Each has a 30-min reminder. This covers one week only — build a new schedule and sync again next week. If you don't see them yet, refresh your calendar app.`,
        'success',
      );
      _setLastSync('group');
    } catch (err) {
      console.error(err);
      showToast('Failed to sync some discussion sessions. Please try again.\n' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    }
  });
}

function grpBuildSchedule() {
  const errEl = document.getElementById('grpSessionError');
  if (!grpGetSessions().length) {
    errEl.textContent = 'Add at least one discussion session above before building your schedule.';
    return;
  }
  errEl.textContent = '';
  const btn = document.getElementById('grpGenerateBtn');
  if (btn) {
    if (btn.disabled) return;
    btn.dataset.origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ Building…';
  }
  setTimeout(() => {
    grpScheduleBuilt = true;
    grpShowSchedule(true);
    if (btn) flashBuildSuccess(btn, btn.dataset.origHtml, '✓ Group Schedule Built!');
  }, 80);
}

function grpShowSchedule(scroll = true) {
  const sessions = grpGetSessions();
  if (!sessions.length) {
    document.getElementById('grpResults').style.display = 'none';
    return;
  }

  const bodyHtml = sessions
    .map((s, i) => {
      const { code, venue, notes } = grpParseLabel(s.label);
      const unit = grpUnits.find((u) => u.code === code);
      const name = unit ? unit.name : '';
      return `
<tr class="clickable" onclick="grpEditSession(${i})" title="Tap to edit">
<td class="num">${i + 1}</td>
<td><div class="exam-cell"><div class="cell-code">${escapeHtml(code)}</div></div></td>
<td class="left">${escapeHtml(name)}</td>
<td class="strong">${s.day}</td>
<td class="time">${fmtHour(s.start)} – ${fmtHour(s.end)}</td>
<td class="muted">${escapeHtml(venue)}</td>
<td class="left muted">${escapeHtml(notes)}</td>
</tr>`;
    })
    .join('');

  const html = `
<table class="tt-table">
<thead>
<tr>
<th>#</th>
<th>Code</th>
<th class="left">Unit Name</th>
<th>Day</th>
<th>Time</th>
<th>Venue</th>
<th class="left">Notes</th>
</tr>
</thead>
<tbody>${bodyHtml}</tbody>
</table>
`;

  document.getElementById('grpGrid').innerHTML = html;

  renderFunnyComment(
    'funnyComment_group',
    generateClassBanner(
      sessions.map((s) => ({ day: s.day, start: s.start, end: s.end })),
      { only: ['motivation', 'masenoTip'] },
    ),
  );

  const grpWeekStartVal = document.getElementById('grpWeekStart').value;
  const grpPayload = { members: grpMembers, units: grpUnits, sessions: grpSessionBlocks, weekStart: grpWeekStartVal };
  const grpQuery = `group=${encodeURIComponent(JSON.stringify(grpPayload))}`;
  const grpLinkEl = document.getElementById('grpShareLink');
  if (grpLinkEl) grpLinkEl.value = `${location.origin}${location.pathname}?${grpQuery}`;
  try {
    history.replaceState(null, '', `?${grpQuery}`);
  } catch (e) {}

  if (grpScheduleBuilt) {
    document.getElementById('grpResults').style.display = 'block';
    if (scroll) document.getElementById('grpResults').scrollIntoView({ behavior: 'smooth' });
  }
}

function copyGroupLink() {
  copyShareLink('grpShareLink', 'grpCopyBtn', 'Copy Editable Link', 'group');
}

function loadGroupFromURL() {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('group');
  if (!data) {
    restoreGroupDraft();
    return;
  }
  try {
    const payload = JSON.parse(data);
    if (Array.isArray(payload.members)) grpMembers = payload.members;
    if (Array.isArray(payload.units)) grpUnits = payload.units;
    if (payload.sessions && typeof payload.sessions === 'object') grpSessionBlocks = payload.sessions;
    if (payload.weekStart) {
      const weekStartEl = document.getElementById('grpWeekStart');
      if (weekStartEl) {
        weekStartEl.value = payload.weekStart;
        _grpPrevWeekStart = payload.weekStart;
        grpUpdateWeekEnd();
      }
    }
    selectMode('group', { skipHistoryPush: true });
    grpRenderMembers();
    grpRenderUnits();
    grpRenderSessionList();
    if (grpGetSessions().length) {
      grpScheduleBuilt = true;
      grpShowSchedule(false);
    }
  } catch (e) {
    console.warn('Failed to restore shared group link:', e);
  }
}

function grpCopyWA() {
  const sessions = grpGetSessions();
  const members = grpMembers.map((m) => m.name).join(', ') || 'Our group';
  const weekLabel = grpWeekLabel();
  let text = `📚 *Group Discussion Timetable*\n👥 ${members}` + (weekLabel ? `\n🗓 ${weekLabel}\n\n` : '\n\n');
  sessions.forEach((s, i) => {
    const { code, venue, notes } = grpParseLabel(s.label);
    const unit = grpUnits.find((u) => u.code === code);
    const name = unit ? unit.name : '';
    text += `${i + 1}. *${code}*${name ? ' — ' + name : ''}\n   📅 ${s.day} | ⏰ ${fmtHour(s.start)} – ${fmtHour(s.end)}${venue ? ' | 📍 ' + venue : ''}${notes ? ' | 📝 ' + notes : ''}\n\n`;
  });
  if (!sessions.length) text += 'No discussion sessions added yet.\n\n';
  text += `Generated by Milton Tech — miltontech.co.ke/timetable`;

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

const PS_CHECKLIST_MAX = 6;

let _psPrevWeekStart = null;
function psWeekChanged() {
  const el = document.getElementById('psWeekStart');
  if (Object.keys(psStudyBlocks).length && _psPrevWeekStart && el.value !== _psPrevWeekStart) {
    if (!confirm('Changing the week will apply your existing study blocks to the new week dates. Continue?')) {
      el.value = _psPrevWeekStart;
      psUpdateWeekEnd();
      return;
    }
  }
  _psPrevWeekStart = el.value;
  psUpdateWeekEnd();
  psBlockDayChanged();
  psSyncCatDateDefault();
  savePersonalDraft();
}

function savePersonalDraft() {
  saveDraft('mts_draft_personal', {
    units: psUnits,
    blocks: psStudyBlocks,
    cats: psCATs,
    checklist: psChecklist,
    weekStart: document.getElementById('psWeekStart').value,
    name: document.getElementById('psStudentName').value.trim(),
  });
}

function restorePersonalDraft() {
  const draft = loadDraft('mts_draft_personal');
  if (!draft) return;
  const hasData =
    (Array.isArray(draft.units) && draft.units.length) ||
    (draft.blocks && Object.keys(draft.blocks).length) ||
    (Array.isArray(draft.cats) && draft.cats.length) ||
    (Array.isArray(draft.checklist) && draft.checklist.length);
  if (!hasData) return;
  if (Array.isArray(draft.units)) psUnits = draft.units;
  if (draft.blocks && typeof draft.blocks === 'object') psStudyBlocks = draft.blocks;
  if (Array.isArray(draft.cats)) psCATs = draft.cats;
  if (Array.isArray(draft.checklist)) psChecklist = draft.checklist;
  if (draft.name) document.getElementById('psStudentName').value = draft.name;
  if (draft.weekStart) {
    const weekStartEl = document.getElementById('psWeekStart');
    if (weekStartEl) {
      weekStartEl.value = draft.weekStart;
      _psPrevWeekStart = draft.weekStart;
      psUpdateWeekEnd();
    }
  }
  psRenderUnits();
  psRenderSessionList();
  psRenderChecklist();
  if (psCATs.length) {
    psCatAnswer(true);
    psRenderCATList();
  }
}

function psUpdateWeekEnd() {
  const startVal = document.getElementById('psWeekStart').value;
  const endEl = document.getElementById('psWeekEnd');
  if (!endEl) return;
  if (!startVal) {
    endEl.value = '';
    return;
  }
  const [y, m, d] = startVal.split('-').map(Number);
  const picked = new Date(y, m - 1, d);
  const end = new Date(picked);
  end.setDate(picked.getDate() + 6);
  const pad = (n) => String(n).padStart(2, '0');
  endEl.value = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

function psBlockDayChanged() {
  const dayEl = document.getElementById('psBlockDay');
  const dateEl = document.getElementById('psBlockDayDate');
  if (!dayEl || !dateEl) return;
  if (!dayEl.value) {
    dateEl.textContent = '';
    return;
  }
  const dt = psDateForDay(dayEl.value);
  dateEl.textContent = '📅 ' + dt.toLocaleDateString('en-KE', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

function psInit() {
  populateTimeSelect(document.getElementById('psDayStart'), 5, 22);
  populateTimeSelect(document.getElementById('psDayEnd'), 6, 23);
  document.getElementById('psDayStart').value = 7;
  document.getElementById('psDayEnd').value = 21;
  populateTimeSelect(document.getElementById('psBlockStart'), 5, 22.5);
  document.getElementById('psBlockStart').value = 7;
  document.getElementById('psBlockDuration').value = 2;

  const weekStartEl = document.getElementById('psWeekStart');
  if (weekStartEl) {
    weekStartEl.min = todayISO();
    if (!weekStartEl.value) {
      const today = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      weekStartEl.value = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    }
  }
  _psPrevWeekStart = document.getElementById('psWeekStart').value;
  psUpdateWeekEnd();
}

function psDateForDay(dayName) {
  const ORDER = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  const weekStartVal = document.getElementById('psWeekStart').value;
  const [y, m, d] = weekStartVal ? weekStartVal.split('-').map(Number) : [null, null, null];
  const picked = y ? new Date(y, m - 1, d) : new Date();

  const startDow = picked.getDay();
  const targetDow = ORDER[dayName] ?? startDow;
  const diff = (targetDow - startDow + 7) % 7;
  const result = new Date(picked);
  result.setDate(picked.getDate() + diff);
  return result;
}

function psWeekLabel() {
  const weekStartVal = document.getElementById('psWeekStart').value;
  if (!weekStartVal) return '';
  const [y, m, d] = weekStartVal.split('-').map(Number);
  const picked = new Date(y, m - 1, d);
  const end = new Date(picked);
  end.setDate(picked.getDate() + 6);
  const fmt = (dt) => dt.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
  return `Week of ${fmt(picked)} – ${fmt(end)}`;
}

function psRefreshTargetUnitOptions() {
  const sel = document.getElementById('psBlockUnit');
  const catSel = document.getElementById('psCatUnit');
  if (!sel) return;
  const prevValue = sel.value;
  const prevCatValue = catSel ? catSel.value : '';

  const seen = new Map();
  psUnits.forEach((u) => {
    if (!seen.has(u.code)) seen.set(u.code, u.name);
  });
  const optionsHtml =
    '<option value="">Select a unit…</option>' +
    [...seen.entries()]
      .map(([code, name]) => `<option value="${escapeHtml(code)}">${escapeHtml(code)} – ${escapeHtml(name)}</option>`)
      .join('');
  sel.innerHTML = optionsHtml;
  if (seen.has(prevValue)) sel.value = prevValue;
  if (catSel) {
    catSel.innerHTML = optionsHtml;
    if (seen.has(prevCatValue)) catSel.value = prevCatValue;
  }
}

function psSyncCatDateDefault() {
  const weekStartVal = document.getElementById('psWeekStart').value;
  const dateEl = document.getElementById('psCatDate');
  if (!dateEl || !weekStartVal) return;
  const minVal = weekStartVal > todayISO() ? weekStartVal : todayISO();
  dateEl.min = minVal;
  if (!dateEl.value || dateEl.value < minVal) dateEl.value = minVal;
}

function psCatAnswer(yes) {
  const form = document.getElementById('psCatForm');
  const yesBtn = document.getElementById('psCatYesBtn');
  const noBtn = document.getElementById('psCatNoBtn');
  if (form) form.style.display = yes ? 'block' : 'none';
  if (yesBtn) {
    yesBtn.style.borderColor = yes ? 'var(--accent)' : 'var(--border)';
    yesBtn.style.color = yes ? 'var(--accent)' : 'var(--text)';
  }
  if (noBtn) {
    noBtn.style.borderColor = !yes ? 'var(--accent)' : 'var(--border)';
    noBtn.style.color = !yes ? 'var(--accent)' : 'var(--text)';
  }
  if (yes) psSyncCatDateDefault();
  if (!yes && !psCATs.length) {
    document.getElementById('psCatError').textContent = '';
  }
}

function psAddCAT() {
  const errEl = document.getElementById('psCatError');
  const code = document.getElementById('psCatUnit').value;
  const date = document.getElementById('psCatDate').value;
  const time = document.getElementById('psCatTime').value;
  const duration = parseFloat(document.getElementById('psCatDuration').value);
  const venue = document.getElementById('psCatVenue').value.trim().slice(0, 60);

  if (!code) {
    errEl.textContent = 'Please select a unit (add it manually or import from Google Calendar in Step 3).';
    return;
  }
  if (!date) {
    errEl.textContent = 'Please choose the CAT date.';
    return;
  }
  if (!time) {
    errEl.textContent = 'Please choose the CAT time.';
    return;
  }
  if (!venue) {
    errEl.textContent = 'Please enter the venue.';
    return;
  }

  errEl.textContent = '';
  psCATs.push({ code, date, time, duration, venue });

  document.getElementById('psCatUnit').value = '';
  document.getElementById('psCatDate').value = '';
  document.getElementById('psCatTime').value = '';
  document.getElementById('psCatVenue').value = '';
  document.getElementById('psCatDuration').value = '1';
  psRenderCATList();
}

function psRemoveCAT(i) {
  psCATs.splice(i, 1);
  psRenderCATList();
}

function psRenderCATList() {
  const container = document.getElementById('psCatList');
  if (!container) return;
  if (!psCATs.length) {
    container.innerHTML = '';
    psShowFreeSlots(false);
    savePersonalDraft();
    return;
  }
  const sorted = psCATs.map((c, i) => ({ ...c, _i: i })).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  container.innerHTML = sorted
    .map((c) => {
      const unit = psUnits.find((u) => u.code === c.code);
      const name = unit ? unit.name : '';
      const dateLabel = formatDate(c.date);
      return `
<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--bg);border:1px solid var(--danger);border-radius:8px;padding:8px 12px;">
<div style="font-size:0.82rem;color:var(--text);">
<span style="font-family:var(--font-display);font-weight:700;color:var(--danger);">🚨 CAT — ${escapeHtml(c.code)}</span>${name ? ` — ${escapeHtml(name)}` : ''}
<div style="color:var(--muted);font-size:0.75rem;margin-top:2px;">📅 ${dateLabel} | ⏰ ${psCatTimeRange(c)} | 📍 ${escapeHtml(c.venue)}</div>
</div>
<span class="rm" onclick="psRemoveCAT(${c._i})">×</span>
</div>`;
    })
    .join('');
  psShowFreeSlots(false);
  savePersonalDraft();
}

function psAddStudyBlock() {
  const errEl = document.getElementById('psTargetError');
  const sel = document.getElementById('psBlockUnit');
  const code = sel.value;
  const day = document.getElementById('psBlockDay').value;
  const start = parseFloat(document.getElementById('psBlockStart').value);
  const duration = parseFloat(document.getElementById('psBlockDuration').value);
  const end = start + duration;
  const notes = document.getElementById('psBlockNotes').value.trim().slice(0, 60);

  if (!code) {
    errEl.textContent = 'Please select a unit (add it manually or import from Google Calendar in Step 3).';
    return;
  }
  if (!day) {
    errEl.textContent = 'Please select a day.';
    return;
  }
  if (isNaN(start) || isNaN(duration) || duration <= 0) {
    errEl.textContent = 'Please choose a valid start time and duration.';
    return;
  }

  const dayStart = parseFloat(document.getElementById('psDayStart').value);
  const dayEnd = parseFloat(document.getElementById('psDayEnd').value);
  if (start < dayStart || end > dayEnd) {
    errEl.textContent = `Please keep the time within your day range (${fmtHour(dayStart)} – ${fmtHour(dayEnd)}).`;
    return;
  }

  const clash = psFindScheduleClash(day, start, end);
  if (clash) {
    errEl.textContent = `⚠️ That clashes with "${clash.title}" on ${day} (${fmtHour(clash.start)} – ${fmtHour(clash.end)}) on your Google Calendar — pick a different time.`;
    return;
  }

  for (let h = start; h < end; h += 0.5) {
    if (psStudyBlocks[`${day}_${h}`]) {
      errEl.textContent = `${day} ${fmtHour(h)} already has a session — pick a different time.`;
      return;
    }
  }

  errEl.textContent = '';
  const label = `📖 ${code}` + (notes ? ` — ${notes}` : '');
  for (let h = start; h < end; h += 0.5) {
    psStudyBlocks[`${day}_${h}`] = label;
  }

  document.getElementById('psBlockUnit').value = '';
  document.getElementById('psBlockDay').value = '';
  psBlockDayChanged();
  document.getElementById('psBlockStart').value = 7;
  document.getElementById('psBlockDuration').value = 1;
  document.getElementById('psBlockNotes').value = '';
  psRenderSessionList();
}

function psGetSessions() {
  const sessions = [];
  ALL_DAYS.forEach((day) => {
    const dayStart = parseFloat(document.getElementById('psDayStart').value);
    const dayEnd = parseFloat(document.getElementById('psDayEnd').value);
    let h = dayStart;
    while (h < dayEnd) {
      const label = psStudyBlocks[`${day}_${h}`];
      if (label) {
        let end = h + 0.5;
        while (end < dayEnd && psStudyBlocks[`${day}_${end}`] === label) end += 0.5;
        sessions.push({ day, start: h, end, label });
        h = end;
      } else {
        h += 0.5;
      }
    }
  });
  return sessions;
}

function psRenderSessionList() {
  const container = document.getElementById('psSessionList');
  const sessions = psGetSessions();
  if (!sessions.length) {
    container.innerHTML = '';
    savePersonalDraft();
    return;
  }
  container.innerHTML = sessions
    .map(
      (s, i) => `
<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 12px;">
<div style="font-size:0.82rem;color:var(--text);cursor:pointer;" onclick="psEditSession(${i})" title="Tap to edit">
<span style="font-family:var(--font-display);font-weight:700;color:#22c55e;">${s.day}</span>
<span style="color:var(--muted);"> · ${fmtHour(s.start)} – ${fmtHour(s.end)} · </span>${escapeHtml(s.label)}
</div>
<span class="rm" onclick="psRemoveSession(${i})">×</span>
</div>`,
    )
    .join('');
  savePersonalDraft();
}

function psEditSession(i) {
  const sessions = psGetSessions();
  const s = sessions[i];
  if (!s) return;

  const rest = s.label.replace(/^📖\s*/, '');
  const sepIdx = rest.indexOf(' — ');
  const code = sepIdx !== -1 ? rest.slice(0, sepIdx) : rest;
  const notes = sepIdx !== -1 ? rest.slice(sepIdx + 3) : '';

  for (let h = s.start; h < s.end; h += 0.5) delete psStudyBlocks[`${s.day}_${h}`];

  document.getElementById('psBlockUnit').value = code;
  document.getElementById('psBlockDay').value = s.day;
  psBlockDayChanged();
  document.getElementById('psBlockStart').value = s.start;
  document.getElementById('psBlockDuration').value = s.end - s.start;
  document.getElementById('psBlockNotes').value = notes;
  document.getElementById('psTargetError').textContent =
    'Editing this session — adjust the fields above, then tap "+ Add Study Session" to save it.';

  psRenderSessionList();
  if (psTimetableBuilt) psShowFreeSlots(false);
  document.getElementById('psBlockUnit').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function psRemoveSession(i) {
  const sessions = psGetSessions();
  const s = sessions[i];
  if (!s) return;
  for (let h = s.start; h < s.end; h += 0.5) delete psStudyBlocks[`${s.day}_${h}`];
  psRenderSessionList();
  if (psTimetableBuilt) psShowFreeSlots(false);
}

function psAddChecklistItem() {
  const errEl = document.getElementById('psChecklistError');
  const input = document.getElementById('psChecklistInput');
  const text = input.value.trim().slice(0, 40);
  if (psChecklist.length >= PS_CHECKLIST_MAX) {
    errEl.textContent = `You can add up to ${PS_CHECKLIST_MAX} items.`;
    return;
  }
  if (!text) {
    errEl.textContent = 'Please enter a checklist item.';
    return;
  }
  errEl.textContent = '';
  psChecklist.push({ text, done: false });
  input.value = '';
  psRenderChecklist();
}

function psToggleChecklistItem(i) {
  psChecklist[i].done = !psChecklist[i].done;
  psRenderChecklist();
}

function psRemoveChecklistItem(i) {
  psChecklist.splice(i, 1);
  psRenderChecklist();
}

function psRenderChecklist() {
  const container = document.getElementById('psChecklistItems');
  container.innerHTML = psChecklist
    .map(
      (item, i) => `
<div style="display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 10px;">
<input type="checkbox" ${item.done ? 'checked' : ''} onchange="psToggleChecklistItem(${i})" style="width:16px;height:16px;cursor:pointer;flex-shrink:0;" />
<span style="flex:1;font-size:0.85rem;${item.done ? 'text-decoration:line-through;color:var(--muted);' : ''}">${escapeHtml(item.text)}</span>
<span class="rm" onclick="psRemoveChecklistItem(${i})" style="cursor:pointer;color:var(--muted);">×</span>
</div>`,
    )
    .join('');
  const addBtn = document.querySelector('#psChecklistInput').nextElementSibling;
  if (addBtn) addBtn.disabled = psChecklist.length >= PS_CHECKLIST_MAX;
  savePersonalDraft();
}

function psLoadFromGCal() {
  const statusEl = document.getElementById('psGCalStatus');
  const noticeEl = document.getElementById('psNoSyncNotice');
  statusEl.style.display = 'block';
  statusEl.style.color = 'var(--muted)';
  noticeEl.style.display = 'none';
  statusEl.textContent = '⏳ Connecting to Google Calendar…';
  withGCalToken(
    async () => {
      try {
        const events = await fetchGCalClassEvents();
        if (!events.length) {
          statusEl.style.display = 'none';
          noticeEl.style.display = 'block';
          return;
        }

        const freshCodes = new Set(events.map((ev) => ev.code));

        const before = psUnits.length;
        psUnits = psUnits.filter((u) => u.manual || freshCodes.has(u.code));
        const removed = before - psUnits.length;

        let added = 0,
          updated = 0;
        for (const ev of events) {
          const existing = psUnits.find((u) => u.code === ev.code);
          if (!existing) {
            psUnits.push({ code: ev.code, name: ev.name });
            added++;
          } else if (!existing.manual && existing.name !== ev.name) {
            existing.name = ev.name;
            updated++;
          }
        }
        statusEl.style.color = '#22c55e';
        const parts = [];
        if (added) parts.push(`${added} added`);
        if (updated) parts.push(`${updated} updated`);
        if (removed) parts.push(`${removed} removed`);
        statusEl.textContent = parts.length
          ? `✅ Synced from Google Calendar — ${parts.join(', ')}.`
          : `✅ Already up to date with Google Calendar.`;
        psRenderUnits();
      } catch (e) {
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = '❌ Failed to load from Google Calendar. Please try again.';
      }
    },
    () => {
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = '❌ Google sign-in was cancelled or failed. Please try again.';
    },
  );
}

let psWeekBusy = {};
const PS_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function psImportWeeklySchedule() {
  const statusEl = document.getElementById('psScheduleStatus');
  const weekStartVal = document.getElementById('psWeekStart').value;
  statusEl.style.display = 'block';
  if (!weekStartVal) {
    statusEl.style.color = 'var(--danger)';
    statusEl.textContent = 'Please set your week starting date in Step 2 first.';
    return;
  }
  statusEl.style.color = 'var(--muted)';
  statusEl.textContent = '⏳ Connecting to Google Calendar…';
  withGCalToken(
    async () => {
      try {
        const events = await fetchGCalWeekSchedule(weekStartVal);
        const weekdayEvents = events.filter((ev) => PS_WEEKDAYS.includes(ev.day));
        psRenderWeeklySchedule(weekdayEvents);
        statusEl.style.color = '#22c55e';
        statusEl.textContent = weekdayEvents.length
          ? `✅ Imported ${weekdayEvents.length} weekday event${weekdayEvents.length !== 1 ? 's' : ''} (Mon–Fri) from Google Calendar.`
          : '✅ No Mon–Fri events found — your weekdays are clear.';
      } catch (e) {
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = '❌ Failed to load your schedule from Google Calendar. Please try again.';
      }
    },
    () => {
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = '❌ Google sign-in was cancelled or failed. Please try again.';
    },
  );
}

function psRenderWeeklySchedule(events) {
  psWeekBusy = {};
  PS_WEEKDAYS.forEach((d) => (psWeekBusy[d] = []));
  events.forEach((ev) => {
    if (psWeekBusy[ev.day]) psWeekBusy[ev.day].push(ev);
  });

  // Compact one-line-per-weekday summary (guide only — doesn't touch Step 4 data)
  const summaryEl = document.getElementById('psWeeklySummary');
  const dayAbbrev = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' };
  summaryEl.innerHTML =
    `<div style="display:flex;flex-wrap:wrap;gap:6px 14px;font-size:0.75rem;">` +
    PS_WEEKDAYS.map((day) => {
      const n = psWeekBusy[day].length;
      const color = n ? 'var(--text)' : 'var(--muted)';
      const label = n ? `${n} event${n !== 1 ? 's' : ''}` : 'free';
      return `<span style="color:${color};"><b style="font-family:var(--font-display);">${dayAbbrev[day]}</b>: ${label}</span>`;
    }).join('') +
    `</div>`;
  summaryEl.style.display = 'block';

  psRenderSuggestedSlots();
}

function psRenderSuggestedSlots() {
  const wrapEl = document.getElementById('psSuggestedSlotsWrap');
  const suggEl = document.getElementById('psSuggestedSlots');
  if (!wrapEl || !suggEl) return;
  if (!Object.keys(psWeekBusy).length) {
    wrapEl.style.display = 'none';
    return;
  }

  const dayStart = parseFloat(document.getElementById('psDayStart').value);
  const dayEnd = parseFloat(document.getElementById('psDayEnd').value);
  const roundDown = (h) => Math.floor(h * 2) / 2;
  const roundUp = (h) => Math.ceil(h * 2) / 2;

  let suggHtml = '';
  PS_WEEKDAYS.forEach((day) => {
    const busyBlocks = (psWeekBusy[day] || [])
      .map((e) => ({ start: Math.max(roundDown(e.start), dayStart), end: Math.min(roundUp(e.end), dayEnd) }))
      .filter((b) => b.end > b.start);
    const slots = computeFreeSlots(busyBlocks, dayStart, dayEnd, 1);
    if (slots.length) {
      suggHtml +=
        `<div style="margin-bottom:8px;"><span style="font-family:var(--font-display);font-weight:600;font-size:0.78rem;color:var(--text);">${day}:</span> ` +
        slots
          .map(
            (s) =>
              `<button onclick="psUseSuggestedSlot('${day}', ${s.start})" style="margin:3px 4px 0 0;background:var(--surface2);border:1px solid var(--accent2);color:var(--accent2);border-radius:6px;padding:5px 10px;font-size:0.72rem;font-family:'Inter',sans-serif;cursor:pointer;">${fmtHour(s.start)} – ${fmtHour(s.end)}</button>`,
          )
          .join('') +
        `</div>`;
    }
  });
  suggEl.innerHTML =
    suggHtml ||
    `<p style="font-size:0.78rem;color:var(--muted);">No free slots of an hour or more found in your day range — try widening your day range in Step 2.</p>`;
  wrapEl.style.display = 'block';
}

// Guide-only helper: checks a proposed study block against imported Mon–Fri Google Calendar events.
// Does not alter or gate Step 4 in any other way — Step 4 works exactly as before if this hasn't been used.
function psFindScheduleClash(day, start, end) {
  const busy = psWeekBusy[day];
  if (!busy || !busy.length) return null;
  return busy.find((e) => e.start < end && e.end > start) || null;
}

function psUseSuggestedSlot(day, start) {
  document.getElementById('psBlockDay').value = day;
  psBlockDayChanged();
  document.getElementById('psBlockStart').value = start;
  const unitSel = document.getElementById('psBlockUnit');
  unitSel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  unitSel.focus();
}

function psAddManualUnit() {
  const errEl = document.getElementById('psManualError');
  const codeEl = document.getElementById('psManualCode');
  const nameEl = document.getElementById('psManualName');
  const code = codeEl.value.trim().toUpperCase();
  const name = nameEl.value.trim();

  if (!code || !name) {
    errEl.textContent = 'Please enter both a unit code and a unit name.';
    return;
  }
  if (psUnits.some((u) => u.code === code)) {
    errEl.textContent = 'That unit code has already been added.';
    return;
  }

  errEl.textContent = '';

  psUnits.push({ code, name, manual: true });
  codeEl.value = '';
  nameEl.value = '';
  document.getElementById('psNoSyncNotice').style.display = 'none';
  psRenderUnits();
}

function psRenderUnits() {
  const container = document.getElementById('psUnitTags');
  container.innerHTML = psUnits
    .map((u, i) => {
      if (psEditingIndex === i) {
        return `
<div class="unit-tag" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:var(--bg);border:1px solid var(--accent);">
<input type="text" id="psEditCode${i}" value="${escapeHtml(u.code)}" style="width:90px;max-width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:4px 6px;font-family:'Inter',sans-serif;font-size:0.7rem;outline:none;" />
<input type="text" id="psEditName${i}" value="${escapeHtml(u.name)}" style="width:140px;max-width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:4px 6px;font-family:'Inter',sans-serif;font-size:0.7rem;outline:none;" />
<span class="rm" style="color:var(--accent);" onclick="psSaveUnitEdit(${i})">✓</span>
<span class="rm" onclick="psCancelUnitEdit()">×</span>
</div>`;
      }
      return `
<div class="unit-tag">
<span onclick="psEditUnit(${i})" style="cursor:pointer;" title="Tap to edit">${escapeHtml(u.code)} – ${escapeHtml(u.name)}</span>
<span class="rm" onclick="psRemoveUnit(${i})">×</span>
</div>`;
    })
    .join('');
  document.getElementById('psUnitCount').textContent = `${psUnits.length} unit${psUnits.length !== 1 ? 's' : ''} loaded`;
  document.getElementById('psNoSyncNotice').style.display = psUnits.length
    ? 'none'
    : document.getElementById('psNoSyncNotice').style.display;
  psRefreshTargetUnitOptions();
  psShowFreeSlots(false);
  savePersonalDraft();
}

let psEditingIndex = null;

function psEditUnit(i) {
  psEditingIndex = i;
  psRenderUnits();
  const codeEl = document.getElementById(`psEditCode${i}`);
  if (codeEl) codeEl.focus();
}

function psCancelUnitEdit() {
  psEditingIndex = null;
  psRenderUnits();
}

function psSaveUnitEdit(i) {
  const codeEl = document.getElementById(`psEditCode${i}`);
  const nameEl = document.getElementById(`psEditName${i}`);
  const code = codeEl.value.trim().toUpperCase();
  const name = nameEl.value.trim();
  if (!code || !name) return;
  if (psUnits.some((u, idx) => idx !== i && u.code === code)) {
    return;
  }
  const oldCode = psUnits[i].code;
  psUnits[i].code = code;
  psUnits[i].name = name;
  psUnits[i].manual = true;
  if (typeof psStudyBlocks !== 'undefined' && oldCode !== code) {
    const oldPrefix = `📖 ${oldCode}`;
    const newPrefix = `📖 ${code}`;
    Object.keys(psStudyBlocks).forEach((k) => {
      if (psStudyBlocks[k] === oldPrefix || psStudyBlocks[k].startsWith(oldPrefix + ' ')) {
        psStudyBlocks[k] = newPrefix + psStudyBlocks[k].slice(oldPrefix.length);
      }
    });
  }
  psEditingIndex = null;
  psRenderUnits();
}

function psRemoveUnit(i) {
  const removedCode = psUnits[i].code;
  psUnits.splice(i, 1);
  psRenderUnits();
}

function psBuildTimetable() {
  const errEl = document.getElementById('psTargetError');
  if (!psUnits.length) {
    errEl.textContent = 'Add at least one unit in Step 3 before building your timetable.';
    return;
  }
  if (!psGetSessions().length) {
    errEl.textContent = 'Add at least one study session in Step 4 before building your timetable.';
    return;
  }
  errEl.textContent = '';
  const btn = document.getElementById('psGenerateBtn');
  if (btn) {
    if (btn.disabled) return;
    btn.dataset.origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ Building…';
  }
  setTimeout(() => {
    psTimetableBuilt = true;
    psShowFreeSlots(true);
    if (btn) flashBuildSuccess(btn, btn.dataset.origHtml, '✓ Timetable Built!');
  }, 80);
}

function psShowFreeSlots(scroll = true) {
  if (!psUnits.length) {
    document.getElementById('psResults').style.display = 'none';
    return;
  }

  const sessions = psGetSessions();

  let bodyHtml;
  if (!sessions.length) {
    bodyHtml = `<tr><td colspan="6" class="empty-row">No study sessions added yet — use Step 4 above to add one.</td></tr>`;
  } else {
    bodyHtml = sessions
      .map((s, i) => {
        const rest = s.label.replace(/^📖\s*/, '');
        const sepIdx = rest.indexOf(' — ');
        const code = sepIdx !== -1 ? rest.slice(0, sepIdx) : rest;
        const notes = sepIdx !== -1 ? rest.slice(sepIdx + 3) : '';
        const unit = psUnits.find((u) => u.code === code);
        const name = unit ? unit.name : '';
        return `
<tr class="clickable" onclick="psEditSession(${i})" title="Tap to edit">
<td class="num">${i + 1}</td>
<td><div class="exam-cell"><div class="cell-code">${escapeHtml(code)}</div></div></td>
<td class="left">${escapeHtml(name)}</td>
<td class="strong">${s.day}</td>
<td class="time">${fmtHour(s.start)} – ${fmtHour(s.end)}</td>
<td class="left muted">${escapeHtml(notes)}</td>
</tr>`;
      })
      .join('');
  }

  const catsSorted = [...psCATs].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const catRowsHtml = catsSorted
    .map((c, ci) => {
      const unit = psUnits.find((u) => u.code === c.code);
      const name = unit ? unit.name : '';
      const dateLabel = formatDate(c.date);
      return `
<tr class="is-cat">
<td class="num danger">🚨</td>
<td><div class="exam-cell"><div class="cell-code">${escapeHtml(c.code)}</div></div></td>
<td class="left">${escapeHtml(name)}</td>
<td class="strong">${dateLabel}</td>
<td class="time danger">${psCatTimeRange(c)}</td>
<td class="left muted">CAT · 📍 ${escapeHtml(c.venue)}</td>
</tr>`;
    })
    .join('');

  const html = `
<table class="tt-table">
<thead>
<tr>
<th>#</th>
<th>Code</th>
<th class="left">Unit Name</th>
<th>Day</th>
<th>Time</th>
<th class="left">Notes</th>
</tr>
</thead>
<tbody>${bodyHtml}${catRowsHtml}</tbody>
</table>
`;

  document.getElementById('psGrid').innerHTML = html;

  renderFunnyComment(
    'funnyComment_ps',
    generateClassBanner(
      sessions.map((s) => ({ day: s.day, start: s.start, end: s.end })),
      { only: ['motivation', 'masenoTip'] },
    ),
  );

  const psStudentNameVal = document.getElementById('psStudentName').value.trim();
  const psWeekStartVal = document.getElementById('psWeekStart').value;
  const psPayload = {
    units: psUnits,
    blocks: psStudyBlocks,
    cats: psCATs,
    checklist: psChecklist,
    weekStart: psWeekStartVal,
    name: psStudentNameVal,
  };
  const psQuery = `personal=${encodeURIComponent(JSON.stringify(psPayload))}`;
  const psLinkEl = document.getElementById('psShareLink');
  if (psLinkEl) psLinkEl.value = `${location.origin}${location.pathname}?${psQuery}`;
  try {
    history.replaceState(null, '', `?${psQuery}`);
  } catch (e) {}

  if (psTimetableBuilt) {
    document.getElementById('psResults').style.display = 'block';
    if (scroll) document.getElementById('psResults').scrollIntoView({ behavior: 'smooth' });
  }
}

function copyPersonalLink() {
  copyShareLink('psShareLink', 'psCopyBtn', 'Copy Editable Link', 'personal');
}

function loadPersonalFromURL() {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('personal');
  if (!data) {
    restorePersonalDraft();
    return;
  }
  try {
    const payload = JSON.parse(data);
    if (Array.isArray(payload.units)) psUnits = payload.units;
    if (payload.blocks && typeof payload.blocks === 'object') psStudyBlocks = payload.blocks;
    if (Array.isArray(payload.cats)) psCATs = payload.cats;
    if (Array.isArray(payload.checklist)) psChecklist = payload.checklist;
    if (payload.name) document.getElementById('psStudentName').value = payload.name;
    if (payload.weekStart) {
      const weekStartEl = document.getElementById('psWeekStart');
      if (weekStartEl) {
        weekStartEl.value = payload.weekStart;
        _psPrevWeekStart = payload.weekStart;
        psUpdateWeekEnd();
      }
    }
    selectMode('personal', { skipHistoryPush: true });
    psRenderUnits();
    psRenderSessionList();
    psRenderChecklist();
    if (psCATs.length) {
      psCatAnswer(true);
      psRenderCATList();
    }
    if (psGetSessions().length) {
      psTimetableBuilt = true;
      psShowFreeSlots(false);
    }
  } catch (e) {
    console.warn('Failed to restore shared personal study link:', e);
  }
}

function psOpenModal(day, hour) {
  psPendingSlot = { day, hour };
  document.getElementById('psModalSlotInfo').textContent = `${day} · ${fmtHour(hour)} – ${fmtHour(hour + 0.5)}`;
  document.getElementById('psModalLabel').value = '';
  const modal = document.getElementById('psModal');
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('psModalLabel').focus(), 100);
}

function psEditSlot(day, hour) {
  psPendingSlot = { day, hour };
  const key = `${day}_${hour}`;
  document.getElementById('psModalSlotInfo').textContent = `${day} · ${fmtHour(hour)} – ${fmtHour(hour + 0.5)}`;
  document.getElementById('psModalLabel').value = psStudyBlocks[key] || '';
  document.getElementById('psModal').style.display = 'flex';
  setTimeout(() => document.getElementById('psModalLabel').focus(), 100);
}

function psModalCancel() {
  document.getElementById('psModal').style.display = 'none';
  psPendingSlot = null;
}

function psModalConfirm() {
  if (!psPendingSlot) return;
  const label = document.getElementById('psModalLabel').value.trim();
  const key = `${psPendingSlot.day}_${psPendingSlot.hour}`;
  if (label) psStudyBlocks[key] = label;
  else delete psStudyBlocks[key];
  document.getElementById('psModal').style.display = 'none';
  psPendingSlot = null;
  psRenderSessionList();
  psShowFreeSlots();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('psModal').style.display === 'flex') psModalConfirm();
  if (e.key === 'Escape' && document.getElementById('psModal').style.display === 'flex') psModalCancel();
});

function psClearStudyBlocks() {
  if (!Object.keys(psStudyBlocks).length) return;
  if (confirm('Clear all your study blocks?')) {
    psStudyBlocks = {};
    psRenderSessionList();
    psShowFreeSlots();
  }
}

function psShareWA() {
  const blocks = psMergedStudyBlocks();
  const weekLabel = psWeekLabel();
  const studentName = document.getElementById('psStudentName').value.trim();
  const studentReg = document.getElementById('psStudentReg').value.trim();
  const studentYear = document.getElementById('psStudentYear').value.trim();
  const studentDept = document.getElementById('psStudentDept').value.trim();
  const studentSemester = document.getElementById('psStudentSemester').value.trim();
  const studentAcadYear = document.getElementById('psStudentAcadYear').value.trim();
  const studentLine = [studentName, studentReg, studentYear].filter(Boolean).join(' | ');
  const studentLine2 = [studentDept, studentSemester, studentAcadYear].filter(Boolean).join(' | ');
  let text =
    `📌 *My Personal Study Timetable*` +
    (studentLine ? `\n${studentLine}` : '') +
    (studentLine2 ? `\n${studentLine2}` : '') +
    (weekLabel ? `\n🗓 ${weekLabel}\n\n` : '\n\n');

  blocks.forEach((b, i) => {
    const rest = b.label.replace(/^📖\s*/, '');
    const sepIdx = rest.indexOf(' — ');
    const code = sepIdx !== -1 ? rest.slice(0, sepIdx) : rest;
    const notes = sepIdx !== -1 ? rest.slice(sepIdx + 3) : '';
    const unit = psUnits.find((u) => u.code === code);
    const name = unit ? unit.name : '';
    text += `${i + 1}. *${code}*${name ? ' — ' + name : ''}\n   📅 ${b.day} | ⏰ ${fmtHour(b.start)} – ${fmtHour(b.end)}${notes ? ' | 📝 ' + notes : ''}\n\n`;
  });
  if (!blocks.length) text += 'No study blocks added yet.\n\n';

  if (psCATs.length) {
    const catsSorted = [...psCATs].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    text += `🚨 *Upcoming CAT(s)*\n\n`;
    catsSorted.forEach((c, i) => {
      const unit = psUnits.find((u) => u.code === c.code);
      const name = unit ? unit.name : '';
      text += `${i + 1}. *${c.code}*${name ? ' — ' + name : ''}\n   📅 ${formatDate(c.date)} | ⏰ ${psCatTimeRange(c)} | 📍 ${c.venue}\n\n`;
    });
  }

  text += `Generated by Milton Tech — miltontech.co.ke/timetable`;

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function psMergedStudyBlocks() {
  const dayStart = parseFloat(document.getElementById('psDayStart').value);
  const dayEnd = parseFloat(document.getElementById('psDayEnd').value);
  const blocks = [];
  ALL_DAYS.forEach((day) => {
    let current = null;
    for (let h = dayStart; h < dayEnd; h += 0.5) {
      const key = `${day}_${h}`;
      const label = psStudyBlocks[key];
      if (label && current && current.label === label && current.end === h) {
        current.end = h + 0.5;
      } else {
        if (current) blocks.push(current);
        current = label ? { day, label, start: h, end: h + 0.5 } : null;
      }
    }
    if (current) blocks.push(current);
  });
  return blocks;
}

function buildStudyBlockEvent(block) {
  // FIX: Proper validation of block data
  if (!block.day || !block.label) {
    throw new Error('Invalid study block: missing day or label');
  }
  if (typeof block.start !== 'number' || typeof block.end !== 'number') {
    throw new Error(`Invalid block times: start=${block.start}, end=${block.end}`);
  }

  const startDate = psDateForDay(block.day);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Nairobi';

  const rest = block.label.replace(/^📖\s*/, '');
  const sepIdx = rest.indexOf(' — ');
  const code = sepIdx !== -1 ? rest.slice(0, sepIdx) : rest;
  const notes = sepIdx !== -1 ? rest.slice(sepIdx + 3) : '';
  const unit = psUnits.find((u) => u.code === code);
  const name = unit ? unit.name : '';

  return {
    summary: `Personal Study: ${code}${name ? ' – ' + name : ''}`,
    description: `Personal Study\nUnit: ${name}\nCode: ${code}${notes ? '\nNotes: ' + notes : ''}`,
    start: { dateTime: isoDateTime(startDate, block.start), timeZone: tz },
    end: { dateTime: isoDateTime(startDate, block.end), timeZone: tz },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] },
    colorId: GCAL_COLOR_PERSONAL,
  };
}

const GCAL_STORE_PERSONAL = 'mts_gcal_personal_ids';
function _studyEventKey(block) {
  return `${block.day}_${block.start}_${block.end}`;
}

function buildCATEvent(cat) {
  // FIX: Proper validation of CAT data
  if (!cat.date || !cat.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new Error(`Invalid CAT date format: ${cat.date}. Expected YYYY-MM-DD.`);
  }
  if (!cat.time || !cat.time.match(/^\d{2}:\d{2}$/)) {
    throw new Error(`Invalid CAT time format: ${cat.time}. Expected HH:MM.`);
  }
  if (typeof cat.duration !== 'number' || cat.duration <= 0) {
    throw new Error(`Invalid CAT duration: ${cat.duration}. Must be a positive number.`);
  }

  const [y, mo, d] = cat.date.split('-').map(Number);
  const [hh, mm] = cat.time.split(':').map(Number);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Nairobi';

  // FIX: Create dates with proper timezone handling
  const startDate = new Date(y, mo - 1, d, hh, mm, 0);
  const endDate = new Date(startDate.getTime() + cat.duration * 60 * 60 * 1000);

  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;

  const unit = psUnits.find((u) => u.code === cat.code);
  const name = unit ? unit.name : '';
  const unitDetails = name ? `${cat.code}: ${name}` : cat.code;

  // FIX: Handle location properly
  const location = cat.venue && cat.venue.trim() ? `${cat.venue}, Maseno University` : 'Maseno University';

  return {
    summary: `CAT - ${unitDetails}`,
    location: location,
    description: `Continuous Assessment Test (CAT)\nUnit: ${name}\nCode: ${cat.code}\nVenue: ${cat.venue || 'TBD'}`,
    start: { dateTime: fmt(startDate), timeZone: tz },
    end: { dateTime: fmt(endDate), timeZone: tz },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 1440 },
        { method: 'popup', minutes: 60 },
      ],
    },
    colorId: GCAL_COLOR_PERSONAL,
  };
}

const GCAL_STORE_PERSONAL_CAT = 'mts_gcal_personal_cat_ids';
function _catEventKey(cat) {
  return `${cat.code}_${cat.date}_${cat.time}`;
}

async function syncPersonalToGCal() {
  const blocks = psMergedStudyBlocks();
  if (!blocks.length && !psCATs.length) {
    showToast('Nothing to sync yet. Add a study session or a CAT first.', 'error');
    return;
  }

  const weekStartVal = document.getElementById('psWeekStart').value;
  if (weekStartVal) {
    const [y, m, d] = weekStartVal.split('-').map(Number);
    const picked = new Date(y, m - 1, d);
    const weekEnd = new Date(picked);
    weekEnd.setDate(picked.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const today = new Date();
    if (weekEnd < today) {
      const proceed = confirm(`The week of ${weekStartVal} has already passed. Sync anyway?`);
      if (!proceed) return;
    }
  }
  withGCalToken(async () => {
    const btn = document.querySelector('#psResults .btn-gcal');
    const orig = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Syncing…';
    }
    try {
      const currentKeys = new Set(blocks.map(_studyEventKey));

      await pruneRemovedEvents(currentKeys, GCAL_STORE_PERSONAL, true);

      const total = blocks.length + psCATs.length;
      let count = 0;
      for (const block of blocks) {
        const key = _studyEventKey(block);
        await upsertGCalEvent(key, GCAL_STORE_PERSONAL, buildStudyBlockEvent(block));
        count++;
        if (btn) btn.innerHTML = `⏳ ${count}/${total}…`;
      }

      const currentCatKeys = new Set(psCATs.map(_catEventKey));
      await pruneRemovedEvents(currentCatKeys, GCAL_STORE_PERSONAL_CAT, true);
      for (const cat of psCATs) {
        const key = _catEventKey(cat);
        await upsertGCalEvent(key, GCAL_STORE_PERSONAL_CAT, buildCATEvent(cat));
        count++;
        if (btn) btn.innerHTML = `⏳ ${count}/${total}…`;
      }

      const catNote = psCATs.length ? ` Each CAT has reminders 24 hours and 1 hour before.` : '';
      showToast(
        `${count} item(s) synced to your Google Calendar for the week of ${document.getElementById('psWeekStart').value}!\nExisting items were updated and removed ones were deleted.${catNote} This covers one week only — build a new timetable and sync again next week. If you don't see them yet, refresh your calendar app.`,
        'success',
      );
      _setLastSync('personal');
    } catch (err) {
      console.error(err);
      showToast('Failed to sync some items. Please try again.\n' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    }
  });
}
