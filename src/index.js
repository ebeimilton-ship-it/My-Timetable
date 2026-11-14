/**
 * Maseno Timetable — Cloudflare Worker entry.
 *
 * Static files are served natively by Workers Static Assets under /timetable
 * (see `assets.base_path` in wrangler.jsonc), so this Worker stays tiny. It only
 * runs for the paths listed in `assets.run_worker_first` and for requests that
 * don't match a static asset.
 *
 *   /timetable            → 301 /timetable/   (relative ./styles & ./js paths need the slash)
 *   /timetable.html?...   → 301 /timetable/?... (old shared links keep working)
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/timetable' || url.pathname === '/timetable.html' || url.pathname === '/timetable/index.html') {
      url.pathname = '/timetable/';
      return Response.redirect(url.toString(), 301); // query string (?units=…) is preserved
    }

    const response = await env.ASSETS.fetch(request);

    // Light hardening on top of whatever the asset response already carries.
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
