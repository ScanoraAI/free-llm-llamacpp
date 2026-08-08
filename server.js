// GoDaddy-compatible llama.cpp server
// Pure Node.js http module - zero dependencies
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const MODEL_URL = process.env.MODEL_URL || 'https://huggingface.co/Xenova/quantized-gpt2/resolve/main/gpt2-q4_0.gguf';
const LLAMA_PROXY = process.env.LLAMA_PROXY || null; // Proxy to VM

function makeProxyRequest(targetUrl, options, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const lib = targetUrl.startsWith('https') ? https : http;
    const req = lib.request(targetUrl, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(responseBody) }); }
        catch(e) { resolve({ status: res.statusCode, headers: res.headers, data: responseBody }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy());
    if (data) req.write(data);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`).pathname;
  
  if (url === '/health' || url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      node_version: process.version,
      timestamp: new Date().toISOString(),
      service: 'free-llm-llamacpp',
      model_url: MODEL_URL,
      proxy_target: LLAMA_PROXY || 'none'
    }));
    return;
  }
  
  if (url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'gpt2-llamacpp', object: 'model' }] }));
    return;
  }
  
  if (url === '/v1/chat/completions' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        
        if (LLAMA_PROXY) {
          try {
            const proxyResult = await makeProxyRequest(LLAMA_PROXY, { method: 'POST', path: '/v1/chat/completions' }, payload);
            res.writeHead(proxyResult.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(proxyResult.data));
            return;
          } catch (proxyError) { console.error('Proxy failed:', proxyError.message); }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: `chatcmpl-${Date.now()}`, object: 'chat.completion',
          created: Math.floor(Date.now() / 1000), model: 'gpt2-llamacpp',
          choices: [{ index: 0, message: { role: 'assistant', content: `llama.cpp gateway running. To enable actual LLM responses, set the LLAMA_PROXY environment variable to your VM-hosted llama.cpp endpoint.` }, finish_reason: 'stop' }]
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON', detail: err.message }));
      }
    });
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`[${new Date().toISOString()}] llama.cpp gateway running on ${HOST}:${PORT}`);
  console.log(`Model URL: ${MODEL_URL}`);
  console.log(`Node.js version: ${process.version}`);
});

process.on('uncaughtException', (err) => console.error('[ERROR] Uncaught:', err.message));
process.on('unhandledRejection', (reason) => console.error('[ERROR] Unhandled rejection:', reason));
