// Private, authenticated start signal. No Docker socket, public port or shell input.
const http = require('node:http');
const { timingSafeEqual } = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');

function createBackupServer({ secret = process.env.CRON_SECRET, directory = '/backups', launch = spawn } = {}) {
  if (!secret) throw Error('CRON_SECRET is required');
  const children = new Map();
  const server = http.createServer(async (req, res) => {
    const reply = (status, body) => {
      if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
    };
    if (req.method === 'GET' && req.url === '/health') return reply(200, { ready: true });
    const received = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from('Bearer ' + secret);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return reply(401, { error: 'Unauthorized' });
    if (req.method !== 'POST' || req.url !== '/start') return reply(404, { error: 'Not found' });
    if (req.headers['transfer-encoding'] || !/^\d+$/.test(req.headers['content-length'] || '') || Number(req.headers['content-length']) > 1024) return reply(413, { error: 'Invalid request size' });
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 1024) return reply(413, { error: 'Request too large' }); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const id = body?.runId;
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return reply(400, { error: 'Invalid backup identity' });
      const marker = `${directory}/backup-${id}.started`;
      let child = children.get(id);
      if (!child) {
        if (children.size) return reply(409, { error: 'A backup is already running' });
        try { fs.unlinkSync(marker); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        child = launch('/backup.sh', ['--manual', id], { stdio: 'inherit', shell: false });
        children.set(id, child);
        child.once('error', () => { children.delete(id); });
        child.once('exit', () => { children.delete(id); });
      }
      // Acknowledge only after the script has claimed this exact run and is
      // starting pg_dump, rather than merely accepting another waiting request.
      const deadline = Date.now() + 12_000;
      while (Date.now() < deadline) {
        if (fs.existsSync(marker)) return reply(202, { started: true, runId: id });
        if (child.exitCode !== null || child.signalCode || !children.has(id)) return reply(child.exitCode === 75 ? 409 : 503, { error: 'Backup could not start' });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return reply(503, { error: 'Backup did not confirm startup in time' });
    } catch (error) {
      return reply(error instanceof SyntaxError ? 400 : 503, { error: 'Backup request could not be processed' });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 20;
  server.on('close', () => { for (const child of children.values()) child.kill('SIGTERM'); });
  return server;
}
module.exports = { createBackupServer };
if (require.main === module) {
  const server = createBackupServer();
  server.listen(8788, '0.0.0.0');
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { server.close(); setTimeout(() => process.exit(0), 15_000).unref(); });
}
