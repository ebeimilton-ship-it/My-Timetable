/* ──────────────────────────────────────────────────────────────
   exam.js — Exam timetable mode: entry, validation, generation, sharing.
   ────────────────────────────────────────────────────────────── */

let examUnits = [];
const MIN_EXAM_UNITS = 2;

const EXAM_SESSIONS = {
  morning: { timeStr: '8:30 – 11:30', start: 8.5 },
  afternoon: { timeStr: '12:00 – 3:00', start: 12 },
  evening: { timeStr: '3:30 – 6:30', start: 15.5 },
};

function loadExamFromGCal() {
  const statusEl = document.getElementById('examGCalStatus');
  const noticeEl = document.getElementById('examNoSyncNotice');
  statusEl.style.display = 'block';
  statusEl.style.color = 'var(--muted)';
  noticeEl.style.display = 'none';
  statusEl.textContent = '⏳ Connecting to Google Calendar…';
  withGCalToken(
    async () => {
      try {
        const events = await fetchGCalExamEvents();
        if (!events.length) {
          statusEl.style.display = 'none';
          noticeEl.style.display = 'block';
          return;
        }
        let added = 0,
          updated = 0;
        for (const ev of events) {
          const asMinutes = ev.start * 60;
          let timeStr;
          if (asMinutes <= 600) timeStr = EXAM_SESSIONS.morning.timeStr;
          else if (asMinutes <= 780) timeStr = EXAM_SESSIONS.afternoon.timeStr;
          else timeStr = EXAM_SESSIONS.evening.timeStr;
          const entry = { code: ev.code, name: ev.name, date: ev.date, start: ev.start, dur: ev.dur, timeStr, venue: ev.venue };
          const idx = examUnits.findIndex((u) => u.code === ev.code);
          if (idx >= 0) {
            examUnits[idx] = entry;
            updated++;
          } else {
            examUnits.push(entry);
            added++;
          }
        }
        renderExamTags();
        statusEl.style.color = '#22c55e';
        const parts = [];
        if (added) parts.push(`imported ${added} new exam${added !== 1 ? 's' : ''}`);
        if (updated) parts.push(`refreshed ${updated} exam${updated !== 1 ? 's' : ''} already on your list`);
        statusEl.textContent = `✅ ${parts.join(' and ')} from Google Calendar. 👇 Scroll down to see ${added + updated !== 1 ? 'them' : 'it'} in your exam list below. Tap ✏ on any exam to edit it.`;
        if (document.getElementById('examOutputSection').classList.contains('visible')) {
          generateExam(true);
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

function importExamsFromClassSchedule() {
  const statusEl = document.getElementById('examClassMatchStatus');
  const noticeEl = document.getElementById('examClassNoSyncNotice');
  statusEl.style.display = 'block';
  statusEl.style.color = 'var(--muted)';
  noticeEl.style.display = 'none';
  statusEl.textContent = '⏳ Connecting to Google Calendar…';
  withGCalToken(
    async () => {
      try {
        const classEvents = await fetchGCalClassEvents();
        if (!classEvents.length) {
          statusEl.style.display = 'none';
          noticeEl.style.display = 'block';
          return;
        }

        const seen = new Map();
        for (const ev of classEvents) if (!seen.has(ev.code)) seen.set(ev.code, ev.name);

        if (!examDbLoaded) {
          statusEl.textContent = '⏳ Loading exam database…';
          await loadExamDB();
        }
        if (!examDbLoaded || !allExamDB.length) {
          statusEl.style.color = 'var(--danger)';
          statusEl.textContent = '❌ Exam database unavailable right now. Please try again shortly, or add exams manually below.';
          return;
        }

        let added = 0,
          skipped = 0;
        const notFound = [];
        for (const [code, name] of seen) {
          const dbMatch = allExamDB.find((u) => u.code && u.code.toUpperCase() === code.toUpperCase());
          if (!dbMatch) {
            notFound.push(code);
            continue;
          }
          if (examUnits.find((u) => u.code === dbMatch.code)) {
            skipped++;
            continue;
          }

          const venueStr = Array.isArray(dbMatch.venues) && dbMatch.venues.length ? dbMatch.venues.join(', ') : dbMatch.venue || '';
          let startH = null;
          if (dbMatch.start !== undefined && dbMatch.start !== null) {
            const startMinutes = parseInt(dbMatch.start);
            startH = startMinutes >= 60 ? Math.floor(startMinutes / 60) + (startMinutes % 60) / 60 : startMinutes;
          }
          const dur =
            dbMatch.dur !== undefined ? parseFloat(dbMatch.dur) : dbMatch.duration !== undefined ? parseFloat(dbMatch.duration) : 3;
          let session = 'morning';
          if (startH >= 15) session = 'evening';
          else if (startH >= 12) session = 'afternoon';
          const timeStr = EXAM_SESSIONS[session].timeStr;

          examUnits.push({
            code: dbMatch.code,
            name: dbMatch.name || name,
            date: dbMatch.date,
            start: startH,
            dur,
            timeStr,
            venue: venueStr,
          });
          added++;
        }

        renderExamTags();

        const msgParts = [];
        if (added)
          msgParts.push(
            `✅ Matched ${added} exam${added !== 1 ? 's' : ''} from your class schedule. 👇 Scroll down to see ${added !== 1 ? 'them' : 'it'} in your exam list below.`,
          );
        if (skipped) msgParts.push(`${skipped} already added.`);
        if (notFound.length)
          msgParts.push(
            `We couldn't find ${notFound.length} unit${notFound.length !== 1 ? 's' : ''} (${notFound.join(', ')}) in the exam database yet — feel free to add ${notFound.length !== 1 ? 'them' : 'it'} manually below, or check back later in case the database has been updated.`,
          );
        if (!msgParts.length) msgParts.push('⚠️ None of your synced classes matched an exam yet.');
        const msg = msgParts.join(' ');
        statusEl.style.color = added ? '#22c55e' : notFound.length ? 'var(--muted)' : 'var(--danger)';
        statusEl.textContent = msg;

        if (document.getElementById('examOutputSection').classList.contains('visible')) {
          generateExam(true);
        }
      } catch (e) {
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = '❌ Failed to read your class schedule. Please try again.';
      }
    },
    () => {
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = '❌ Google sign-in was cancelled or failed. Please try again.';
    },
  );
}

function addExamUnit() {
  const code = document.getElementById('eCode').value.trim().toUpperCase();
  const name = document.getElementById('eName').value.trim();
  const date = document.getElementById('eDate').value;
  const session = document.getElementById('eStart').value;
  const dur = parseFloat(document.getElementById('eDur').value);
  const venue = document.getElementById('eVenue').value.trim();
  const err = document.getElementById('examError');

  if (!code || !name || !date || !session || !venue) {
    err.textContent = 'Please fill in all fields.';
    err.classList.add('visible');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(date + 'T00:00:00') < today) {
    err.textContent = 'Exam date cannot be in the past.';
    err.classList.add('visible');
    return;
  }
  const { timeStr, start } = EXAM_SESSIONS[session];
  if (examUnits.find((u) => u.code === code)) {
    err.textContent = `${code} has already been added. Each unit can only be added once.`;
    err.classList.add('visible');
    return;
  }
  examUnits.push({ code, name, date, start, dur, timeStr, venue });
  renderExamTags();
  err.classList.remove('visible');

  ['eCode', 'eName', 'eVenue'].forEach((id) => (document.getElementById(id).value = ''));
  document.getElementById('eDate').value = '';
  document.getElementById('eStart').value = '';

  if (document.getElementById('examOutputSection').classList.contains('visible')) {
    generateExam(true);
  }
}

function renderExamTags() {
  const container = document.getElementById('examTags');
  const count = document.getElementById('examCount');
  container.innerHTML = examUnits
    .map(
      (u, i) => `
<div class="unit-tag">
${unitColorSwatchHtml(u.code, 'renderExamTags')}
<span>${escapeHtml(u.code)} <span style="font-size:0.68rem;opacity:0.65">${escapeHtml(formatDate(u.date) || u.date)}</span></span>
<span class="edit-tag" title="Edit exam" onclick="openExamEditModal({code:examUnits[${i}].code,name:examUnits[${i}].name,date:examUnits[${i}].date,startH:examUnits[${i}].start,dur:examUnits[${i}].dur,venue:examUnits[${i}].venue}, ${i})">✏</span>
<span class="rm" onclick="removeExam(${i})">×</span>
</div>
`,
    )
    .join('');
  count.textContent =
    examUnits.length < MIN_EXAM_UNITS
      ? `${examUnits.length} exam${examUnits.length !== 1 ? 's' : ''} added · need ${MIN_EXAM_UNITS - examUnits.length} more to generate (min ${MIN_EXAM_UNITS})`
      : `${examUnits.length} exam${examUnits.length !== 1 ? 's' : ''} added`;
  saveDraft('mts_draft_exam', {
    units: examUnits,
    name: document.getElementById('examStudentName').value.trim(),
    year: document.getElementById('examStudentYear').value,
    dept: document.getElementById('examStudentDept').value.trim(),
  });
}

function removeExam(i) {
  examUnits.splice(i, 1);
  renderExamTags();
  const examOutputSection = document.getElementById('examOutputSection');
  if (examOutputSection.classList.contains('visible')) {
    if (examUnits.length >= MIN_EXAM_UNITS) {
      generateExam(true);
    } else {
      examOutputSection.classList.remove('visible');
    }
  }
}

function generateExam(silent = false) {
  if (silent) {
    _generateExamImpl(silent);
    return;
  }
  const btn = document.getElementById('examGenerateBtn');
  if (btn) {
    if (btn.disabled) return;
    btn.dataset.origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ Building…';
  }
  setTimeout(() => {
    const ok = _generateExamImpl(silent);
    if (btn) {
      if (ok) {
        flashBuildSuccess(btn, btn.dataset.origHtml, '✓ Exam Timetable Built!');
      } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.origHtml;
      }
    }
  }, 80);
}
function _generateExamImpl(silent = false) {
  const examErrEl = document.getElementById('examTargetError');
  if (examUnits.length < MIN_EXAM_UNITS) {
    const need = MIN_EXAM_UNITS - examUnits.length;
    if (examErrEl)
      examErrEl.textContent = `Add ${need} more exam unit${need !== 1 ? 's' : ''} above before building (minimum ${MIN_EXAM_UNITS}).`;
    if (!silent) showToast(`Add at least ${MIN_EXAM_UNITS} exam units first.`, 'error');
    return false;
  }
  if (examErrEl) examErrEl.textContent = '';

  const sorted = [...examUnits].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.start - b.start;
  });

  const conflicts = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[i].date === sorted[j].date) {
        const endI = sorted[i].start + sorted[i].dur;
        if (sorted[j].start < endI) {
          conflicts.push(`${escapeHtml(sorted[i].code)} &amp; ${escapeHtml(sorted[j].code)} overlap on ${formatDate(sorted[i].date)}`);
        }
      }
    }
  }

  const cBox = document.getElementById('examConflictBox');
  const cList = document.getElementById('examConflictList');
  if (conflicts.length) {
    cList.innerHTML = conflicts.map((c) => `<li>${c}</li>`).join('');
    cBox.classList.add('visible');
  } else {
    cBox.classList.remove('visible');
  }

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

  const uniqueDates = [...new Set(sorted.map((u) => u.date))];
  document.getElementById('examSummaryBar').innerHTML = `
<div class="summary-stat"><span>${sorted.length}</span>Exams</div>
<div class="summary-stat"><span>${uniqueDates.length}</span>Exam Days</div>
`;

  const grid = document.getElementById('examGrid');
  const rows = sorted
    .map(
      (u, i) => `
<tr>
<td class="num">${i + 1}</td>
<td><div class="exam-cell"><div class="cell-code">${escapeHtml(u.code)}</div></div></td>
<td class="left">${escapeHtml(u.name)}</td>
<td class="strong">${formatDate(u.date)}</td>
<td class="time">${u.timeStr}</td>
<td class="muted">${escapeHtml(u.venue)}</td>
</tr>
`,
    )
    .join('');

  grid.innerHTML = `
<table class="tt-table">
<thead>
<tr>
<th>#</th>
<th>Code</th>
<th class="left">Unit Name</th>
<th>Date</th>
<th>Time</th>
<th>Venue</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>
`;

  const examPayload = { units: examUnits, name, year, dept };
  const examQuery = `exam=${encodeURIComponent(JSON.stringify(examPayload))}`;
  document.getElementById('examShareLink').value = `${location.origin}${location.pathname}?${examQuery}`;
  try {
    history.replaceState(null, '', `?${examQuery}`);
  } catch (e) {}

  document.getElementById('examOutputSection').classList.add('visible');
  if (!silent) document.getElementById('examOutputSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

function copyExamLink() {
  copyShareLink('examShareLink', 'examCopyBtn', 'Copy Editable Link', 'exam');
}

function saveExamDraftFields() {
  saveDraft('mts_draft_exam', {
    units: examUnits,
    name: document.getElementById('examStudentName').value.trim(),
    year: document.getElementById('examStudentYear').value,
    dept: document.getElementById('examStudentDept').value.trim(),
  });
}

function restoreExamDraft() {
  const draft = loadDraft('mts_draft_exam');
  if (!draft || !Array.isArray(draft.units) || !draft.units.length) return;
  examUnits = draft.units;
  if (draft.name) document.getElementById('examStudentName').value = draft.name;
  if (draft.year) document.getElementById('examStudentYear').value = draft.year;
  if (draft.dept) document.getElementById('examStudentDept').value = draft.dept;
  renderExamTags();
}

function loadExamFromURL() {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('exam');
  if (!data) {
    restoreExamDraft();
    return;
  }
  try {
    const payload = JSON.parse(data);
    if (Array.isArray(payload.units)) examUnits = payload.units;
    if (payload.name) document.getElementById('examStudentName').value = payload.name;
    if (payload.year) document.getElementById('examStudentYear').value = payload.year;
    if (payload.dept) document.getElementById('examStudentDept').value = payload.dept;
    selectMode('exam', { skipHistoryPush: true });
    renderExamTags();
    if (examUnits.length >= MIN_EXAM_UNITS) generateExam(true);
  } catch (e) {
    console.warn('Failed to restore shared exam link:', e);
  }
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function examShareWA() {
  const name = document.getElementById('examStudentName').value.trim();
  const dept = document.getElementById('examStudentDept').value.trim();
  const sorted = [...examUnits].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  let msg = name ? `📋 *${name}'s Maseno Exam Timetable*\n\n` : `📋 *Maseno University Exam Timetable*\n\n`;
  if (dept) msg += `🏫 ${dept}\n\n`;
  sorted.forEach((u, i) => {
    msg += `${i + 1}. *${u.code}* — ${u.name}\n   📅 ${formatDate(u.date)} | ⏰ ${u.timeStr} | 📍 ${u.venue}\n\n`;
  });
  msg += `Generated by Milton Tech — miltontech.co.ke/timetable`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function examShareNative() {
  const name = document.getElementById('examStudentName').value.trim();
  const title = name ? `${name}'s Maseno Exam Timetable` : 'My Maseno Exam Timetable';
  const sorted = [...examUnits].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  let text = title + '\n\n';
  sorted.forEach((u, i) => {
    text += `${i + 1}. ${u.code} — ${u.name}\n   ${formatDate(u.date)} | ${u.timeStr} | ${u.venue}\n\n`;
  });
  if (navigator.share) {
    navigator.share({ title, text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => showToast('Exam timetable copied to clipboard!', 'success'));
  }
}

function resetExam() {
  examUnits = [];
  renderExamTags();
  ['examStudentName', 'eCode', 'eName', 'eVenue'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('examStudentYear').value = '';
  document.getElementById('examStudentDept').value = '';
  document.getElementById('examStudentSemester').value = '1';
  document.getElementById('eDate').value = '';
  document.getElementById('eStart').value = '';
  document.getElementById('examOutputSection').classList.remove('visible');
  document.getElementById('examConflictBox').classList.remove('visible');
  try {
    history.replaceState(null, '', location.pathname);
  } catch (e) {}
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let allExamDB = [];
let examDbLoaded = false;

function openExamEditModal(data, editIdx) {
  document.getElementById('exmCode').value = data.code || '';
  document.getElementById('exmName').value = data.name || '';
  document.getElementById('exmDate').min = todayISO();
  document.getElementById('exmDate').value = data.date || '';
  document.getElementById('exmVenue').value = data.venue || '';

  const h = data.startH;
  let session = '';
  if (h !== null && h !== undefined) {
    const asMinutes = h >= 60 ? h : h * 60;
    if (asMinutes <= 600) session = 'morning';
    else if (asMinutes <= 780) session = 'afternoon';
    else session = 'evening';
  }
  document.getElementById('exmStart').value = session;
  document.getElementById('exmDur').value = data.dur || 3;

  _editingExamIdx = editIdx !== undefined ? editIdx : -1;
  const isEdit = _editingExamIdx >= 0;
  document.querySelector('#examEditModal .modal-title').textContent = isEdit ? 'Edit Exam Details' : 'Confirm Exam Details';
  document.querySelector('#examEditModal .btn-primary').textContent = isEdit ? 'Save Changes' : 'Add Exam';
  document.getElementById('exmDisclaimerBanner').style.display = isEdit ? 'none' : 'flex';

  document.getElementById('exmError').textContent = '';
  document.getElementById('examEditModal').classList.add('open');
}

function closeExamEditModal() {
  document.getElementById('examEditModal').classList.remove('open');
  _editingExamIdx = -1;
}

function confirmExamAdd() {
  const code = document.getElementById('exmCode').value.trim().toUpperCase();
  const name = document.getElementById('exmName').value.trim();
  const date = document.getElementById('exmDate').value;
  const session = document.getElementById('exmStart').value;
  const dur = parseFloat(document.getElementById('exmDur').value);
  const venue = document.getElementById('exmVenue').value.trim();
  const err = document.getElementById('exmError');

  if (!code || !name || !date || !session || !venue) {
    err.textContent = 'Please fill in all required fields.';
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(date + 'T00:00:00') < today) {
    err.textContent = 'Exam date cannot be in the past.';
    return;
  }
  const { timeStr, start } = EXAM_SESSIONS[session];
  const duplicate = examUnits.find((u, i) => i !== _editingExamIdx && u.code === code);
  if (duplicate) {
    err.textContent = `${code} has already been added. Each unit can only be added once.`;
    return;
  }

  const updated = { code, name, date, start, dur, timeStr, venue };
  if (_editingExamIdx >= 0) {
    examUnits[_editingExamIdx] = updated;
  } else {
    examUnits.push(updated);
  }
  renderExamTags();
  document.getElementById('examError').classList.remove('visible');
  closeExamEditModal();
  if (document.getElementById('examOutputSection').classList.contains('visible')) {
    generateExam(true);
  }
}

document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.exam-search-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('examDropdown').classList.remove('open');
  }
});
