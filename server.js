// GoDaddy-compatible server for llama.cpp API
const express = require('express');
const app = express();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    node_version: process.version,
    platform: process.platform
  });
});

// Chat endpoint - llama.cpp not available in this minimal version
app.post('/v1/chat/completions', express.json({limit: '1mb'}), async (req, res) => {
  res.status(503).json({ 
    error: 'llama.cpp not loaded in minimal mode',
    note: 'This is a fallback server - implement actual llama.cpp integration separately'
  });
});

// Models endpoint
app.get('/v1/models', (req, res) => {
  res.json({ data: [{ id: 'gpt2-llama-cpp', object: 'model' }] });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`llama.cpp API running on ${HOST}:${PORT}`);
});
