import type OpenAI from 'openai';

/**
 * Embedding helpers, shared by the runtime service AND the seed script (so both
 * produce vectors with the SAME model — mixing models would make similarity
 * scores meaningless).
 */

/** Gemini's OpenAI-compatible base URL — the same one the chat assistant uses. */
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

/** Gemini's text-embedding model. Produces a vector of ~3000 numbers. Free tier. */
export const EMBEDDING_MODEL = 'gemini-embedding-001';

/**
 * Turn text into an EMBEDDING: a list of numbers that captures its meaning. Two
 * pieces of text with similar meaning produce vectors pointing in similar
 * directions, which is what lets us "search by meaning" instead of by keyword.
 */
export async function embedText(client: OpenAI, text: string): Promise<number[]> {
  const res = await client.embeddings.create({ model: EMBEDDING_MODEL, input: text });
  return res.data[0].embedding;
}

/**
 * Cosine similarity: the cosine of the angle between two vectors, a number from
 * -1 to 1. 1 means "same direction" (very similar meaning); 0 means unrelated.
 * This is our "how close in meaning are these two texts?" score.
 *
 * This is exactly what a vector database (e.g. pgvector) computes for you in SQL.
 * With a handful of documents we just do it here in plain code.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
