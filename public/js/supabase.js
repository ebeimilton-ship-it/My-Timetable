/* ──────────────────────────────────────────────────────────────
   supabase.js — Supabase REST access: class-unit DB, exam DB and the unit search UI.
   ────────────────────────────────────────────────────────────── */

async function loadExamDB() {
  const dot = document.getElementById('examDbDot');
  const label = document.getElementById('examDbLabel');
  dot.className = 'exam-db-dot loading';
  label.textContent = 'Connecting to exam database…';
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/exams?select=*&order=date.asc,start.asc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (res.ok) {
      allExamDB = await res.json();
      examDbLoaded = true;
      document.getElementById('examDbStatus').style.display = 'none';
      return;
    }
  } catch (e) {
    console.warn('Exam DB fetch failed:', e);
  }
  dot.className = 'exam-db-dot error';
  label.textContent = 'Database unavailable — use manual entry below';
}

function examSearchInput(q) {
  const dd = document.getElementById('examDropdown');
  q = q.trim().toLowerCase();
  if (!q || allExamDB.length === 0) {
    dd.classList.remove('open');
    return;
  }

  const matches = allExamDB
    .filter((u) => (u.code && u.code.toLowerCase().includes(q)) || (u.name && u.name.toLowerCase().includes(q)))
    .slice(0, 8);

  if (!matches.length) {
    dd.innerHTML = `<div class="exam-drop-empty">No matching exams found</div>`;
    dd.classList.add('open');
    return;
  }

  dd.innerHTML = matches
    .map((u, i) => {
      const dateLabel = u.date
        ? new Date(u.date + 'T00:00:00').toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })
        : '';
      const dayLabel = u.day ? u.day : '';

      const venueLabel = Array.isArray(u.venues) ? u.venues.join(', ') : u.venue || '';

      const sessionLabels = { 510: 'Morning 8:30–11:30', 720: 'Afternoon 12:00–3:00', 930: 'Evening 3:30–6:30' };
      const sessionLabel = sessionLabels[u.start] || (u.start ? `${u.start} min` : '');
      const meta = [dateLabel, dayLabel, sessionLabel].filter(Boolean).join(' · ');
      const examArgs = `${i}, ${JSON.stringify(u).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}`;
      return `<div class="exam-drop-item" data-nav role="option" aria-selected="false" tabindex="-1" onclick="selectExamFromDB(${examArgs})">
<span class="exam-drop-code">${highlightMatch(u.code, q)}</span>
<span class="exam-drop-name">${highlightMatch(u.name, q)}</span>
<span class="exam-drop-meta">${escapeHtml(meta)}</span>
</div>`;
    })
    .join('');
  dd.classList.add('open');
}

function selectExamFromDB(i, u) {
  document.getElementById('examDropdown').classList.remove('open');
  document.getElementById('examUnitSearch').value = '';

  const venueStr = Array.isArray(u.venues) && u.venues.length ? u.venues.join(', ') : u.venue || '';

  let startH = null;
  if (u.start !== undefined && u.start !== null) {
    const startMinutes = parseInt(u.start);
    if (startMinutes >= 60) {
      startH = Math.floor(startMinutes / 60) + (startMinutes % 60) / 60;
    } else {
      startH = startMinutes;
    }
  } else if (u.time) {
    const m = String(u.time).match(/^(\d+)/);
    if (m) startH = parseInt(m[1]);
  }

  const dur = u.dur !== undefined ? parseFloat(u.dur) : u.duration !== undefined ? parseFloat(u.duration) : 3;

  openExamEditModal({ code: u.code, name: u.name, date: u.date, startH, dur, venue: venueStr });
}

let _editingExamIdx = -1;

async function loadUnits() {
  const skeleton = document.getElementById('searchSkeleton');
  const skeletonLabel = document.getElementById('searchSkeletonLabel');
  const searchWrap = document.getElementById('searchWrap');
  if (skeleton) {
    skeleton.classList.add('visible');
    skeletonLabel.classList.add('visible');
  }

  const CACHE_KEY = 'mts_units_cache_v2';
  const CACHE_TTL = 30 * 60 * 1000;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL && Array.isArray(data) && data.length > 0) {
        allUnits = data;
        dbConnected = true;
        if (skeleton) {
          skeleton.classList.remove('visible');
          skeletonLabel.classList.remove('visible');
        }
        if (searchWrap) searchWrap.style.display = 'block';

        _refreshUnitsCache();
        return;
      }
    }
  } catch (e) {}

  try {
    const res = await fetch(`${CLASS_SUPABASE_URL}/rest/v1/units_flat?select=*&order=code.asc`, {
      headers: {
        apikey: CLASS_SUPABASE_KEY,
        Authorization: `Bearer ${CLASS_SUPABASE_KEY}`,
      },
    });
    if (res.ok) {
      const rows = await res.json();
      allUnits = rows.map((u) => {
        const parsed = parseTime(u.time);
        return {
          ...u,
          startHour: u.startHour !== undefined ? Number(u.startHour) : parsed.start,
          duration: u.duration !== undefined ? Number(u.duration) : parsed.dur,
        };
      });
      dbConnected = true;

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: allUnits }));
      } catch (e) {}
      if (skeleton) {
        skeleton.classList.remove('visible');
        skeletonLabel.classList.remove('visible');
      }
      if (searchWrap) searchWrap.style.display = 'block';
      return;
    }
  } catch (e) {
    console.warn('Supabase fetch failed:', e);
  }
  allUnits = [];
  dbConnected = false;
  if (skeleton) {
    skeleton.classList.remove('visible');
    skeletonLabel.classList.remove('visible');
  }
  if (searchWrap) searchWrap.style.display = 'block';
}

async function _refreshUnitsCache() {
  const CACHE_KEY = 'mts_units_cache_v2';
  try {
    const res = await fetch(`${CLASS_SUPABASE_URL}/rest/v1/units_flat?select=*&order=code.asc`, {
      headers: { apikey: CLASS_SUPABASE_KEY, Authorization: `Bearer ${CLASS_SUPABASE_KEY}` },
    });
    if (res.ok) {
      const rows = await res.json();
      const fresh = rows.map((u) => {
        const parsed = parseTime(u.time);
        return {
          ...u,
          startHour: u.startHour !== undefined ? Number(u.startHour) : parsed.start,
          duration: u.duration !== undefined ? Number(u.duration) : parsed.dur,
        };
      });
      allUnits = fresh;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: fresh }));
    }
  } catch (e) {}
}

// Wraps the matched part of `text` in <mark> (text is HTML-escaped first).
function highlightMatch(text, q) {
  const safe = escapeHtml(text || '');
  if (!q) return safe;
  const i = safe.toLowerCase().indexOf(escapeHtml(q).toLowerCase());
  if (i < 0) return safe;
  const len = escapeHtml(q).length;
  return `${safe.slice(0, i)}<mark>${safe.slice(i, i + len)}</mark>${safe.slice(i + len)}`;
}

// Shared keyboard navigation for the command-palette style dropdowns.
// ↑/↓ move the highlight, Enter picks it, Esc closes.
function attachPaletteKeys(input, dropdown, itemSelector) {
  let active = -1;
  const items = () => [...dropdown.querySelectorAll(itemSelector)];
  const setActive = (i) => {
    const list = items();
    list.forEach((el, n) => {
      el.classList.toggle('active', n === i);
      el.setAttribute('aria-selected', n === i ? 'true' : 'false');
    });
    active = i;
    if (list[i]) {
      list[i].scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', list[i].id || '');
    }
  };
  input.addEventListener('keydown', (e) => {
    const list = items();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!dropdown.classList.contains('open') || !list.length) return;
      e.preventDefault();
      setActive(e.key === 'ArrowDown' ? (active + 1) % list.length : (active - 1 + list.length) % list.length);
    } else if (e.key === 'Enter') {
      if (!dropdown.classList.contains('open') || !list.length) return;
      e.preventDefault();
      (list[active] || list[0]).click();
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('open');
      active = -1;
    }
  });
  const reset = () => {
    active = -1;
  };
  input.addEventListener('input', reset);
  return reset;
}

function setupSearch() {
  const input = document.getElementById('unitSearch');
  const dropdown = document.getElementById('dropdown');
  if (!input || !dropdown) return;
  dropdown.setAttribute('role', 'listbox');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-controls', 'dropdown');
  input.setAttribute('aria-autocomplete', 'list');

  const render = () => {
    const raw = input.value.trim();
    const q = raw.toLowerCase();
    if (!q) {
      dropdown.classList.remove('open');
      return;
    }
    // A unit code can have several class sessions (day/time/venue) — group by code.
    const groups = [];
    const byCode = new Map();
    allUnits.forEach((u) => {
      if (!((u.code || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q))) return;
      let g = byCode.get(u.code);
      if (!g) {
        g = { code: u.code, name: u.name, sessions: [] };
        byCode.set(u.code, g);
        groups.push(g);
      }
      g.sessions.push(u);
    });
    const matches = groups.slice(0, 8);
    if (!matches.length) {
      dropdown.innerHTML = `<div class="dropdown-empty">No units found for “${escapeHtml(raw)}”</div>`;
    } else {
      dropdown.innerHTML = matches
        .map((g, n) => {
          const code = highlightMatch(g.code, raw);
          const name = highlightMatch(g.name, raw);
          if (g.sessions.length === 1) {
            const u = g.sessions[0];
            const meta = [u.day && u.day.slice(0, 3), u.time, u.venue].filter(Boolean).join(' · ');
            return `<div class="dropdown-item" id="ddi-${n}" data-nav role="option" aria-selected="false" tabindex="-1" onclick="selectUnit('${u.id}')">
<span class="code">${code}</span><span class="name">${name}</span><span class="meta">${escapeHtml(meta)}</span></div>`;
          }
          const codeAttr = escapeHtml(g.code).replace(/'/g, '&#39;');
          return `<div class="dropdown-group"><div class="dropdown-group-header" id="ddi-${n}" data-nav role="option" aria-selected="false" tabindex="-1" onclick="addAllSessions('${codeAttr}')">
<span class="code">${code}</span><span class="name">${name}</span><span class="session-count">${g.sessions.length} classes</span>
<button type="button" class="dropdown-addall-btn" tabindex="-1" onclick="event.stopPropagation(); addAllSessions('${codeAttr}')">➕ Add all</button></div></div>`;
        })
        .join('');
    }
    dropdown.classList.add('open');
  };

  const resetActive = attachPaletteKeys(input, dropdown, '[data-nav]');
  input.addEventListener('input', render);
  input.addEventListener('focus', () => {
    if (input.value.trim()) render();
  });
  input.addEventListener('input', resetActive);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) dropdown.classList.remove('open');
  });
}

// Focuses the unit search of the current tab (exam tab → exam search).
function setupPaletteFocus() {
  if (currentMode !== 'exam') selectMode('class');
  const el = document.getElementById(currentMode === 'exam' ? 'examUnitSearch' : 'unitSearch');
  if (el && el.offsetParent !== null) {
    el.focus();
    el.select();
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

// Ctrl/Cmd + K jumps straight to the unit search.
function setupPalette() {
  document.addEventListener('keydown', (e) => {
    if (!((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))) return;
    e.preventDefault();
    setupPaletteFocus();
  });
  const exam = document.getElementById('examUnitSearch');
  const dd = document.getElementById('examDropdown');
  if (exam && dd) attachPaletteKeys(exam, dd, '[data-nav]');
}
