// 離線快取：現場收訊差也打得開
const CACHE = 'fireball2026-v3';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 一鍵加入行事曆：把選的場次合成一個 .ics
async function calEvent(id){
  const req = new Request(new URL('cal-' + id + '.ics', self.registration.scope));
  let r;
  try { r = await fetch(req); if (r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()); } } catch (err) { r = await caches.match(req); }
  if (!r || !r.ok) r = await caches.match(req);
  if (!r) return '';
  const m = (await r.text()).match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/);
  return m ? m[0] : '';
}
async function lineupICS(url){
  const ids = (url.searchParams.get('e') || '').split(',').filter(x => /^d[12]-(fire|ball|fest|vill|sp)-\d{4}$/.test(x));
  const events = (await Promise.all(ids.map(calEvent))).filter(Boolean);
  const body = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//fireball-lineup//TW','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Fireball 2026 我的 Lineup', ...events, 'END:VCALENDAR'].join('\r\n') + '\r\n';
  return new Response(body, {headers: {'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="fireball2026-lineup.ics"', 'Cache-Control': 'no-store'}});
}
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin && url.pathname.endsWith('/my-lineup.ics')) { e.respondWith(lineupICS(url)); return; }
  if (url.origin === location.origin) {
    // 網路優先（拿到最新節目表），失敗就用快取
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
  } else if (/fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    })));
  }
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(cs => cs.length ? cs[0].focus() : clients.openWindow('./')));
});
