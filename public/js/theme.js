/* Applies the saved colour theme before first paint (no flash). */
(function () {
  try {
    var t = localStorage.getItem('mts_theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.dataset.theme = t;
      var m = document.querySelector('meta[name="theme-color"]');
      if (m && t === 'dark') m.content = '#0b0d12';
    }
  } catch (e) {}
})();
