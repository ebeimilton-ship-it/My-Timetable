/* ──────────────────────────────────────────────────────────────
   config.js — API endpoints, keys and app-wide constants.
   The Supabase keys below are public *anon* keys (safe to ship in
   the browser; protect data with Row Level Security).
   ────────────────────────────────────────────────────────────── */

// Exam database project (table: exams)
const SUPABASE_URL = 'https://pkwgjhznnsmjyotectkq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrd2dqaHpubnNtanlvdGVjdGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDA2MTcsImV4cCI6MjA5ODExNjYxN30.QxWPc8lK37aMSNMC2Osogd0Ppqk4g6k7YIq69aeumzc';

// Class database project (view/table: units_flat)
const CLASS_SUPABASE_URL = 'https://kohcjexytasvrbyamzyu.supabase.co';
const CLASS_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvaGNqZXh5dGFzdnJieWFtenl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0Nzc4NDUsImV4cCI6MjA5ODA1Mzg0NX0.-pSYkC7t_HM_5tRzS_ke2V2LZJ91N0H8v6DlRNShMzM';

// Google Identity Services / Calendar
const GCAL_CLIENT_ID = '1082230397020-1kglb1af33ic50dpmjhl47vj6egtmhsg.apps.googleusercontent.com';
const GCAL_SCOPE     = 'https://www.googleapis.com/auth/calendar.events';

// Public path this app is served from (must match wrangler assets.base_path)
const APP_BASE_PATH = '/timetable';
const APP_SHARE_URL = 'miltontech.co.ke/timetable';

// Academic calendar — update each semester
const APP_CONFIG = {
  academicYear: '2026/2027',
  semesterLabel: 'Semester 1',
  semesterNumber: 1,
  semesterEnd: new Date(2026, 10, 27),           // 27 Nov 2026 (month is 0-based)
  classesRunNotice: 'Official Semester 1 classes run from 31st August to 27th November 2026.',
  // Shown above the unit search. Set to '' to hide it.
  searchNotice: 'Making updates to Semester 1, Academic Year 26/27. Unit search will be back online shortly.',
  maxUnits: 18,
  minClassUnits: 2,
  minExamUnits: 2
};

// Logo lookup order (first one that loads wins)
const LOGO_SOURCES = ['./assets/masenologo.png', '/masenologo.png'];
