const express = require('express');
const { LLM } = require('llama-cpp-wasm');

const app = express();
app.use(express.json({limit: '1mb'})); // Limit for shared hosting

// Model URL — downloads GGUF weights from HuggingFace on first run
// Using GPT-2 quantized which is ~50MB and works on limited RAM
const MODEL_URL = process.env.MODEL_URL || 'https://huggingface.co/Xenova/quantized-gpt2/resolve/main/gpt2-q4_0.gguf';

// Initialize LLM
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
    console.log(`Loading model from: ${MODEL_URL}`);
    llm = new LLM({
      model: MODEL_URL,
      backend: 'wasm', // Use WASM backend (no native binaries needed)
      n_threads: 1,   // Limit threads for shared hosting
      n_ctx: 512,     // Reduce context window for low RAM
    });
    await llm.init();
    console.log('llama.cpp model loaded successfully');
  } catch (err) {
    console.error('LLM load error:', err.message);
    throw err;
  } finally {
    loading = false;
  }
  return llm;
}

// OpenAI-compatible endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const model = await getLLM();
    const { messages, max_tokens = 100, temperature = 0.7 } = req.body;

    const prompt = messages.map(m => 
      (m.role === 'user' ? 'USER: ' : 'ASSISTANT: ') + m.content
    ).join('\n') + '\nASSISTANT: ';

    const result = await model.generate(prompt, {
      n_predict: Math.min(max_tokens, 200), // Cap tokens for shared hosting
      temp: temperature,
      top_k: 40,
      top_p: 0.9,
      repeat_last_n: 32,    // Reduce for memory
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
      }],
      usage: { prompt_tokens: prompt.length / 4, completion_tokens: result.length / 4 }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: MODEL_URL, loaded: !!llm });
});

// Models endpoint
app.get('/v1/models', (req, res) => {
  res.json({ data: [{ id: 'gpt2-llama-cpp', object: 'model' }] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`llama.cpp API listening on port ${PORT}`);
  console.log(`Model: ${MODEL_URL}`);
});
