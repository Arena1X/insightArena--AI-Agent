import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from './llm/llm.service';
import { buildStructureAdvicePrompt } from './prompts/structure-advice.prompt';
import { EventDraftDto } from './dto/event-draft.dto';
import { FixtureDto } from './dto/fixture.dto';
import { StructureAdviceDto } from './dto/recommendation-response.dto';
import { StructureAdvice } from './interfaces/structure-advice.interface';

const MAX_TIPS = 3;
const MAX_TITLES = 3;

/**
 * Produces LLM-backed structure advice, grounded against the recommended
 * slate. If the LLM fails or returns unusable output, a deterministic
 * fallback is returned so callers always get useful advice.
 */
@Injectable()
export class StructureAdviceService {
  private readonly logger = new Logger(StructureAdviceService.name);

  constructor(private readonly llm: LlmService) {}

  async advise(
    draft: EventDraftDto,
    slate: FixtureDto[],
  ): Promise<StructureAdviceDto> {
    if (!this.llm.isConfigured()) {
      return this.fallback(draft, slate);
    }

    try {
      const { system, user } = buildStructureAdvicePrompt(draft, slate);
      const raw = await this.llm.complete({ system, user, json: true });
      const parsed = this.parse(raw);
      return this.ground(parsed, slate);
    } catch (err) {
      this.logger.warn(
        `LLM structure advice failed, using deterministic fallback: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return this.fallback(draft, slate);
    }
  }

  /** Parses and shape-checks the model output; throws if it is unusable. */
  private parse(raw: string): StructureAdvice {
    let obj: unknown;
    try {
      obj = JSON.parse(raw);
    } catch {
      throw new Error('LLM returned non-JSON output');
    }
    const o = obj as Record<string, unknown>;
    if (
      typeof o?.scoringSuggestion !== 'string' ||
      typeof o?.roundStructure !== 'string' ||
      !Array.isArray(o?.engagementTips) ||
      !Array.isArray(o?.titleSuggestions)
    ) {
      throw new Error('LLM output missing required fields');
    }
    return {
      scoringSuggestion: o.scoringSuggestion,
      roundStructure: o.roundStructure,
      engagementTips: (o.engagementTips as unknown[]).filter(
        (t): t is string => typeof t === 'string',
      ),
      titleSuggestions: (o.titleSuggestions as unknown[]).filter(
        (t): t is string => typeof t === 'string',
      ),
    };
  }

  /**
   * Grounding post-check: any tip that mentions a real team NOT in the slate
   * is dropped, enforcing the acceptance criterion in code independent of what
   * the model returned.
   *
   * Detection is lexicon-based rather than "capitalised-word"-based. Trying to
   * classify arbitrary capitalised words as team-or-not produces false
   * positives on sentence-initial words ("Hype up ...") and legitimate title
   * words ("... Showdown"), which would wrongly drop good advice. Matching
   * against a known-team lexicon instead means generic words never trigger a
   * drop, while well-known teams outside the slate are caught.
   *
   * Limitation: an obscure hallucinated team not in the lexicon can slip past
   * this check. That is why the prompt itself constrains the model to the
   * slate (first line of defence); this post-check is the enforced backstop
   * for the realistic case of a famous team being invented.
   */
  private ground(advice: StructureAdvice, slate: FixtureDto[]): StructureAdviceDto {
    const allowed = new Set(
      slate.flatMap((f) => [f.homeTeam, f.awayTeam]).map((n) => n.toLowerCase()),
    );

    const mentionsUngroundedTeam = (text: string): boolean =>
      this.knownTeamsMentioned(text).some((team) => !allowed.has(team));

    const groundedTips = advice.engagementTips
      .filter((tip) => !mentionsUngroundedTeam(tip))
      .slice(0, MAX_TIPS);

    const groundedTitles = advice.titleSuggestions
      .filter((title) => !mentionsUngroundedTeam(title))
      .slice(0, MAX_TITLES);

    return {
      scoringSuggestion: advice.scoringSuggestion,
      roundStructure: advice.roundStructure,
      engagementTips: groundedTips,
      titleSuggestions: groundedTitles,
      fallbackUsed: false,
    };
  }

  /**
   * Returns the lowercased known-team names mentioned in the text (matched on
   * word boundaries, case-insensitive). Longest names are checked first so a
   * multi-word club is matched as a whole rather than by a single token.
   */
  private knownTeamsMentioned(text: string): string[] {
    const haystack = text.toLowerCase();
    return KNOWN_TEAMS.filter((team) =>
      new RegExp(`\\b${escapeRegExp(team)}\\b`).test(haystack),
    );
  }

  /** Deterministic advice that never references specific teams. */
  private fallback(draft: EventDraftDto, slate: FixtureDto[]): StructureAdviceDto {
    const count = slate.length;
    return {
      scoringSuggestion:
        'Award 3 points for predicting the exact scoreline and 1 point for the correct result (win/draw/loss).',
      roundStructure:
        count > 6
          ? `Split the ${count} fixtures into two rounds so scores update mid-event and keep interest high.`
          : `Run all ${count} fixtures as a single round resolved on match day.`,
      engagementTips: [
        'Post a leaderboard update midway through the event to spark competition.',
        'Set a clear prediction deadline and remind participants an hour before it closes.',
        draft.visibility === 'private'
          ? 'Share the invite code early so friends have time to join before the deadline.'
          : 'Promote the event publicly a few days ahead to grow participation.',
      ].slice(0, MAX_TIPS),
      titleSuggestions: [
        `${draft.title} Showdown`,
        `${draft.title} — Prediction Challenge`,
        `The ${draft.title} Cup`,
      ].slice(0, MAX_TITLES),
      fallbackUsed: true,
    };
  }
}

/**
 * Escapes a string for safe inclusion in a RegExp.
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A lexicon of well-known football club names used to detect ungrounded team
 * mentions in LLM output. This is intentionally not exhaustive — it targets
 * the realistic failure mode (a famous team being hallucinated). Slate teams
 * are always allowed regardless of whether they appear here. Sorted
 * longest-first so multi-word names match ahead of their sub-tokens.
 */
const KNOWN_TEAMS: string[] = [
  'Manchester United',
  'Manchester City',
  'Tottenham Hotspur',
  'West Ham',
  'Aston Villa',
  'Bayern Munich',
  'Real Madrid',
  'Atletico Madrid',
  'Paris Saint-Germain',
  'Inter Milan',
  'AC Milan',
  'Arsenal',
  'Chelsea',
  'Liverpool',
  'Everton',
  'Tottenham',
  'Barcelona',
  'Juventus',
  'Napoli',
  'Dortmund',
  'Ajax',
  'Porto',
  'Benfica',
  'Sevilla',
  'Valencia',
  'Newcastle',
  'Brighton',
  'Fulham',
  'Leeds',
  'Wolves',
  'Southampton',
  'Leicester',
]
  .map((t) => t.toLowerCase())
  .sort((a, b) => b.length - a.length);
