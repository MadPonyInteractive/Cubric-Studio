// Does Chromium's ResourceScheduler hold low-priority loads while N EventSources are open?
// usage: [ECT=3G] electron sse-sched.js <numEventSources>   (ECT forces Chromium's network-quality estimate)
const { app, BrowserWindow } = require('electron');
const http = require('http');
const N = Number(process.argv[process.argv.length - 1]) || 0;
if (process.env.ECT) app.commandLine.appendSwitch('force-effective-connection-type', process.env.ECT);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const page = `<!doctype html><body><div style="height:3000px"></div><script>
const t0 = performance.now(); const N = ${N};
for (let i = 0; i < N; i++) new EventSource('/sse/' + i);
setInterval(() => fetch('/poll'), 1000); // like the app's 1 s comfy/status poll
setTimeout(() => {
  const s = performance.now(); let done = 0; const times = [];
  for (let i = 0; i < 12; i++) { const im = new Image(); im.fetchPriority = 'low';
    im.onload = im.onerror = () => { times.push(Math.round(performance.now() - s)); if (++done === 12) document.title = 'DONE ' + JSON.stringify(times); };
    im.src = '/img/' + i + '.png?' + Math.random(); document.body.appendChild(im); }
}, 1500);
</script>`;
http.createServer((req, res) => {
  if (req.url.startsWith('/sse/')) { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }); res.write(': hi\n\n'); return; }
  if (req.url.startsWith('/img/')) { setTimeout(() => { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(png); }, 50); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page);
}).listen(0, '127.0.0.1', function () {
  const port = this.address().port;
  app.whenReady().then(() => {
    const w = new BrowserWindow({ show: false });
    w.on('page-title-updated', (_e, t) => { if (t.startsWith('DONE')) { console.log(`N=${N} ${t}`); app.exit(0); } });
    w.loadURL(`http://127.0.0.1:${port}/`);
    setTimeout(() => { console.log(`N=${N} TIMEOUT 70s`); app.exit(1); }, 70000);
  });
});
