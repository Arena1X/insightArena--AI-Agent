import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { LlmService } from './llm/llm.service';
import { buildNamingPrompt } from './prompts/naming.prompt';
import { NamingRequestDto, NamingResponseDto } from './dto/naming.dto';
import { containsBlockedTerm } from '../common/constants/profanity-blocklist';

/** Maximum length for a title candidate (characters). */
export const MAX_TITLE_LENGTH = 40;
/** Maximum length for the event description (characters). */
export const MAX_DESCRIPTION_LENGTH = 200;
/** Number of title candidates to return. */
const TITLE_COUNT = 3;
/** Cache TTL in milliseconds (24 hours). */
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

interface CacheEntry {
  response: NamingResponseDto;
  expiresAt: number;
}

/**
 * Generates catchy, safe event title and description candidates for a given
 * fixture slate summary.
 *
 * ## Validation strategy
 * Length enforcement uses **truncation**: candidates that exceed the limit are
 * truncated to the maximum length at the nearest word boundary, then
 * re-checked for blocked terms.  Truncation is preferred over regeneration
 * because it is deterministic and avoids unbounded LLM round-trips.
 * If a truncated candidate still contains a blocked term it is replaced by a
 * fallback title.
 *
 * ## Caching
 * Responses are cached in an in-memory `Map` keyed by a SHA-256 hash of
 * (slateSummary + context) for 24 hours.  Identical requests within that
 * window return the cached response without a new LLM call.  The cache is
 * process-local; it resets on restart, which is acceptable for this use case.
 *
 * ## Fallback
 * If the LLM is unconfigured, throws, or returns unparseable output, a set of
 * deterministic titles is returned with `fallbackUsed: true`.
 */
@Injectable()
export class NamingService {
  private readonly logger = new Logger(NamingService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly llm: LlmService) {}

  async generateNames(dto: NamingRequestDto): Promise<NamingResponseDto> {
    const cacheKey = this.buildCacheKey(dto);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    let response: NamingResponseDto;

    if (!this.llm.isConfigured()) {
      response = this.buildFallback(dto.slateSummary);
    } else {
      try {
        const { system, user } = buildNamingPrompt(dto);
        const raw = await this.llm.complete({ system, user, json: true });
        response = this.parseAndValidate(raw, dto.slateSummary);
      } catch (err) {
        this.logger.warn(
          `LLM naming failed, using deterministic fallback: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        response = this.buildFallback(dto.slateSummary);
      }
    }

    this.setInCache(cacheKey, response);
    return response;
  }

  // ---------------------------------------------------------------------------
  // Parsing & validation
  // ---------------------------------------------------------------------------

  /**
   * Parses the raw LLM JSON, enforces length limits via truncation, and
   * scrubs any blocked terms.  Throws if the output is structurally invalid.
   */
  private parseAndValidate(raw: string, slateSummary: string): NamingResponseDto {
    let obj: unknown;
    try {
      obj = JSON.parse(raw);
    } catch {
      throw new Error('LLM returned non-JSON output');
    }

    const o = obj as Record<string, unknown>;
    if (!Array.isArray(o?.titles) || typeof o?.description !== 'string') {
      throw new Error('LLM output missing required fields (titles, description)');
    }

    const rawTitles = (o.titles as unknown[])
      .filter((t): t is string => typeof t === 'string')
      .slice(0, TITLE_COUNT);

    const titles = this.sanitiseTitles(rawTitles, slateSummary);
    const description = this.sanitiseDescription(
      o.description as string,
      slateSummary,
    );

    return {
      titles,
      description,
      fallbackUsed: false,
      cachedAt: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Sanitisation helpers
  // ---------------------------------------------------------------------------

  /**
   * Truncates a title to MAX_TITLE_LENGTH at the nearest word boundary,
   * then replaces it with a fallback if it still contains a blocked term or
   * becomes empty.  Pads with fallback titles if fewer than TITLE_COUNT
   * remain after filtering.
   */
  private sanitiseTitles(candidates: string[], slateSummary: string): string[] {
    const sanitised = candidates.map((t) => this.truncateTitle(t));
    const clean = sanitised.map((t) =>
      containsBlockedTerm(t) ? '' : t,
    );

    // Fill any gaps (empty or missing) with fallback titles
    const fallbackTitles = this.fallbackTitles(slateSummary);
    const result: string[] = [];
    let fallbackIdx = 0;

    for (let i = 0; i < TITLE_COUNT; i++) {
      const candidate = clean[i];
      if (candidate && candidate.trim().length > 0) {
        result.push(candidate);
      } else {
        result.push(fallbackTitles[fallbackIdx % fallbackTitles.length]);
        fallbackIdx++;
      }
    }

    return result;
  }

  /**
   * Truncates at word boundary up to MAX_TITLE_LENGTH chars.
   */
  private truncateTitle(title: string): string {
    const trimmed = title.trim();
    if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
    const cut = trimmed.slice(0, MAX_TITLE_LENGTH);
    const lastSpace = cut.lastIndexOf(' ');
    return lastSpace > 0 ? cut.slice(0, lastSpace).trimEnd() : cut;
  }

  /**
   * Truncates description to MAX_DESCRIPTION_LENGTH at the nearest word
   * boundary.  If the result contains a blocked term, falls back to a generic
   * description.
   */
  private sanitiseDescription(description: string, slateSummary: string): string {
    const trimmed = description.trim();
    let result = trimmed;

    if (result.length > MAX_DESCRIPTION_LENGTH) {
      const cut = result.slice(0, MAX_DESCRIPTION_LENGTH);
      const lastSpace = cut.lastIndexOf(' ');
      result = lastSpace > 0 ? cut.slice(0, lastSpace).trimEnd() : cut;
    }

    if (containsBlockedTerm(result)) {
      result = this.fallbackDescription(slateSummary);
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Fallback
  // ---------------------------------------------------------------------------

  private buildFallback(slateSummary: string): NamingResponseDto {
    return {
      titles: this.fallbackTitles(slateSummary),
      description: this.fallbackDescription(slateSummary),
      fallbackUsed: true,
      cachedAt: new Date().toISOString(),
    };
  }

  private fallbackTitles(slateSummary: string): string[] {
    // Extract a week label from the summary if it contains a date-like token,
    // otherwise use a rolling "Week of <today>" label.
    const weekLabel = this.extractWeekLabel(slateSummary);
    return [
      this.truncateTitle(`Premier League Showdown — ${weekLabel}`),
      this.truncateTitle(`Matchday Challenge — ${weekLabel}`),
      this.truncateTitle(`Prediction Cup — ${weekLabel}`),
    ];
  }

  private fallbackDescription(slateSummary: string): string {
    const desc = `Pick your winners from this week's fixture slate and climb the leaderboard. Predictions close before kick-off.`;
    // Already under 200 chars, but sanitise just in case.
    return desc.length <= MAX_DESCRIPTION_LENGTH ? desc : desc.slice(0, MAX_DESCRIPTION_LENGTH);
  }

  /**
   * Tries to pull a short date label from the slate summary (e.g. "25 Jul
   * 2026"), falling back to "Week of <ISO date>" using today's date.
   */
  private extractWeekLabel(slateSummary: string): string {
    const dateMatch = slateSummary.match(
      /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\b/i,
    );
    if (dateMatch) return dateMatch[1];

    // ISO date in summary
    const isoMatch = slateSummary.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (isoMatch) return `Week of ${isoMatch[1]}`;

    // Fallback to today
    const today = new Date().toISOString().slice(0, 10);
    return `Week of ${today}`;
  }

  // ---------------------------------------------------------------------------
  // Cache helpers
  // ---------------------------------------------------------------------------

  private buildCacheKey(dto: NamingRequestDto): string {
    const payload = `${dto.slateSummary}||${dto.context ?? ''}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  private getFromCache(key: string): NamingResponseDto | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.response;
  }

  private setInCache(key: string, response: NamingResponseDto): void {
    this.cache.set(key, {
      response,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  /**
   * Exposed for testing only — allows injecting a fake cache state.
   * @internal
   */
  _setCacheEntry(key: string, entry: CacheEntry): void {
    this.cache.set(key, entry);
  }

  /**
   * Exposed for testing only — computes the cache key for a given request.
   * @internal
   */
  _buildCacheKey(dto: NamingRequestDto): string {
    return this.buildCacheKey(dto);
  }
}
