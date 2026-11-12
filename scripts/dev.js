import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import workHandler from '../api/work.js';
import brandsHandler from '../api/brands.js';

const apiHandlers = new Map([
  ['/api/work', workHandler],
  ['/api/brands', brandsHandler],
]);
const maxBodyBytes = 4 * 1024 * 1024;
let viteProcess;
let stopping = false;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBodyBytes) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

const apiServer = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const handler = apiHandlers.get(url.pathname);
  if (!handler) return sendJson(res, 404, { error: 'API route not found.' });

  try {
    req.query = Object.fromEntries(url.searchParams.entries());
    req.body = await readJsonBody(req);

    const response = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        if (!res.headersSent) res.writeHead(this.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(body));
        return this;
      },
      setHeader(name, value) {
        res.setHeader(name, value);
      },
    };

    await handler(req, response);
    if (!res.writableEnded) sendJson(res, 500, { error: 'The API handler did not return a response.' });
  } catch (error) {
    if (res.writableEnded) return;
    if (error.statusCode) return sendJson(res, error.statusCode, { error: error.message });
    console.error('Local API request failed:', error);
    return sendJson(res, 500, { error: 'The request could not be completed.' });
  }
});

function stop() {
  if (stopping) return;
  stopping = true;
  apiServer.close();
  if (viteProcess && !viteProcess.killed) viteProcess.kill();
}

apiServer.on('error', (error) => {
  console.error(`Local API server could not start: ${error.message}`);
  process.exitCode = 1;
  stop();
});

apiServer.listen(3000, '127.0.0.1', () => {
  console.log('Local API server ready at http://127.0.0.1:3000');

  viteProcess = spawn(
    process.execPath,
    [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '0.0.0.0'],
    { stdio: 'inherit', env: process.env },
  );

  viteProcess.on('error', (error) => {
    console.error(`Vite could not start: ${error.message}`);
    process.exitCode = 1;
    stop();
  });

  viteProcess.on('exit', (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  });
});

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
