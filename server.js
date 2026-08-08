// GoDaddy-compatible llama.cpp server
// Pure Node.js http module - zero dependencies
// Includes web UI for testing chat completions
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const MODEL_URL = process.env.MODEL_URL || 'https://huggingface.co/Xenova/quantized-gpt2/resolve/main/gpt2-q4_0.gguf';
const LLAMA_PROXY = process.env.LLAMA_PROXY || null;

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
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  // Web UI
  if (pathname === '/chat' || pathname === '/ui') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LLaMA Chat</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .chat-container { background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); overflow: hidden; }
    #chat-messages { height: 500px; overflow-y: auto; padding: 20px; }
    .message { margin-bottom: 15px; padding: 12px 16px; border-radius: 8px; }
    .user { background: #e3f2fd; margin-left: auto; max-width: 80%; }
    .assistant { background: #f1f1f1; margin-right: auto; max-width: 80%; }
    .input-container { display: flex; padding: 15px; border-top: 1px solid #eee; }
    #message-input { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 20px; outline: none; }
    button { padding: 12px 20px; margin-left: 10px; background: #28a745; color: white; border: none; border-radius: 20px; cursor: pointer; }
    button:hover { background: #218838; }
    button:disabled { background: #ccc; }
  </style>
</head>
<body>
  <h1>Free LLM Chat</h1>
  <p>Using <strong>llama.cpp</strong> (<a href="${MODEL_URL}" target="_blank">model link</a>)</p>
  <div class="chat-container">
    <div id="chat-messages"></div>
    <div class="input-container">
      <input type="text" id="message-input" placeholder="Type a message..." autocomplete="off">
      <button onclick="sendMessage()" id="send-btn">Send</button>
    </div>
  </div>
  <script>
    async function sendMessage() {
      const input = document.getElementById('message-input');
      const message = input.value.trim();
      if (!message) return;
      
      const btn = document.getElementById('send-btn');
      btn.disabled = true;
      
      const messagesDiv = document.getElementById('chat-messages');
      messagesDiv.innerHTML += '<div class="message user"><strong>You:</strong> ' + message + '</div>';
      input.value = '';
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      
      try {
        const resp = await fetch('/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: message }],
            max_tokens: 500,
            temperature: 0.7
          })
        });
        
        const data = await resp.json();
        const reply = data.choices[0].message.content;
        
        messagesDiv.innerHTML += '<div class="message assistant"><strong>Assistant:</strong> ' + reply + '</div>';
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      } catch (err) {
        messagesDiv.innerHTML += '<div class="message assistant"><strong>Error:</strong> Failed to get response</div>';
      }
      
      btn.disabled = false;
    }
    
    document.getElementById('message-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  </script>
</body>
</html>`);
    return;
  }
  
  // Health check
  if (pathname === '/health' || pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      node_version: process.version,
      timestamp: new Date().toISOString(),
      service: 'free-llm-llamacpp',
      model_url: MODEL_URL,
      proxy_target: LLAMA_PROXY || 'none',
      ui: '/chat'
    }));
    return;
  }
  
  if (pathname === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'gpt2-llamacpp', object: 'model' }] }));
    return;
  }
  
  if (pathname === '/v1/chat/completions' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        
        if (LLAMA_PROXY) {
          try {
            const result = await makeProxyRequest(`${LLAMA_PROXY}/v1/chat/completions`, { method: 'POST' }, payload);
            res.writeHead(result.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.data));
            return;
          } catch (err) { console.error('Proxy failed:', err.message); }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000), 
          model: 'gpt2-llamacpp',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: `llama.cpp gateway running on GoDaddy. Set LLAMA_PROXY env var to proxy to a remote llama.cpp server.` },
            finish_reason: 'stop'
          }]
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON', detail: err.message }));
      }
    });
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', paths: ['/health', '/v1/models', '/v1/chat/completions', '/chat'] }));
});

server.listen(PORT, HOST, () => {
  console.log(`[${new Date().toISOString()}] llama.cpp server running on ${HOST}:${PORT}`);
  console.log(`Model URL: ${MODEL_URL}`);
  console.log(`Web UI: /chat`);
  console.log(`Node.js version: ${process.version}`);
});

process.on('uncaughtException', (err) => console.error('[ERROR] Uncaught:', err.message));
process.on('unhandledRejection', (reason) => console.error('[ERROR] Unhandled rejection:', reason));
