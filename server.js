const express = require('express');
const { LLM } = require('llama-cpp-wasm');

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection at:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught Exception:', err);
  process.exit(1);
});

const app = express();
app.use(express.json({limit: '1mb'}));

const MODEL_URL = process.env.MODEL_URL || 'https://huggingface.co/Xenova/quantized-gpt2/resolve/main/gpt2-q4_0.gguf';

let llm = null;
let loading = false;

async function getLLM() {
  if (llm) return llm;
  if (loading) {
    while (!llm) await new Promise(r => setTimeout(r, 100));
    return llm;
  }
  loading = true;
  try {
    console.log(`[INFO] Loading model from: ${MODEL_URL}`);
    llm = new LLM({
      model: MODEL_URL,
      backend: 'wasm',
      n_threads: 1,
      n_ctx: 512,
    });
    await llm.init();
    console.log('[INFO] llama.cpp model loaded successfully');
  } catch (err) {
    console.error('[ERROR] LLM load failed:', err.message);
    throw err;
  } finally {
    loading = false;
  }
  return llm;
}

// Health check (always available)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: MODEL_URL, loaded: !!llm });
});

// Models endpoint
app.get('/v1/models', (req, res) => {
  res.json({ data: [{ id: 'gpt2-llama-cpp', object: 'model' }] });
});

// Chat completions
app.post('/v1/chat/completions', express.json({limit: '1mb'}), async (req, res) => {
  try {
    if (!llm) {
      await getLLM();
    }
    const { messages, max_tokens = 100, temperature = 0.7 } = req.body;
    const prompt = messages.map(m => 
      (m.role === 'user' ? 'USER: ' : 'ASSISTANT: ') + m.content
    ).join('\n') + '\nASSISTANT: ';

    const result = await llm.generate(prompt, {
      n_predict: Math.min(max_tokens, 200),
      temp: temperature,
      top_k: 40,
      top_p: 0.9,
      repeat_last_n: 32,
      repeat_penalty: 1.1,
      stream: false
    });

    res.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt2-llama-cpp',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: result.trim() },
        finish_reason: 'stop'
      }]
    });
  } catch (err) {
    console.error('[ERROR] Generation failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`[INFO] llama.cpp API listening on ${HOST}:${PORT}`);
  console.log(`[INFO] Model: ${MODEL_URL}`);
  console.log(`[INFO] Node version: ${process.version}`);
});
