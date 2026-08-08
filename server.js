// Minimal test server for llama.cpp Node.js integration
const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    node_version: process.version,
    platform: process.platform
  });
});

app.get('/test', async (req, res) => {
  try {
    // Placeholder for llama.cpp integration
    res.json({ 
      status: 'llama-cpp', 
      note: 'llama-cpp-wasm is not available, will implement custom GGUF loader',
      success: true 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`llama.cpp API running on ${HOST}:${PORT}`);
  console.log(`Node version: ${process.version}`);
});
