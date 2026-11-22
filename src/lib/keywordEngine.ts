import type { Product } from '../types/kragiecast';

export type VoiceCommandType = 'zoom_in' | 'zoom_reset' | 'hide_overlay';

export interface KeywordMatchResult {
  product: Product;
  matchedKeyword: string;
  normalizedTranscript: string;
  latencyMs: number;
}

export interface VoiceCommandMatchResult {
  command: VoiceCommandType;
  matchedPhrase: string;
  latencyMs: number;
}

const SLANG_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bcekout\b/g, 'checkout'],
  [/\bco\b/g, 'checkout'],
  [/\bhrg\b/g, 'harga'],
  [/\bpkt\b/g, 'paket'],
  [/\bhmt\b/g, 'hemat'],
  [/\bsbl\b/g, 'sambal'],
  [/\bprm\b/g, 'promo'],
  [/\bdskn\b/g, 'diskon'],
];

const VOICE_COMMANDS: Array<{ command: VoiceCommandType; phrases: string[] }> = [
  {
    command: 'zoom_in',
    phrases: [
      'zoom produk',
      'zoom detail',
      'lihat dekat',
      'dekat lagi',
      'perbesar produk',
      'kamera dekat',
    ],
  },
  {
    command: 'zoom_reset',
    phrases: [
      'zoom normal',
      'kamera normal',
      'jauhkan kamera',
      'tampilan wide',
      'kembali normal',
    ],
  },
  {
    command: 'hide_overlay',
    phrases: ['tutup overlay', 'sembunyikan promo', 'hapus grafis', 'tutup harga'],
  },
];

/**
 * Normalizes formal and casual Indonesian live-commerce speech for robust keyword matching.
 */
export function normalizeIndonesianSpeech(input: string): string {
  let text = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, replacement] of SLANG_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  return text;
}

/**
 * Detects spoken voice commands (e.g., "zoom detail", "kamera normal") from Indonesian transcript.
 */
export function detectVoiceCommand(
  transcript: string,
  startedAtMs?: number,
): VoiceCommandMatchResult | null {
  const t0 = startedAtMs ?? performance.now();
  const normalized = normalizeIndonesianSpeech(transcript);
  if (!normalized) return null;

  for (const group of VOICE_COMMANDS) {
    for (const phrase of group.phrases) {
      if (normalized.includes(phrase)) {
        const elapsed = Math.max(1, Math.round(performance.now() - t0));
        return {
          command: group.command,
          matchedPhrase: phrase,
          latencyMs: elapsed,
        };
      }
    }
  }
  return null;
}

/**
 * Matches an Indonesian live-commerce utterance against all configured product trigger keywords.
 * Prioritizes the longest matching keyword to avoid generic partial collisions.
 */
export function matchProductKeyword(
  transcript: string,
  products: Product[],
  startedAtMs?: number,
): KeywordMatchResult | null {
  const t0 = startedAtMs ?? performance.now();
  const normalized = normalizeIndonesianSpeech(transcript);
  if (!normalized || products.length === 0) return null;

  let bestMatch: { product: Product; keyword: string; score: number } | null = null;

  for (const product of products) {
    for (const rawKeyword of product.keywords) {
      const normalizedKeyword = normalizeIndonesianSpeech(rawKeyword);
      if (!normalizedKeyword) continue;

      const exactBoundaryRegex = new RegExp(`(?:^|\\s)${escapeRegex(normalizedKeyword)}(?:$|\\s)`);
      const hasBoundaryMatch = exactBoundaryRegex.test(normalized);
      const hasSubstringMatch = !hasBoundaryMatch && normalized.includes(normalizedKeyword);

      if (hasBoundaryMatch || hasSubstringMatch) {
        const score = normalizedKeyword.length * 10 + (hasBoundaryMatch ? 5 : 0);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { product, keyword: rawKeyword, score };
        }
      }
    }
  }

  if (!bestMatch) return null;

  const elapsed = Math.max(2, Math.round(performance.now() - t0));
  return {
    product: bestMatch.product,
    matchedKeyword: bestMatch.keyword,
    normalizedTranscript: normalized,
    latencyMs: elapsed,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
