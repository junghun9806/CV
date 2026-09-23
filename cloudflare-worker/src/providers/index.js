import { createCloudflareProvider } from "./cloudflare.js";

export function createAIProvider(env, config) {
  if (config.provider === "cloudflare") return createCloudflareProvider(env, config);
  throw new Error(`Unsupported AI provider: ${config.provider}`);
}
