export function createCloudflareProvider(env, config) {
  if (!env.AI || typeof env.AI.run !== "function") {
    throw new Error("The Workers AI binding is not configured.");
  }
  return {
    async generate(messages) {
      const result = await env.AI.run(config.model, {
        messages,
        max_tokens: config.maxOutputTokens,
        temperature: config.temperature
      });
      if (typeof result === "string") return result;
      if (typeof result?.response === "string") return result.response;
      if (typeof result?.result?.response === "string") return result.result.response;
      throw new Error("The AI provider returned an unexpected response.");
    }
  };
}
