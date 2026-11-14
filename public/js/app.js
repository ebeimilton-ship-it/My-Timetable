/* ──────────────────────────────────────────────────────────────
   app.js — Main controller: shared helpers, class mode, navigation, bootstrap.
   ────────────────────────────────────────────────────────────── */

function saveDraft(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}
function loadDraft(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function todayISO() {
  const t = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

async function withButtonBusy(btnEl, busyLabel, fn) {
  if (!btnEl || btnEl.disabled) return;
  const origHtml = btnEl.innerHTML;
  btnEl.disabled = true;
  btnEl.setAttribute('aria-busy', 'true');
  btnEl.innerHTML = busyLabel;
  try {
    await fn(); // waits for async exporters instead of a fixed timeout
  } catch (err) {
    console.error(err);
    showToast('Something went wrong. Please try again in a moment.', 'error');
  } finally {
    setTimeout(() => {
      btnEl.disabled = false;
      btnEl.removeAttribute('aria-busy');
      btnEl.innerHTML = origHtml;
    }, 120);
  }
}

// Guards PDF export functions against being invoked before the jsPDF /
// jspdf-autotable libraries (loaded with `defer` from a CDN) have finished
// loading, or against a stale/failed cached copy of those specific files
// (e.g. left over from before the old service worker was cleaned up).
// pdfLibsReady() is a fast, side-effect-free check. On failure, callers pair
// it with retryPdfLibsThen(...) which dynamically re-fetches fresh, cache-
// busted copies of just those two files and automatically re-runs whichever
// export the user actually clicked — no need to refresh the page manually.
let _pdfLibsFailReason = '';

function flashBuildSuccess(btn, restoreHtml, successLabel = '✓ Timetable Built!', duration = 1100) {
  if (!btn) return;
  btn.disabled = true;
  btn.classList.add('btn-build-success');
  btn.innerHTML = `<span class="btn-build-success-icon">${successLabel}</span>`;
  setTimeout(() => {
    btn.classList.remove('btn-build-success');
    btn.innerHTML = restoreHtml;
    btn.disabled = false;
  }, duration);
}

function showToast(message, type = 'info', duration) {
  const container = document.getElementById('toastContainer');
  if (!container) {
    console.warn('Toast container missing:', message);
    return;
  }

  const icons = { success: '✓', error: '✕', info: 'i' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.textContent = icons[type] || icons.info;

  const msg = document.createElement('span');
  msg.className = 'toast-msg';
  msg.textContent = message;

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Dismiss');
  close.innerHTML = '&times;';

  toast.appendChild(icon);
  toast.appendChild(msg);
  toast.appendChild(close);
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-show'));

  const autoDuration = duration || Math.min(8000, Math.max(3200, message.length * 45));
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 260);
  };

  const timer = setTimeout(dismiss, autoDuration);
  close.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
  });
}

// A toast with an inline "Undo" action, used for reversible destructive
// actions (deleting planner events) instead of always blocking with a
// native confirm() dialog — faster for the common case, still safe.
function showUndoToast(message, undoFn, duration = 6000) {
  const container = document.getElementById('toastContainer');
  if (!container) {
    showToast(message, 'info');
    return;
  }

  const toast = document.createElement('div');
  toast.className = 'toast toast-info';
  toast.setAttribute('role', 'status');

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.textContent = '↩';

  const msg = document.createElement('span');
  msg.className = 'toast-msg';
  msg.textContent = message;

  const undoBtn = document.createElement('button');
  undoBtn.className = 'toast-close';
  undoBtn.style.cssText = 'font-size:0.72rem;font-weight:700;color:var(--accent2);text-decoration:underline;white-space:nowrap;opacity:1;';
  undoBtn.textContent = 'Undo';

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Dismiss');
  close.innerHTML = '&times;';

  toast.appendChild(icon);
  toast.appendChild(msg);
  toast.appendChild(undoBtn);
  toast.appendChild(close);
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-show'));

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 260);
  };

  const timer = setTimeout(dismiss, duration);
  close.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
  });
  undoBtn.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
    undoFn();
  });
}

// ---- Global error handling ----
// Catches otherwise-silent JS crashes so users see a message instead of a
// frozen/broken page, and so errors get a single place to be logged.
// ── Class-mode state ──
let allUnits = [];
let selectedUnits = [];
let dbConnected = false;
let _lastConflicts = [];
let _collisionData = [];

let _lastErrorToastAt = 0;
function _reportError(source, err) {
  const now = Date.now();
  console.error(`[${source}]`, err);
  // Throttle toasts so a loop of repeated errors doesn't spam the user.
  if (now - _lastErrorToastAt < 4000) return;
  _lastErrorToastAt = now;
  try {
    showToast('Something went wrong. Please try again, or reload the page if it keeps happening.', 'error', 5000);
  } catch (e) {
    /* showToast itself unavailable this early */
  }
}

window.addEventListener('error', function (event) {
  _reportError('window.onerror', event.error || event.message);
});

window.addEventListener('unhandledrejection', function (event) {
  _reportError('unhandledrejection', event.reason);
});

// ---- Offline / online detection ----
// fetch() calls in this app (Supabase, GCal, holidays) fail silently on a
// dropped connection otherwise, which reads to the user as "the site is broken".
function _updateOnlineStatus() {
  if (!navigator.onLine) {
    showToast("You're offline — some features (search, sync, saving to the cloud) won't work until you're back online.", 'error', 6000);
  } else {
    showToast("You're back online.", 'success', 2500);
  }
}
window.addEventListener('offline', _updateOnlineStatus);
window.addEventListener('online', _updateOnlineStatus);

let _collidingCodes = new Set();

async function init() {
  await loadUnits();
  loadFromURL();
  if (selectedUnits.length === 0) restoreClassDraft();
  setupSearch();
}

function restoreClassDraft() {
  const draft = loadDraft('mts_draft_class');
  if (!draft || !Array.isArray(draft.units) || !draft.units.length) return;
  selectedUnits = draft.units;
  if (draft.name) document.getElementById('studentName').value = draft.name;
  renderTags();
}

function unitStartHr(u) {
  return u.startHour !== undefined ? Number(u.startHour) : parseTime(u.time).start;
}
function unitDurHr(u) {
  return u.duration !== undefined ? Number(u.duration) : parseTime(u.time).dur;
}
// Share-link keys: always carry numeric start/duration so edited, manual and multi-session
// units reload exactly as built (matching on the time *string* silently picked the wrong session).
function buildClassShareKeys() {
  return selectedUnits.map((u) => {
    const s = unitStartHr(u),
      h = unitDurHr(u);
    const key = { c: u.code, d: u.day, t: u.time, s, h };
    const db = allUnits.find(
      (a) => a.code === u.code && a.day === u.day && Math.abs(unitStartHr(a) - s) < 0.01 && Math.abs(unitDurHr(a) - h) < 0.01,
    );
    if (!db || (db.name || '') !== (u.name || '') || (db.venue || '') !== (u.venue || '') || (db.lecturer || '') !== (u.lecturer || '')) {
      key.n = u.name;
      key.v = u.venue;
      if (u.lecturer) key.l = u.lecturer;
    }
    return key;
  });
}

function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  const codes = params.get('units');
  const name = params.get('name');
  if (!codes) return;
  if (name) document.getElementById('studentName').value = name;

  let entries = [];
  try {
    const parsed = JSON.parse(codes);
    if (Array.isArray(parsed)) entries = parsed.map((e) => (typeof e === 'string' ? { c: e } : e));
  } catch (e) {
    entries = codes.split(',').map((c) => ({ c: c.trim() }));
  }

  entries.forEach((entry) => {
    if (!entry || typeof entry.c !== 'string') return;
    if (selectedUnits.length >= 18) return;
    const sNum = Number(entry.s),
      hNum = Number(entry.h);
    const hasNum = entry.s !== undefined && entry.h !== undefined && isFinite(sNum) && isFinite(hNum) && hNum > 0;
    let unit = null;
    if (hasNum) {
      const base = allUnits.find((u) => u.code === entry.c && u.day === entry.d && Math.abs(unitStartHr(u) - sNum) < 0.01);
      const customOk = DAYS.includes(entry.d) && sNum >= 7 && sNum + hNum <= 20;
      if (base && entry.v === undefined) {
        unit = base;
      } else if (customOk && (entry.v !== undefined || base)) {
        unit = {
          code: String(entry.c).trim().toUpperCase().slice(0, 20),
          name: String(entry.n !== undefined ? entry.n : base ? base.name : entry.c).slice(0, 120),
          day: entry.d,
          startHour: sNum,
          duration: hNum,
          time: makeTimeStr(sNum, hNum),
          venue: String(entry.v !== undefined ? entry.v : base ? base.venue : '').slice(0, 80),
          lecturer: String(entry.l !== undefined ? entry.l : (base && base.lecturer) || '').slice(0, 80),
        };
      }
    } else {
      // Older links (code/day/time only)
      if (entry.d && entry.t) unit = allUnits.find((u) => u.code === entry.c && u.day === entry.d && u.time === entry.t);
      if (!unit) unit = allUnits.find((u) => u.code === entry.c);
    }
    if (
      unit &&
      !selectedUnits.find((u) => u.code === unit.code && u.day === unit.day && Math.abs(unitStartHr(u) - unitStartHr(unit)) < 0.01)
    ) {
      selectedUnits.push(unit);
    }
  });

  selectMode('class', { skipHistoryPush: true });
  renderTags();
  if (selectedUnits.length > 0) generate();
}

function loadClassFromGCal() {
  const statusEl = document.getElementById('classGCalStatus');
  const noticeEl = document.getElementById('classNoSyncNotice');
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
        let added = 0,
          skipped = 0,
          capped = false;
        for (const ev of events) {
          if (selectedUnits.length >= 18) {
            capped = true;
            break;
          }
          const dup = selectedUnits.find((u) => u.code === ev.code && u.day === ev.day && u.startHour === ev.start);
          if (dup) {
            skipped++;
            continue;
          }
          const duration = ev.end - ev.start;
          selectedUnits.push({
            code: ev.code,
            name: ev.name,
            day: ev.day,
            startHour: ev.start,
            duration,
            time: makeTimeStr(ev.start, duration),
            venue: ev.venue,
            lecturer: ev.lecturer,
          });
          added++;
        }
        renderTags();
        statusEl.style.color = '#22c55e';
        statusEl.textContent = `✅ Imported ${added} class${added !== 1 ? 'es' : ''} from Google Calendar${skipped ? ` (${skipped} already added)` : ''}${capped ? ' — 18-unit limit reached, some were left out' : ''}. Tap ✏ on any unit to edit it.`;
        if (document.getElementById('outputSection').classList.contains('visible') && selectedUnits.length >= MIN_CLASS_UNITS) {
          _generate(true);
        }
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

function selectUnit(id) {
  const unit = allUnits.find((u) => String(u.id) === String(id));
  if (!unit) return;
  if (selectedUnits.length >= 18) {
    showError('Maximum 18 units allowed.');
    return;
  }
  hideError();
  document.getElementById('unitSearch').value = '';
  document.getElementById('dropdown').classList.remove('open');
  openEditModal(unit);
}

// ── Add ALL class sessions for a unit at once, via a multi-row confirm modal ──
function addAllSessions(code) {
  const sessions = allUnits.filter((u) => u.code === code);
  if (!sessions.length) return;
  if (selectedUnits.length >= 18) {
    showError('Maximum 18 units allowed.');
    return;
  }
  hideError();
  document.getElementById('unitSearch').value = '';
  document.getElementById('dropdown').classList.remove('open');
  openMultiEditModal(sessions);
}

function timeOptionsHTML(kind, selected) {
  const isStart = kind === 'start';
  const min = isStart ? 7 : 7.5;
  const max = isStart ? 19.5 : 20;
  let html = `<option value="">Select ${isStart ? 'start' : 'end'}</option>`;
  for (let v = min; v <= max + 0.001; v += 0.5) {
    const val = Math.round(v * 2) / 2;
    const sel = selected !== undefined && !isNaN(selected) && Math.abs(selected - val) < 0.001 ? 'selected' : '';
    html += `<option value="${val}" ${sel}>${fmtHour(val)}</option>`;
  }
  return html;
}

let _multiSessions = [];

function openMultiEditModal(sessions) {
  _multiSessions = sessions.map((s) => {
    const start = s.startHour !== undefined ? Number(s.startHour) : parseTime(s.time).start;
    const dur = s.duration !== undefined ? Number(s.duration) : parseTime(s.time).dur;
    return { day: s.day, startHour: start, endHour: start + dur, venue: s.venue || '', lecturer: s.lecturer || '' };
  });
  document.getElementById('meCode').value = sessions[0].code;
  document.getElementById('meName').value = sessions[0].name;
  renderMultiRows();
  document.getElementById('meError').style.display = 'none';
  document.getElementById('multiEditModal').classList.add('open');
}

function renderMultiRows() {
  const wrap = document.getElementById('meRows');
  if (!_multiSessions.length) {
    wrap.innerHTML = `<div class="me-empty-note">All classes removed — cancel to close, or search again to start over.</div>`;
  } else {
    wrap.innerHTML = _multiSessions
      .map(
        (s, i) => `
<div class="me-row-card">
<div class="me-row-head">
<span class="me-row-label">Class ${i + 1}</span>
<button type="button" class="me-remove-btn" onclick="removeMultiRow(${i})">🗑 Remove</button>
</div>
<div class="modal-row">
<div class="modal-field">
<label>Day</label>
<select onchange="_multiSessions[${i}].day=this.value">
${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => `<option ${s.day === d ? 'selected' : ''}>${d}</option>`).join('')}
</select>
</div>
<div class="modal-field">
<label>Venue</label>
<input type="text" value="${escapeHtml(s.venue)}" oninput="_multiSessions[${i}].venue=this.value" placeholder="e.g. LT1" />
</div>
</div>
<div class="modal-row">
<div class="modal-field">
<label>Start Time</label>
<select onchange="_multiSessions[${i}].startHour=parseFloat(this.value)">${timeOptionsHTML('start', s.startHour)}</select>
</div>
<div class="modal-field">
<label>End Time</label>
<select onchange="_multiSessions[${i}].endHour=parseFloat(this.value)">${timeOptionsHTML('end', s.endHour)}</select>
</div>
</div>
<div class="modal-field" style="margin-bottom:12px;">
<label>Lecturer <span style="font-weight:400;font-size:0.68rem;color:var(--muted);">(Optional)</span></label>
<input type="text" value="${escapeHtml(s.lecturer)}" oninput="_multiSessions[${i}].lecturer=this.value" placeholder="e.g. Dr. Otieno" />
</div>
</div>
`,
      )
      .join('');
  }
  document.getElementById('meCount').textContent = _multiSessions.length;
  const btn = document.getElementById('meAddBtn');
  btn.textContent = _multiSessions.length ? `Add ${_multiSessions.length} to Timetable` : 'Nothing to add';
  btn.disabled = _multiSessions.length === 0;
}

function removeMultiRow(i) {
  _multiSessions.splice(i, 1);
  renderMultiRows();
}

function closeMultiEditModal() {
  document.getElementById('multiEditModal').classList.remove('open');
  document.getElementById('meError').style.display = 'none';
  _multiSessions = [];
}

function confirmMultiAdd() {
  const code = document.getElementById('meCode').value.trim().toUpperCase();
  const name = document.getElementById('meName').value.trim();
  const err = document.getElementById('meError');

  if (!code || !name) {
    err.textContent = 'Unit code and name are required.';
    err.style.display = 'block';
    return;
  }
  if (!_multiSessions.length) {
    err.textContent = 'No classes left to add.';
    err.style.display = 'block';
    return;
  }
  if (selectedUnits.length + _multiSessions.length > 18) {
    err.textContent = `Adding these ${_multiSessions.length} classes would exceed the 18-unit maximum.`;
    err.style.display = 'block';
    return;
  }

  const toAdd = [];
  for (let i = 0; i < _multiSessions.length; i++) {
    const s = _multiSessions[i];
    const venue = (s.venue || '').trim();
    const lecturer = (s.lecturer || '').trim();
    if (!s.day || isNaN(s.startHour) || isNaN(s.endHour) || !venue) {
      err.textContent = `Class ${i + 1}: please fill in day, start/end time and venue.`;
      err.style.display = 'block';
      return;
    }
    if (s.endHour <= s.startHour) {
      err.textContent = `Class ${i + 1}: end time must be after start time.`;
      err.style.display = 'block';
      return;
    }
    const duration = s.endHour - s.startHour;
    if (s.startHour + duration > 20) {
      err.textContent = `Class ${i + 1}: cannot end after 20:00.`;
      err.style.display = 'block';
      return;
    }
    const time = makeTimeStr(s.startHour, duration);
    if (selectedUnits.find((u) => u.code === code && u.day === s.day && u.startHour === s.startHour)) {
      err.textContent = `Class ${i + 1}: ${code} is already added for ${s.day} ${time}.`;
      err.style.display = 'block';
      return;
    }
    if (toAdd.find((u) => u.day === s.day && u.startHour === s.startHour)) {
      err.textContent = `Class ${i + 1}: duplicate day/time with another class in this list.`;
      err.style.display = 'block';
      return;
    }
    toAdd.push({ code, name, day: s.day, startHour: s.startHour, duration, time, venue, lecturer });
  }

  err.style.display = 'none';
  selectedUnits.push(...toAdd);
  renderTags();
  closeMultiEditModal();

  if (document.getElementById('outputSection').classList.contains('visible') && selectedUnits.length >= MIN_CLASS_UNITS) {
    _generate(true);
  }
}

function ensureTimeOption(selectEl, value) {
  if (value === undefined || value === null || isNaN(value)) return;
  const strVal = String(value);
  const already = Array.from(selectEl.options).some((o) => o.value === strVal);
  if (already) return;
  const opt = document.createElement('option');
  opt.value = strVal;
  opt.textContent = fmtHour(value);
  const opts = Array.from(selectEl.options);
  let insertBefore = null;
  for (let i = 1; i < opts.length; i++) {
    if (parseFloat(opts[i].value) > value) {
      insertBefore = opts[i];
      break;
    }
  }
  selectEl.insertBefore(opt, insertBefore);
}

function openEditModal(unit, editIdx) {
  const sh = unit.startHour !== undefined ? unit.startHour : parseTime(unit.time).start;
  const dur = unit.duration !== undefined ? unit.duration : parseTime(unit.time).dur;
  const eh = sh + dur;

  const startSel = document.getElementById('emStart');
  const endSel = document.getElementById('emEnd');
  ensureTimeOption(startSel, sh);
  ensureTimeOption(endSel, eh);

  document.getElementById('emCode').value = unit.code;
  document.getElementById('emName').value = unit.name;
  document.getElementById('emDay').value = unit.day;
  startSel.value = sh;
  endSel.value = eh;
  document.getElementById('emVenue').value = unit.venue;
  document.getElementById('emLecturer').value = unit.lecturer || '';
  _editingIdx = editIdx !== undefined ? editIdx : -1;
  updateEditPreview();

  const isEdit = _editingIdx >= 0;
  document.querySelector('#editModal .modal-title').textContent = isEdit ? 'Edit Unit Details' : 'Confirm Unit Details';
  document.querySelector('#editModal .modal-sub').textContent = isEdit
    ? 'Update the details for this unit.'
    : 'Review and edit the details before adding to your timetable.';
  document.querySelector('#editModal .btn-primary').textContent = isEdit ? 'Save Changes' : 'Add to Timetable';

  document.getElementById('emDisclaimerBanner').style.display = isEdit ? 'none' : 'flex';

  document.getElementById('editModal').classList.add('open');
}

let _editingIdx = -1;

function updateEditPreview() {
  const sh = parseFloat(document.getElementById('emStart').value);
  const eh = parseFloat(document.getElementById('emEnd').value);
  const p = document.getElementById('emPreview');
  if (isNaN(sh) || isNaN(eh)) {
    p.textContent = '';
    return;
  }
  const dur = eh - sh;
  if (dur <= 0) {
    p.textContent = 'End time must be after start time';
    p.style.color = 'var(--danger)';
    return;
  }
  p.style.color = 'var(--accent2)';
  p.textContent = fmtHour(sh) + ' → ' + fmtHour(eh) + '  (' + dur + 'h)';
}

function confirmAdd() {
  const code = document.getElementById('emCode').value.trim().toUpperCase();
  const name = document.getElementById('emName').value.trim();
  const day = document.getElementById('emDay').value;
  const startHour = parseFloat(document.getElementById('emStart').value);
  const endHour = parseFloat(document.getElementById('emEnd').value);
  const venue = document.getElementById('emVenue').value.trim();
  const lecturer = document.getElementById('emLecturer').value.trim();
  const err = document.getElementById('emError');

  if (!code || !name || !day || isNaN(startHour) || isNaN(endHour) || !venue) {
    err.textContent = 'Please fill in all fields.';
    err.style.display = 'block';
    return;
  }
  if (endHour <= startHour) {
    err.textContent = 'End time must be after start time.';
    err.style.display = 'block';
    return;
  }
  const duration = endHour - startHour;
  if (startHour + duration > 20) {
    err.textContent = 'Class cannot end after 20:00.';
    err.style.display = 'block';
    return;
  }
  const time = makeTimeStr(startHour, duration);

  const duplicate = selectedUnits.find((u, i) => i !== _editingIdx && u.code === code && u.day === day && u.startHour === startHour);
  if (duplicate) {
    err.textContent = code + ' already added for ' + day + ' ' + time;
    err.style.display = 'block';
    return;
  }
  err.style.display = 'none';

  const updated = { code, name, day, startHour, duration, time, venue, lecturer };
  if (_editingIdx >= 0) {
    updated.manual = selectedUnits[_editingIdx].manual;
    selectedUnits[_editingIdx] = updated;
  } else {
    selectedUnits.push(updated);
  }
  renderTags();
  closeEditModal();

  if (document.getElementById('outputSection').classList.contains('visible') && selectedUnits.length >= MIN_CLASS_UNITS) {
    _generate(true);
  }
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
  document.getElementById('emError').style.display = 'none';
  _editingIdx = -1;
}

function removeUnit(idx) {
  selectedUnits.splice(idx, 1);
  renderTags();

  const outputSection = document.getElementById('outputSection');
  if (outputSection.classList.contains('visible')) {
    if (selectedUnits.length >= MIN_CLASS_UNITS) {
      _generate(true);
    } else {
      outputSection.classList.remove('visible');
    }
  }
}

function sortedUnitsWithIndex() {
  return selectedUnits
    .map((u, i) => ({ u, i }))
    .sort((a, b) => {
      const dayDiff = DAYS.indexOf(a.u.day) - DAYS.indexOf(b.u.day);
      if (dayDiff !== 0) return dayDiff;
      const ash = a.u.startHour !== undefined ? a.u.startHour : parseTime(a.u.time).start;
      const bsh = b.u.startHour !== undefined ? b.u.startHour : parseTime(b.u.time).start;
      return ash - bsh;
    });
}

function renderTags() {
  const container = document.getElementById('unitTags');
  container.innerHTML = sortedUnitsWithIndex()
    .map(
      ({ u, i }) => `
<div class="unit-tag">
${unitColorSwatchHtml(u.code, 'renderTags')}
<span>${escapeHtml(u.code)} <span style="font-size:0.68rem;opacity:0.65">${u.day.slice(0, 3)} ${u.time}</span></span>
<span class="edit-tag" title="Edit unit" onclick="openEditModal(selectedUnits[${i}], ${i})">✏</span>
<span class="rm" onclick="removeUnit(${i})">×</span>
</div>
`,
    )
    .join('');
  const _c = selectedUnits.length;
  document.getElementById('unitCount').textContent =
    _c < MIN_CLASS_UNITS
      ? `${_c} entr${_c !== 1 ? 'ies' : 'y'} added · need ${MIN_CLASS_UNITS - _c} more to generate (min ${MIN_CLASS_UNITS}) · max 18`
      : `${_c} entr${_c !== 1 ? 'ies' : 'y'} added · max 18`;
  saveDraft('mts_draft_class', { units: selectedUnits, name: document.getElementById('studentName').value.trim() });
  refreshClassGrid();
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5];
const DAY_CLASS = { Monday: 'mon', Tuesday: 'tue', Wednesday: 'wed', Thursday: 'thu', Friday: 'fri', Saturday: 'sat' };
const MIN_CLASS_UNITS = 2;

function makeTimeStr(startHr, dur) {
  return fmtHour(startHr) + '-' + fmtHour(startHr + dur);
}
function parseTime(timeStr) {
  const parts = String(timeStr == null ? '' : timeStr).split('-');
  const start = parseTimePart(parts[0]);
  const end = parseTimePart(parts[1]);
  return { start, dur: isNaN(end - start) ? 3 : end - start };
}

function parseTimePart(str) {
  if (str === undefined || str === null) return NaN;
  str = String(str).trim();
  const ampmMatch = str.match(/\s*(am|pm)$/i);
  const ampm = ampmMatch ? ampmMatch[1].toLowerCase() : null;
  const clean = ampm ? str.slice(0, str.length - ampmMatch[0].length).trim() : str;
  const [hStr, mStr] = clean.split(':');
  let h = Number(hStr);
  if (isNaN(h)) return NaN;
  const m = mStr !== undefined ? Number(mStr) : 0;
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h + (isNaN(m) ? 0 : m / 60);
}

function generate() {
  const btn = document.getElementById('generateBtn');
  if (btn.disabled) return;
  btn.classList.add('loading');
  btn.disabled = true;
  btn.textContent = '⏳ Building…';
  setTimeout(() => {
    let ok = false;
    try {
      ok = _generate();
    } catch (e) {
      console.error('Failed to build class timetable:', e);
      showError('Something went wrong while building your timetable. Please try again.');
      ok = false;
    }
    btn.classList.remove('loading');
    if (ok) {
      flashBuildSuccess(btn, '🗓 Build My Timetable');
    } else {
      btn.disabled = false;
      btn.innerHTML = '🗓 Build My Timetable';
    }
  }, 80);
}
function _generate(silent = false) {
  hideError();
  if (selectedUnits.length < MIN_CLASS_UNITS) {
    showError(
      `Please add at least ${MIN_CLASS_UNITS} unit entries to generate your timetable. The same unit can appear more than once if it runs multiple times a week.`,
    );
    return false;
  }

  const conflicts = [];
  const collisionData = [];
  const collidingCodes = new Set();

  for (let i = 0; i < selectedUnits.length; i++) {
    for (let j = i + 1; j < selectedUnits.length; j++) {
      const a = selectedUnits[i],
        b = selectedUnits[j];
      if (a.day !== b.day) continue;
      const aS = a.startHour !== undefined ? a.startHour : parseTime(a.time).start;
      const aD = a.duration !== undefined ? a.duration : parseTime(a.time).dur;
      const bS = b.startHour !== undefined ? b.startHour : parseTime(b.time).start;
      const bD = b.duration !== undefined ? b.duration : parseTime(b.time).dur;
      const aEnd = aS + aD,
        bEnd = bS + bD;
      if (aS < bEnd && bS < aEnd) {
        conflicts.push(`${escapeHtml(a.code)} and ${escapeHtml(b.code)} overlap on ${a.day} (${a.time} vs ${b.time})`);
        collisionData.push({ unitA: a, unitB: b, day: a.day, timeA: a.time, timeB: b.time });
        collidingCodes.add(a.code + '|' + a.day + '|' + aS);
        collidingCodes.add(b.code + '|' + b.day + '|' + bS);
      }
    }
  }

  const cb = document.getElementById('conflictBox');
  const cl = document.getElementById('conflictList');
  _lastConflicts = conflicts;
  _collisionData = collisionData;
  _collidingCodes = collidingCodes;
  if (conflicts.length > 0) {
    cl.innerHTML = conflicts.map((c) => `<li>${c}</li>`).join('');
    cb.classList.add('visible');
  } else {
    cb.classList.remove('visible');
  }

  const sorted = [...selectedUnits].sort((a, b) => {
    const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    const ash = a.startHour !== undefined ? a.startHour : parseTime(a.time).start;
    const bsh = b.startHour !== undefined ? b.startHour : parseTime(b.time).start;
    return ash - bsh;
  });

  const totalHours = selectedUnits.reduce((s, u) => s + (u.duration || parseTime(u.time).dur), 0);
  document.getElementById('summaryBar').innerHTML = `
<div class="summary-stat"><span>${selectedUnits.length}</span>Units</div>
<div class="summary-stat"><span>${totalHours}h</span>Per Week</div>
<div class="summary-stat"><span>${conflicts.length}</span>Conflicts</div>
`;

  const name = document.getElementById('studentName').value.trim();
  document.getElementById('outputTitle').textContent = name ? `${name}'s Class Timetable` : 'Class Timetable';

  renderClassWeek(sorted);

  const unitKeys = buildClassShareKeys();
  const codes = encodeURIComponent(JSON.stringify(unitKeys));
  const nameParam = name ? `&name=${encodeURIComponent(name)}` : '';
  const url = `${location.origin}${location.pathname}?units=${codes}${nameParam}`;
  document.getElementById('shareLink').value = url;

  renderFunnyComment(
    'funnyComment_class',
    generateClassBanner(
      selectedUnits.map((u) => {
        const sh = u.startHour !== undefined ? u.startHour : parseTime(u.time).start;
        const dur = u.duration !== undefined ? u.duration : parseTime(u.time).dur;
        return { day: u.day, start: sh, end: sh + dur };
      }),
    ),
  );

  document.getElementById('outputSection').classList.add('visible');
  if (!silent) document.getElementById('outputSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    history.replaceState(null, '', `?units=${codes}${nameParam}`);
  } catch (e) {}
  return true;
}

const SHARE_TEXT_TEMPLATES = {
  class: 'Check out my class timetable:',
  exam: 'Check out my exam timetable:',
  personal: 'Check out my personal study timetable:',
  group: 'Check out my group discussion timetable:',
};

function copyShareLink(inputId, btnId, defaultLabel, type) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!input.value) return;
  const prefix = type && SHARE_TEXT_TEMPLATES[type] ? SHARE_TEXT_TEMPLATES[type] + ' ' : '';
  const link = prefix + input.value;

  const showResult = (ok) => {
    btn.textContent = ok ? '✓ Copied!' : '⚠ Tap to select, then copy';
    btn.classList.toggle('copied', ok);
    setTimeout(() => {
      btn.textContent = defaultLabel;
      btn.classList.remove('copied');
    }, 2000);
  };

  const fallbackCopy = () => {
    const original = input.value;
    try {
      input.removeAttribute('readonly');
      input.value = link;
      input.focus();
      input.select();
      input.setSelectionRange(0, link.length);
      const ok = document.execCommand('copy');
      input.value = original;
      input.setAttribute('readonly', '');
      showResult(ok);
    } catch (e) {
      input.value = original;
      input.setAttribute('readonly', '');
      input.focus();
      input.select();
      showResult(false);
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(link)
      .then(() => showResult(true))
      .catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
}

function copyLink() {
  copyShareLink('shareLink', 'copyBtn', 'Copy Editable Link', 'class');
}

function shareWA() {
  const name = document.getElementById('studentName').value.trim();
  const dept = document.getElementById('studentDept').value.trim();
  const sorted = [...selectedUnits].sort((a, b) => {
    const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    const ash = a.startHour !== undefined ? a.startHour : parseTime(a.time).start;
    const bsh = b.startHour !== undefined ? b.startHour : parseTime(b.time).start;
    return ash - bsh;
  });
  let msg = name ? `📋 *${name}'s Maseno Class Timetable*\n\n` : `📋 *Maseno University Class Timetable*\n\n`;
  if (dept) msg += `🏫 ${dept}\n\n`;
  sorted.forEach((u, i) => {
    const sh = u.startHour !== undefined ? u.startHour : parseTime(u.time).start;
    const dur = u.duration !== undefined ? u.duration : parseTime(u.time).dur;
    const timeStr = u.time || `${fmtHour(sh)} – ${fmtHour(sh + dur)}`;
    msg += `${i + 1}. *${u.code}* — ${u.name}\n   📅 ${u.day} | ⏰ ${timeStr} | 📍 ${u.venue}${u.lecturer ? ` | 👤 ${u.lecturer}` : ''}\n\n`;
  });
  msg += `Generated by Milton Tech — miltontech.co.ke/timetable`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function shareNative() {
  const name = document.getElementById('studentName').value.trim();
  const title = name ? `${name}'s Maseno Timetable` : 'My Maseno Timetable';
  const sorted = [...selectedUnits].sort((a, b) => {
    const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    const ash = a.startHour !== undefined ? a.startHour : parseTime(a.time).start;
    const bsh = b.startHour !== undefined ? b.startHour : parseTime(b.time).start;
    return ash - bsh;
  });
  let text = title + '\n\n';
  sorted.forEach((u, i) => {
    const sh = u.startHour !== undefined ? u.startHour : parseTime(u.time).start;
    const dur = u.duration !== undefined ? u.duration : parseTime(u.time).dur;
    const timeStr = u.time || `${fmtHour(sh)} – ${fmtHour(sh + dur)}`;
    text += `${i + 1}. ${u.code} — ${u.name}\n   ${u.day} | ${timeStr} | ${u.venue}${u.lecturer ? ` | ${u.lecturer}` : ''}\n\n`;
  });
  if (navigator.share) {
    navigator.share({ title, text }).catch(() => {});
  } else {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        const btn = document.getElementById('shareBtn');
        if (!btn) return;
        const orig = btn.innerHTML;
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
          btn.innerHTML = orig;
        }, 2000);
      })
      .catch(() => {});
  }
}

const PDF_UNIT_COLORS = [
  { fill: [219, 234, 254], text: [30, 64, 175] },
  { fill: [220, 252, 231], text: [22, 101, 52] },
  { fill: [254, 226, 226], text: [153, 27, 27] },
  { fill: [254, 243, 199], text: [146, 64, 14] },
  { fill: [237, 233, 254], text: [91, 33, 182] },
  { fill: [255, 228, 230], text: [159, 18, 57] },
  { fill: [204, 251, 241], text: [13, 116, 109] },
  { fill: [255, 237, 213], text: [154, 52, 18] },
  { fill: [224, 242, 254], text: [7, 89, 133] },
  { fill: [240, 253, 244], text: [21, 128, 61] },
  { fill: [253, 230, 245], text: [157, 23, 77] },
  { fill: [224, 231, 255], text: [55, 48, 163] },
];
function getUnitColor(code) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  return PDF_UNIT_COLORS[hash % PDF_UNIT_COLORS.length];
}

// --- Custom per-unit color preferences (shared across all 4 modules) ---
function getUnitColorPref(code) {
  try {
    const saved = JSON.parse(localStorage.getItem('mts_unit_colors') || '{}');
    return saved[code] || null;
  } catch (e) {
    return null;
  }
}
function setUnitColorPref(code, hex) {
  try {
    const saved = JSON.parse(localStorage.getItem('mts_unit_colors') || '{}');
    saved[code] = hex;
    localStorage.setItem('mts_unit_colors', JSON.stringify(saved));
  } catch (e) {}
}
function hexToRgbTriple(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [219, 234, 254];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
function contrastTextRgb(rgbTriple) {
  const [r, g, b] = rgbTriple;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? [30, 30, 30] : [255, 255, 255];
}
// For code text / dot markers drawn directly on a white or light-gray PDF row,
// very light custom colors (e.g. white, pale yellow) would be invisible.
// Darken them while keeping the hue, so they always stay legible.
function legibleAccentRgb(rgbTriple) {
  const [r, g, b] = rgbTriple;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance > 0.75) {
    return [Math.round(r * 0.45), Math.round(g * 0.45), Math.round(b * 0.45)];
  }
  return rgbTriple;
}
// Builds a unitColorMap for a list of units, honoring custom prefs unless useCustom is false.
// When useCustom is false, output is identical to the original auto-palette behavior.
function buildUnitColorMap(units, PALETTE, useCustom) {
  const map = {};
  let colorIdx = 0;
  units.forEach((u) => {
    if (map[u.code]) return;
    const pref = useCustom !== false ? getUnitColorPref(u.code) : null;
    if (pref) {
      const bg = hexToRgbTriple(pref);
      map[u.code] = { fill: bg, bg, text: contrastTextRgb(bg), accent: bg, label: legibleAccentRgb(bg) };
    } else {
      const palette = PALETTE[colorIdx % PALETTE.length];
      map[u.code] = { ...palette, label: palette.accent };
      colorIdx++;
    }
  });
  return map;
}
// Renders a small color-swatch control for a unit tag/chip. Opens native color picker on tap.
// Hex of the automatic colour a unit gets when no custom one is chosen.
function unitAutoHex(code) {
  const f = getUnitColor(code).fill;
  return '#' + f.map((n) => n.toString(16).padStart(2, '0')).join('');
}
function unitColorSwatchHtml(code, onChangeFn) {
  const pref = getUnitColorPref(code) || unitAutoHex(code);
  return `<input type="color" class="unit-color-swatch" value="${pref}" title="Choose a color for this unit"
onclick="event.stopPropagation()"
onchange="setUnitColorPref('${code.replace(/'/g, "\\'")}', this.value); ${onChangeFn}()" />`;
}

function toggleManual() {
  const form = document.getElementById('manualForm');
  form.classList.toggle('open');
}

function toggleExamManual() {
  const form = document.getElementById('examManualForm');
  form.classList.toggle('open');
}

let _manualDur = 3;

function setDur(d) {
  _manualDur = d;
  document.querySelectorAll('.dur-btn').forEach((b) => b.classList.toggle('active', +b.dataset.dur === d));
  updateTimePreview();
}

function updateTimePreview() {
  const sh = parseFloat(document.getElementById('mStartHour').value);
  const preview = document.getElementById('mTimePreview');
  if (!isNaN(sh)) {
    preview.textContent = fmtHour(sh) + ' → ' + fmtHour(sh + _manualDur) + '  (' + _manualDur + 'h)';
  } else {
    preview.textContent = '';
  }
}

function addManualUnit() {
  const code = document.getElementById('mCode').value.trim().toUpperCase();
  const name = document.getElementById('mName').value.trim();
  const day = document.getElementById('mDay').value;
  const startHour = parseFloat(document.getElementById('mStartHour').value);
  const venue = document.getElementById('mVenue').value.trim();
  const lecturer = document.getElementById('mLecturer').value.trim();
  const err = document.getElementById('manualError');
  const duration = _manualDur;

  if (!code || !name || !day || isNaN(startHour) || !venue) {
    err.textContent = 'Please fill in all fields.';
    err.classList.add('visible');
    return;
  }
  if (startHour + duration > 20) {
    err.textContent = 'Class cannot end after 20:00.';
    err.classList.add('visible');
    return;
  }
  if (selectedUnits.length >= 18) {
    err.textContent = 'Maximum 18 units reached.';
    err.classList.add('visible');
    return;
  }
  const time = makeTimeStr(startHour, duration);

  if (selectedUnits.find((u) => u.code === code && u.day === day && u.startHour === startHour)) {
    err.textContent = code + ' already added for ' + day + ' ' + time;
    err.classList.add('visible');
    return;
  }

  selectedUnits.push({ code, name, day, startHour, duration, time, venue, lecturer, manual: true });
  renderTags();
  err.classList.remove('visible');

  document.getElementById('mCode').value = '';
  document.getElementById('mName').value = '';
  document.getElementById('mDay').value = '';
  document.getElementById('mStartHour').value = '';
  document.getElementById('mVenue').value = '';
  document.getElementById('mLecturer').value = '';
  document.getElementById('mTimePreview').textContent = '';

  if (document.getElementById('outputSection').classList.contains('visible') && selectedUnits.length >= MIN_CLASS_UNITS) {
    _generate(true);
  }
}

let _errorTimer = null;
function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = msg;
  box.classList.add('visible');
  if (_errorTimer) clearTimeout(_errorTimer);
  _errorTimer = setTimeout(() => {
    box.classList.remove('visible');
  }, 5000);
}
function hideError() {
  document.getElementById('errorBox').classList.remove('visible');
}
function resetAll() {
  selectedUnits = [];
  _lastConflicts = [];
  _collisionData = [];
  _collidingCodes = new Set();
  renderTags();
  document.getElementById('studentName').value = '';
  document.getElementById('studentYear').value = '';
  document.getElementById('studentDept').value = '';
  document.getElementById('studentSemester').value = '1';
  document.getElementById('studentAcadYear').value = '2026/2027';
  document.getElementById('outputSection').classList.remove('visible');
  document.getElementById('conflictBox').classList.remove('visible');
  hideError();
  try {
    history.replaceState(null, '', location.pathname);
  } catch (e) {}
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


function _updateClassTitleAndLink() {
  const outputSection = document.getElementById('outputSection');
  if (!outputSection.classList.contains('visible')) return;
  const name = document.getElementById('studentName').value.trim();
  document.getElementById('outputTitle').textContent = name ? `${name}'s Class Timetable` : 'Class Timetable';
  const unitKeys = buildClassShareKeys();
  const codes = encodeURIComponent(JSON.stringify(unitKeys));
  const nameParam = name ? `&name=${encodeURIComponent(name)}` : '';
  const url = `${location.origin}${location.pathname}?units=${codes}${nameParam}`;
  document.getElementById('shareLink').value = url;
  try {
    history.replaceState(null, '', `?units=${codes}${nameParam}`);
  } catch (e) {}
}

function _updateExamTitle() {
  const outputSection = document.getElementById('examOutputSection');
  if (!outputSection.classList.contains('visible')) return;
  const name = document.getElementById('examStudentName').value.trim();
  const year = document.getElementById('examStudentYear').value;
  const dept = document.getElementById('examStudentDept').value.trim();
  let titleParts = [];
  if (name) titleParts.push(name);
  if (year) titleParts.push(`Year ${year}`);
  if (dept) titleParts.push(dept);
  document.getElementById('examOutputTitle').textContent = titleParts.length
    ? titleParts.join(' · ') + ' — Exam Timetable'
    : 'Examination Timetable';
}

['studentName', 'studentYear', 'studentDept'].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', _updateClassTitleAndLink);
});
['examStudentName', 'examStudentYear', 'examStudentDept'].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', _updateExamTitle);
});

/* ════════════════════════════════════════════════════════════════
   Weekly grid (class mode) — sticky headers, lane-split overlaps,
   per-unit colour with auto text contrast, collision panel.
   ════════════════════════════════════════════════════════════════ */

function _rgb(t) {
  return `rgb(${t[0]},${t[1]},${t[2]})`;
}

// { bg, fg, accent } as CSS colour strings for a unit code (custom pref wins).
function unitCssColors(code) {
  const pref = getUnitColorPref(code);
  if (pref) {
    const bg = hexToRgbTriple(pref);
    return { bg: _rgb(bg), fg: _rgb(contrastTextRgb(bg)), accent: _rgb(legibleAccentRgb(bg)) };
  }
  const c = getUnitColor(code);
  return { bg: _rgb(c.fill), fg: _rgb(c.text), accent: _rgb(c.text) };
}

// Greedy lane assignment so overlapping classes sit side by side.
function layoutDayLanes(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    if (!cluster.length) return;
    const laneEnds = [];
    cluster.forEach((it) => {
      let lane = laneEnds.findIndex((e) => e <= it.start + 1e-6);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(it.end);
      } else laneEnds[lane] = it.end;
      it.lane = lane;
    });
    cluster.forEach((it) => {
      it.lanes = laneEnds.length;
      out.push(it);
    });
    cluster = [];
  };
  sorted.forEach((it) => {
    if (cluster.length && it.start >= clusterEnd - 1e-6) {
      flush();
      clusterEnd = -1;
    }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  });
  flush();
  return out;
}

function renderClassWeek(sortedUnits) {
  const host = document.getElementById('timetableGrid');
  if (!host) return;
  const items = sortedUnits.map((u) => {
    const s = unitStartHr(u);
    const h = unitDurHr(u);
    return { u, idx: selectedUnits.indexOf(u), day: u.day, start: s, end: s + h };
  });
  const usesSat = items.some((it) => it.day === 'Saturday');
  const days = usesSat ? DAYS : DAYS.slice(0, 5);
  const startH = Math.max(6, Math.floor(Math.min(...items.map((i) => i.start))));
  const endH = Math.min(21, Math.max(startH + 5, Math.ceil(Math.max(...items.map((i) => i.end)))));
  const rows = endH - startH;

  const times = [];
  for (let h = startH; h < endH; h++) times.push(`<div class="tt-time"><span>${fmtHour(h)}</span></div>`);

  const cols = days
    .map((day) => {
      const laid = layoutDayLanes(items.filter((i) => i.day === day));
      const evs = laid
        .map((it) => {
          const u = it.u;
          const clash = _collidingCodes.has(`${u.code}|${u.day}|${it.start}`);
          const col = unitCssColors(u.code);
          const top = (it.start - startH) * 100;
          const height = (it.end - it.start) * 100;
          const w = 100 / it.lanes;
          const tip = `${u.code} — ${u.name}\n${u.day} ${u.time}\n${u.venue || ''}${u.lecturer ? '\n' + u.lecturer : ''}`;
          return `<button type="button" class="tt-ev${clash ? ' is-clash' : ''}${it.end - it.start <= 1 ? ' is-short' : ''}"
style="top:calc(var(--hour-h) * ${top / 100});height:calc(var(--hour-h) * ${height / 100} - 3px);left:calc(${it.lane * w}% + 2px);width:calc(${w}% - 4px);--ev-bg:${col.bg};--ev-fg:${col.fg};--ev-ac:${col.accent}"
title="${escapeHtml(tip)}" aria-label="${escapeHtml(u.code + ', ' + u.day + ' ' + u.time + (clash ? ', clashes with another class' : ''))}"
onclick="openEditModal(selectedUnits[${it.idx}], ${it.idx})">
<span class="tt-ev-code">${escapeHtml(u.code)}</span>
<span class="tt-ev-name">${escapeHtml(u.name)}</span>
<span class="tt-ev-meta">${escapeHtml(u.time)}${u.venue ? ' · ' + escapeHtml(u.venue) : ''}</span>
${clash ? '<span class="tt-clash-badge" title="Clash">⚠<span class="lbl"> Clash</span></span>' : ''}
</button>`;
        })
        .join('');
      return `<div class="tt-col" data-day="${day}">${evs}</div>`;
    })
    .join('');

  const heads = days.map((d) => `<div class="tt-dayhead"><span class="tt-dayfull">${d}</span><span class="tt-dayshort">${d.slice(0, 3)}</span></div>`).join('');

  const codes = [...new Set(items.map((i) => i.u.code))];
  const legend = codes
    .map((c) => `<span class="tt-legend-item">${unitColorSwatchHtml(c, 'refreshClassGrid')}<span>${escapeHtml(c)}</span></span>`)
    .join('');

  const clashPanel = _collisionData.length
    ? `<aside class="tt-clashes" aria-label="Schedule clashes">
<div class="tt-clashes-title"><span class="tt-clash-pulse"></span>${_collisionData.length} clash${_collisionData.length !== 1 ? 'es' : ''} to resolve</div>
${_collisionData
  .map((c) => {
    const ia = selectedUnits.indexOf(c.unitA);
    const ib = selectedUnits.indexOf(c.unitB);
    return `<div class="tt-clash-item">
<div class="tt-clash-pair"><b>${escapeHtml(c.unitA.code)}</b> <i>⇄</i> <b>${escapeHtml(c.unitB.code)}</b></div>
<div class="tt-clash-when">${c.day} · ${escapeHtml(c.timeA)} vs ${escapeHtml(c.timeB)}</div>
<div class="tt-clash-actions">
<button type="button" class="chip-btn" onclick="openEditModal(selectedUnits[${ia}], ${ia})">Edit ${escapeHtml(c.unitA.code)}</button>
<button type="button" class="chip-btn" onclick="openEditModal(selectedUnits[${ib}], ${ib})">Edit ${escapeHtml(c.unitB.code)}</button>
</div></div>`;
  })
  .join('')}
</aside>`
    : '';

  const listRows = sortedUnits
    .map((u, i) => {
      const clash = _collidingCodes.has(`${u.code}|${u.day}|${unitStartHr(u)}`);
      return `<tr class="${clash ? 'is-clash' : ''}">
<td class="num">${i + 1}</td>
<td class="code">${escapeHtml(u.code)}${clash ? '<span class="tt-clash-badge sm">⚠ Clash</span>' : ''}</td>
<td class="left">${escapeHtml(u.name)}</td><td>${u.day}</td><td class="time">${escapeHtml(u.time)}</td><td>${escapeHtml(u.venue)}</td>
</tr>`;
    })
    .join('');

  host.innerHTML = `
<div class="tt-legend" aria-label="Unit colours">${legend}<span class="tt-legend-hint">Tap a dot to recolour</span></div>
<div class="tt-layout">
<div class="tt-scroll" tabindex="0" aria-label="Weekly timetable">
<div class="tt-week" style="--rows:${rows};--cols:${days.length}">
<div class="tt-corner"></div>${heads}
<div class="tt-times">${times.join('')}</div>${cols}
</div></div>
${clashPanel}
</div>
<details class="tt-list" open>
<summary>List view</summary>
<table class="tt-table"><thead><tr><th>#</th><th>Code</th><th class="left">Unit name</th><th>Day</th><th>Time</th><th>Venue</th></tr></thead>
<tbody>${listRows}</tbody></table>
</details>`;
}

// Re-draw the grid after a colour change (no re-validation).
function refreshClassGrid() {
  const out = document.getElementById('outputSection');
  if (!out || !out.classList.contains('visible') || selectedUnits.length < MIN_CLASS_UNITS) return;
  const sorted = sortedUnitsWithIndex().map((x) => x.u);
  renderClassWeek(sorted);
}

/* ════════════════════════════════════════════════════════════════
   Navigation — segmented tabs, hash deep-links, theme
   ════════════════════════════════════════════════════════════════ */

const MODES = ['class', 'exam', 'group', 'personal', 'planner'];
const MODE_PANELS = { class: 'classApp', exam: 'examApp', group: 'groupApp', personal: 'personalApp', planner: 'plannerApp' };
let currentMode = null;

function selectMode(mode, options = {}) {
  if (!MODES.includes(mode)) mode = 'class';
  const { skipHash = false, initial = false } = options;
  currentMode = mode;
  MODES.forEach((m) => {
    const panel = document.getElementById(MODE_PANELS[m]);
    if (panel) panel.style.display = m === mode ? 'block' : 'none';
  });
  document.querySelectorAll('.seg-tab').forEach((t) => {
    const on = t.dataset.mode === mode;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
  });
  if (mode === 'exam' && typeof examDbLoaded !== 'undefined' && !examDbLoaded) loadExamDB();
  if (mode === 'planner') renderPlannerEvents();
  renderLastSync(mode);
  try {
    localStorage.setItem('mts_last_mode', mode);
  } catch (e) {}
  if (!skipHash) {
    try {
      history.replaceState(null, '', location.pathname + location.search + '#' + mode);
    } catch (e) {}
  }
  updateQuickBar();
  if (!initial) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupTabs() {
  const bar = document.getElementById('segTabs');
  if (!bar) return;
  bar.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    const i = MODES.indexOf(currentMode);
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % MODES.length;
    if (e.key === 'ArrowLeft') n = (i + MODES.length - 1) % MODES.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = MODES.length - 1;
    e.preventDefault();
    selectMode(MODES[n]);
    const t = bar.querySelector(`[data-mode="${MODES[n]}"]`);
    if (t) t.focus();
  });
  window.addEventListener('hashchange', () => {
    const m = location.hash.replace('#', '');
    if (MODES.includes(m) && m !== currentMode) selectMode(m, { skipHash: true });
  });
}

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem('mts_theme', next);
  } catch (e) {}
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = next === 'dark' ? '#0b0d12' : '#ffffff';
}

/* ════════════════════════════════════════════════════════════════
   Floating quick-action toolbar (PDF · PNG · WhatsApp · GCal)
   ════════════════════════════════════════════════════════════════ */

const QUICK_ACTIONS = {
  class: { out: 'outputSection', pdf: 'downloadPDF', png: 'exportClassImage', wa: 'shareWA', gcal: 'syncClassToGCal' },
  exam: { out: 'examOutputSection', pdf: 'examDownloadPDF', png: 'examExportImage', wa: 'examShareWA', gcal: 'syncExamToGCal' },
  group: { out: 'grpResults', pdf: 'downloadGroupPDF', png: 'groupExportImage', wa: 'grpCopyWA', gcal: 'syncGroupToGCal' },
  personal: { out: 'psResults', pdf: 'downloadPersonalPDF', png: 'personalExportImage', wa: 'psShareWA', gcal: 'syncPersonalToGCal' },
  planner: { out: null, gcal: 'syncAllPlannerEvents' },
};

function _isShown(el) {
  if (!el) return false;
  if (el.classList.contains('visible')) return true;
  return !!el.style.display && el.style.display !== 'none';
}

function updateQuickBar() {
  const bar = document.getElementById('quickBar');
  if (!bar) return;
  const cfg = QUICK_ACTIONS[currentMode];
  const ready = cfg && (cfg.out === null ? true : _isShown(document.getElementById(cfg.out)));
  bar.classList.toggle('show', !!ready);
  bar.querySelectorAll('[data-q]').forEach((b) => {
    b.style.display = cfg && cfg[b.dataset.q] ? '' : 'none';
  });
}

function quickAction(kind, btn) {
  const cfg = QUICK_ACTIONS[currentMode];
  if (!cfg || !cfg[kind]) return;
  const fn = window[cfg[kind]];
  if (typeof fn !== 'function') return;
  if (kind === 'pdf') withButtonBusy(btn, '…', fn);
  else if (kind === 'wa') withButtonBusy(btn, '…', fn);
  else fn(btn);
}

function setupQuickBar() {
  const obs = new MutationObserver(updateQuickBar);
  Object.values(QUICK_ACTIONS).forEach((c) => {
    const el = c.out && document.getElementById(c.out);
    if (el) obs.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
  });
  updateQuickBar();
}

/* ════════════════════════════════════════════════════════════════
   Onboarding + PWA install banner
   ════════════════════════════════════════════════════════════════ */

function maybeShowOnboarding() {
  try {
    if (localStorage.getItem('mts_onboarded')) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('units') || params.get('exam') || params.get('group') || params.get('personal')) return;
    document.getElementById('onboardModal').classList.add('open');
  } catch (e) {}
}

function dismissOnboarding() {
  document.getElementById('onboardModal').classList.remove('open');
  try {
    localStorage.setItem('mts_onboarded', '1');
  } catch (e) {}
}

function setupPwaBanner() {
  const DISMISS_KEY = 'pwaBannerDismissedAt';
  const INSTALLED_KEY = 'pwaInstalled';
  const DISMISS_DAYS = 14;
  const banner = document.getElementById('pwaBanner');
  const textEl = document.getElementById('pwaBannerText');
  const installBtn = document.getElementById('pwaBannerInstall');
  const closeBtn = document.getElementById('pwaBannerClose');
  if (!banner) return;
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const recentlyDismissed = () => {
    const t = ls.get(DISMISS_KEY);
    return !!t && Date.now() - parseInt(t, 10) < DISMISS_DAYS * 864e5;
  };
  const dismiss = () => {
    banner.classList.remove('visible');
    ls.set(DISMISS_KEY, String(Date.now()));
  };
  const markInstalled = () => {
    ls.set(INSTALLED_KEY, '1');
    dismiss();
  };
  closeBtn.addEventListener('click', dismiss);
  const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (isStandalone) ls.set(INSTALLED_KEY, '1');
  const alreadyInstalled = ls.get(INSTALLED_KEY) === '1';
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  (async () => {
    let related = false;
    try {
      related = 'getInstalledRelatedApps' in navigator && (await navigator.getInstalledRelatedApps()).length > 0;
    } catch (e) {}
    if (related) markInstalled();
    if (isStandalone || alreadyInstalled || related || recentlyDismissed()) return;
    if (isIOS) {
      textEl.innerHTML = '<b>Install this app</b><span>Tap Share, then “Add to Home Screen”.</span>';
      installBtn.style.display = 'none';
      setTimeout(() => banner.classList.add('visible'), 1200);
    } else {
      let deferred = null;
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferred = e;
        banner.classList.add('visible');
      });
      installBtn.addEventListener('click', async () => {
        if (!deferred) return dismiss();
        deferred.prompt();
        await deferred.userChoice;
        deferred = null;
        markInstalled();
      });
      window.addEventListener('appinstalled', markInstalled);
    }
  })();
}

/* ════════════════════════════════════════════════════════════════
   Bootstrap
   ════════════════════════════════════════════════════════════════ */

function applyConfigText() {
  const notice = document.getElementById('searchNotice');
  if (notice) {
    notice.style.display = APP_CONFIG.searchNotice ? '' : 'none';
    const t = notice.querySelector('[data-notice-text]');
    if (t) t.textContent = APP_CONFIG.searchNotice;
  }
  document.querySelectorAll('[data-cfg="classesRunNotice"]').forEach((e) => (e.textContent = APP_CONFIG.classesRunNotice));
  document.querySelectorAll('[data-cfg="academicYear"]').forEach((e) => (e.value !== undefined ? (e.value = APP_CONFIG.academicYear) : (e.textContent = APP_CONFIG.academicYear)));
  document.querySelectorAll('[data-cfg="semesterLabel"]').forEach((e) => (e.textContent = APP_CONFIG.semesterLabel));
}

function bootstrap() {
  applyConfigText();
  setupTabs();
  setupQuickBar();
  setupPwaBanner();
  setupPalette();

  // Google Identity Services loads async — poll until it is ready.
  const waitForGIS = setInterval(() => {
    if (window.google && google.accounts) {
      clearInterval(waitForGIS);
      initGoogleCalendar();
    }
  }, 300);
  setTimeout(() => clearInterval(waitForGIS), 20000);

  _plannerPopulateSelects();
  _plannerLoad();
  renderPlannerEvents();

  init(); // class mode: load units, share URL, draft
  grpInit();
  psInit();
  const eDateEl = document.getElementById('eDate');
  if (eDateEl) eDateEl.min = todayISO();
  loadExamFromURL();
  loadGroupFromURL();
  loadPersonalFromURL();
  maybeShowOnboarding();

  // Pick the starting tab: a share link has already chosen one via selectMode().
  const q = new URLSearchParams(location.search);
  const shared = ['units', 'exam', 'group', 'personal'].find((k) => q.get(k));
  if (!shared) {
    const fromHash = location.hash.replace('#', '');
    const fromParam = q.get('mode');
    let last = null;
    try { last = localStorage.getItem('mts_last_mode'); } catch (e) {}
    selectMode([fromParam, fromHash, last, 'class'].find((m) => MODES.includes(m)), { initial: true });
  } else {
    updateQuickBar();
  }
  console.log('%cMilton Tech KE', 'color:#f97316;font-size:18px;font-weight:700;', '— Maseno Timetable Generator · miltontech.co.ke');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
else bootstrap();
