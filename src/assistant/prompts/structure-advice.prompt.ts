import { EventDraftDto } from '../dto/event-draft.dto';
import { FixtureDto } from '../dto/fixture.dto';

/**
 * Builds the structure-advice prompt. The model is asked for strict JSON and
 * is explicitly constrained to reference ONLY the teams in the recommended
 * slate. Grounding is enforced again in code after the call (see
 * StructureAdviceService), so this instruction is a first line of defence,
 * not the only one.
 */
export function buildStructureAdvicePrompt(
  draft: EventDraftDto,
  slate: FixtureDto[],
): { system: string; user: string } {
  const slateLines = slate
    .map(
      (f) =>
        `- ${f.homeTeam} vs ${f.awayTeam}${f.league ? ` (${f.league})` : ''} @ ${f.kickoffTime}`,
    )
    .join('\n');

  const allowedTeams = Array.from(
    new Set(slate.flatMap((f) => [f.homeTeam, f.awayTeam])),
  ).join(', ');

  const system = [
    'You are the InsightArena Creator Assistant.',
    'You help creators structure custom sports prediction events to maximise engagement.',
    'You MUST respond with a single valid JSON object and nothing else — no prose, no markdown fences.',
    'The JSON object MUST have exactly these keys:',
    '  "scoringSuggestion": string — one concise scoring rule recommendation.',
    '  "roundStructure": string — one concise recommendation on rounds / event length.',
    '  "engagementTips": string[] — at most 3 short engagement hooks.',
    '  "titleSuggestions": string[] — at most 3 alternative event titles.',
    '',
    'GROUNDING RULES (critical):',
    '- You may ONLY reference fixtures and team names that appear in the provided slate.',
    `- The only team names you may mention are: ${allowedTeams}.`,
    '- Do NOT invent, assume, or reference any team, player, league, or fixture not in the slate.',
    '- If you cannot make a tip specific without inventing a team, keep the tip generic instead.',
  ].join('\n');

  const user = [
    `Event title (draft): ${draft.title}`,
    `Visibility: ${draft.visibility}`,
    draft.expectedParticipants != null
      ? `Expected participants: ${draft.expectedParticipants}`
      : 'Expected participants: unknown',
    '',
    'Recommended slate of fixtures:',
    slateLines,
    '',
    'Return the JSON structure advice now.',
  ].join('\n');

  return { system, user };
}
