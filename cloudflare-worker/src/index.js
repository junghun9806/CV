import { CONFIG } from "./config.js";
import { retrieveRelevantChunks } from "./retrieval.js";
import { buildMessages, looksLikePromptAttack } from "./prompt.js";
import { createAIProvider } from "./providers/index.js";

const fallbackRateLimits = new Map();

const json = (body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "vary": "Origin",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  }
});

function corsOrigin(request, env) {
  const requestOrigin = request.headers.get("origin");
  const siteOrigin = new URL(request.url).origin;
  return requestOrigin && requestOrigin === siteOrigin ? requestOrigin : siteOrigin;
}

function isOriginAllowed(request, env) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

function sanitizeHistory(value) {
  if (!Array.isArray(value)) return [];
  const recent = value.slice(-CONFIG.maxHistoryMessages);
  let total = 0;
  const safe = [];
  for (const item of recent) {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") continue;
    const content = item.content.trim().slice(0, CONFIG.maxMessageChars);
    if (!content || total + content.length > CONFIG.maxHistoryChars) break;
    safe.push({ role: item.role, content });
    total += content.length;
  }
  return safe;
}

async function checkRateLimit(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (env.CHAT_RATE_LIMITER?.limit) {
    return (await env.CHAT_RATE_LIMITER.limit({ key: `chat:${ip}` })).success;
  }
  const now = Date.now();
  const entry = fallbackRateLimits.get(ip);
  if (!entry || entry.resetAt <= now) {
    fallbackRateLimits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 10;
}

async function loadKnowledge(request, env) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    throw new Error("The static assets binding is not configured.");
  }
  const knowledgeUrl = new URL("/data/knowledge.json", request.url);
  const response = await env.ASSETS.fetch(new Request(knowledgeUrl, {
    headers: { accept: "application/json" }
  }));
  if (!response.ok) throw new Error(`Knowledge request failed with ${response.status}.`);
  const data = await response.json();
  if (!data || !Array.isArray(data.chunks)) throw new Error("Knowledge data has an invalid format.");
  return data.chunks;
}

async function handleChat(request, env) {
  const origin = corsOrigin(request, env);
  if (!isOriginAllowed(request, env)) return json({ error: "Origin is not allowed." }, 403, origin);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 12_000) return json({ error: "Request is too large." }, 413, origin);
  if (!(await checkRateLimit(request, env))) {
    return json({ error: "Too many questions. Please wait about a minute and try again." }, 429, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400, origin);
  }
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return json({ error: "A message is required." }, 400, origin);
  if (message.length > CONFIG.maxMessageChars) {
    return json({ error: `Message must be ${CONFIG.maxMessageChars} characters or fewer.` }, 400, origin);
  }
  if (looksLikePromptAttack(message)) {
    return json({
      answer: "I can’t reveal hidden instructions or use outside knowledge to guess personal information. I can answer questions grounded in the research material published on this website."
    }, 200, origin);
  }

  try {
    const chunks = await loadKnowledge(request, env);
    const history = sanitizeHistory(body.history);
    const previousQuestions = history
      .filter((item) => item.role === "user")
      .map((item) => item.content)
      .join(" ");
    const relevant = retrieveRelevantChunks(`${previousQuestions} ${message}`.trim(), chunks, CONFIG.topK);
    if (!relevant.length) {
      return json({
        answer: "That information is not available in the material currently published on this website.",
        sources: []
      }, 200, origin);
    }
    const provider = createAIProvider(env, CONFIG);
    const promptMessages = buildMessages(message, history, relevant, CONFIG.maxKnowledgeChars);
    const answer = (await provider.generate(promptMessages)).trim();
    return json({
      answer,
      sources: relevant.map(({ id, title, category }) => ({ id, title, category }))
    }, 200, origin);
  } catch (error) {
    console.error("Chat request failed", error);
    return json({ error: "The research assistant is temporarily unavailable." }, 503, origin);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = corsOrigin(request, env);
    if (request.method === "OPTIONS" && url.pathname === "/api/chat") {
      if (!isOriginAllowed(request, env)) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
          "vary": "Origin"
        }
      });
    }
    if (request.method === "POST" && url.pathname === "/api/chat") return handleChat(request, env);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, provider: CONFIG.provider, model: CONFIG.model }, 200, origin);
    }
    return json({ error: "Not found." }, 404, origin);
  }
};
