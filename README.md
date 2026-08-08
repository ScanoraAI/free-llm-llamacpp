# Free LLM API (llama.cpp)

Self-hosted OpenAI-compatible LLM API using [llama.cpp](https://github.com/ggerganov/llama.cpp) via [llama-cpp-wasm](https://github.com/karpathy/llama-cpp-wasm) — runs in Node.js with WebAssembly backend. **No Python required.**

## Supported Models
Point `MODEL_URL` to any `.gguf` file on HuggingFace:
- `https://huggingface.co/Xenova/quantized-gpt2/resolve/main/gpt2-q4_0.gguf` (default, ~50MB)
- Llama-2-7B quantized: `https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf` (~4GB)
- Mistral-7B: `https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf`

## Deployment (cPanel)
1. Fork → GitHub
2. cPanel: Setup Node.js App → pull from Git
3. Env vars:
   - `MODEL_URL` = GGUF model download URL
   - `PORT` = auto-set by cPanel
4. Start

## API Usage
```bash
curl -X POST https://your-app.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```
