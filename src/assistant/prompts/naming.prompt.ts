import { NamingRequestDto } from '../dto/naming.dto';

/**
 * Builds the LLM prompt for the naming endpoint.
 *
 * The model is asked to respond with strict JSON only.  Hard constraints
 * (length limits, blocklist) are enforced in code after the call; the prompt
 * is the first line of defence.
 */
export function buildNamingPrompt(dto: NamingRequestDto): {
  system: string;
  user: string;
} {
  const system = [
    'You are the InsightArena Creator Assistant.',
    'Your job is to generate catchy, safe, and concise event names and descriptions for sports prediction events.',
    '',
    'You MUST respond with a single valid JSON object and nothing else — no prose, no markdown fences.',
    'The JSON object MUST have exactly these keys:',
    '  "titles": string[] — exactly 3 event title candidates, each strictly under 40 characters.',
    '  "description": string — one event description, strictly under 200 characters.',
    '',
    'RULES:',
    '- Titles MUST be ≤ 40 characters each. Count carefully.',
    '- Description MUST be ≤ 200 characters. Count carefully.',
    '- Do NOT use profanity, slurs, or offensive language.',
    '- Keep tone energetic and accessible; avoid jargon.',
    '- Do NOT invent fixtures or teams not mentioned in the slate summary.',
  ].join('\n');

  const userLines = [
    `Slate summary: ${dto.slateSummary}`,
  ];
  if (dto.context) {
    userLines.push(`Additional context: ${dto.context}`);
  }
  userLines.push('', 'Return the JSON now.');

  return { system, user: userLines.join('\n') };
}
