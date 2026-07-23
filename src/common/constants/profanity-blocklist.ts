/**
 * Profanity / offensive-term blocklist used across the Creator Assistant
 * and any other AI-generated content pipeline.
 *
 * Policy: truncate-then-reject — if a candidate still contains a blocked term
 * after length truncation, the whole candidate is discarded and a fallback is
 * used.  The list is kept intentionally short here; extend it as new terms are
 * reported through moderation review.
 *
 * All entries are lowercased.  Matching uses a word-start anchor (`\bterm`)
 * so that root forms catch common derivations (e.g. "fuck" catches "fucking",
 * "fucked", etc.) while still requiring a word boundary at the start to avoid
 * false positives on unrelated words.
 */
export const PROFANITY_BLOCKLIST: readonly string[] = [
  // common English profanity (root forms — prefix-matched)
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'damn',
  'crap',
  'piss',
  'cock',
  'cunt',
  'dick',
  'prick',
  'wank',
  'twat',
  'arse',
  'bollock',
  'bugger',
  // slurs — abbreviated to avoid embedding them in plain text logs;
  // add full forms via your moderation tooling as needed
  'nigga',
  'nigger',
  'faggot',
  'retard',
  'spastic',
];

/**
 * Returns true if `text` contains any blocklisted term (case-insensitive).
 * Uses a word-start boundary (`\b<term>`) so root forms match their
 * derivations (e.g. "fuck" matches "fucking", "fucked") while still requiring
 * the term to start at a word boundary to minimise false positives.
 */
export function containsBlockedTerm(text: string): boolean {
  const lower = text.toLowerCase();
  return PROFANITY_BLOCKLIST.some((term) =>
    new RegExp(`\\b${escapeRegExp(term)}`).test(lower),
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
