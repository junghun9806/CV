const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "he", "his",
  "how", "in", "is", "it", "my", "of", "on", "or", "that", "the", "to", "what",
  "which", "with", "work", "works", "about", "does", "has", "have", "please", "tell", "me"
]);

function stemEnglishToken(token) {
  if (!/^[a-z]+$/.test(token)) return token;
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function tokenize(value) {
  const normalized = String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    .map(stemEnglishToken);
}

function termFrequency(tokens) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return counts;
}

export function retrieveRelevantChunks(query, chunks, topK = 5) {
  if (!Array.isArray(chunks) || !chunks.length) return [];
  const queryTokens = [...new Set(tokenize(query))];
  if (!queryTokens.length) return [];
  const querySet = new Set(queryTokens);
  const categoryIntent = new Set();
  if (["paper", "publication", "publish", "journal", "article", "논문", "출판"].some((term) => querySet.has(term))) {
    categoryIntent.add("publication");
  }
  if (["project", "연구", "프로젝트"].some((term) => querySet.has(term))) categoryIntent.add("project");
  if (["education", "degree", "학력", "학위"].some((term) => querySet.has(term))) categoryIntent.add("education");
  if (["skill", "programming", "technical", "기술", "프로그래밍"].some((term) => querySet.has(term))) categoryIntent.add("skills");
  if (["conference", "presentation", "poster", "학회", "발표"].some((term) => querySet.has(term))) categoryIntent.add("presentation");

  const docs = chunks.map((chunk) => {
    const titleTokens = tokenize(chunk.title);
    const keywordTokens = tokenize((chunk.keywords || []).join(" "));
    const bodyTokens = tokenize(chunk.text);
    return {
      chunk,
      titleTokens,
      keywordTokens,
      bodyTokens,
      frequencies: termFrequency(bodyTokens),
      length: Math.max(bodyTokens.length, 1),
    };
  });
  const averageLength = docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length;
  const documentFrequency = new Map();
  for (const token of queryTokens) {
    documentFrequency.set(token, docs.filter((doc) =>
      doc.titleTokens.includes(token) || doc.keywordTokens.includes(token) || doc.frequencies.has(token)
    ).length);
  }

  const scored = docs.map((doc) => {
    let score = 0;
    for (const token of queryTokens) {
      const df = documentFrequency.get(token) || 0;
      const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
      const tf = doc.frequencies.get(token) || 0;
      const saturation = tf
        ? (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (doc.length / averageLength)))
        : 0;
      score += idf * saturation;
      if (doc.titleTokens.includes(token)) score += idf * 2.4;
      if (doc.keywordTokens.includes(token)) score += idf * 3.2;
    }
    const phrase = String(query).toLowerCase().trim();
    const searchable = `${doc.chunk.title} ${(doc.chunk.keywords || []).join(" ")} ${doc.chunk.text}`.toLowerCase();
    if (phrase.length > 4 && searchable.includes(phrase)) score += 4;
    if (categoryIntent.has(doc.chunk.category)) score += 12;
    return { ...doc.chunk, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
