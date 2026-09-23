export const CONFIG = Object.freeze({
  provider: "cloudflare",
  model: "@cf/meta/llama-3.1-8b-instruct-fast",
  maxMessageChars: 800,
  maxHistoryMessages: 6,
  maxHistoryChars: 3000,
  maxKnowledgeChars: 6000,
  topK: 5,
  maxOutputTokens: 450,
  temperature: 0.2,
  knowledgeCacheSeconds: 300,
});
