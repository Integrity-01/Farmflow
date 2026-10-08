/* Single-service verification: API now also serves the built web app. */
const BASE = 'http://localhost:4000';
let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}
async function main() {
  const home = await fetch(`${BASE}/`);
  const homeHtml = await home.text();
  check('GET / serves app shell', home.status === 200 && homeHtml.includes('<div id="root"'), `${home.status} len=${homeHtml.length}`);
  check('index.html no-store', (home.headers.get('cache-control') || '').includes('no-store'), home.headers.get('cache-control') || 'none');

  const spaDeep = await fetch(`${BASE}/tasks/abc123`);
  const spaHtml = await spaDeep.text();
  check('SPA fallback for /tasks/abc123', spaDeep.status === 200 && spaHtml.includes('<div id="root"'), `${spaDeep.status}`);

  const asset = /src="([^"]*assets\/[^"]+\.js)"/.exec(homeHtml);
  check('bundle referenced in index', Boolean(asset), homeHtml.slice(0, 300));
  if (asset) {
    const res = await fetch(`${BASE}${asset[1]}`);
    check('bundle served from API', res.status === 200, `${res.status}`);
    const cc = res.headers.get('cache-control') || '';
    check('bundle cache immutable', cc.includes('immutable'), cc);
  }

  const sw = await fetch(`${BASE}/sw.js`);
  check('GET /sw.js serves worker', sw.status === 200 && (sw.headers.get('content-type') || '').includes('javascript'), `${sw.status}`);
  check('sw.js no-store', (sw.headers.get('cache-control') || '').includes('no-store'));

  const manifest = await fetch(`${BASE}/manifest.webmanifest`);
  check('manifest served', manifest.status === 200 && (manifest.headers.get('content-type') || '').includes('json'), `${manifest.status} ${manifest.headers.get('content-type')}`);

  const api = await fetch(`${BASE}/api/ai/status`, { headers: { 'x-test': '1' } });
  check('GET /api/ai/status still guarded 401', api.status === 401, `${api.status}`);

  const missingUpload = await fetch(`${BASE}/uploads/does-not-exist-xyz.txt`);
  check('missing upload still 404 (not SPA)', missingUpload.status === 404, `${missingUpload.status}`);

  const unknown = await fetch(`${BASE}/api/nope`);
  check('unknown API path 404 JSON', unknown.status === 404 && (unknown.headers.get('content-type') || '').includes('application/json'), `${unknown.status}`);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });