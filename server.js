// GoDaddy-compatible server - pure Node.js, no native modules
const http = require('http');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`).pathname;
  
  if (url === '/health' || url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      node_version: process.version,
      timestamp: new Date().toISOString(),
      service: 'free-llm-llamacpp'
    }));
  } else if (url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      data: [{ id: 'llama-2-7b', object: 'model' }] 
    }));
  } else if (url === '/v1/chat/completions' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: `chatcmplt-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'llama-2-7b',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'llama.cpp integration pending - this endpoint will be functional soon.'
        },
        finish_reason: 'stop'
      }]
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[${new Date().toISOString()}] Server running on ${HOST}:${PORT}`);
  console.log(`Node.js version: ${process.version}`);
});

process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ERROR] Unhandled rejection:', reason);
});
