import { PromptTemplate } from './prompt-template';

export interface MatchContext {
  homeTeam: string;
  awayTeam: string;
  league?: string;
  matchDate?: string;
  homeForm?: string;
  awayForm?: string;
  headToHead?: string;
  keyInjuries?: string;
  odds?: {
    home: number;
    draw: number;
    away: number;
  };
  additionalContext?: string;
}

export const MATCH_ANALYSIS_PROMPT_VERSION = '1.0.0';

const MATCH_ANALYSIS_RAW_TEMPLATE = `You are an expert sports analyst evaluating an upcoming fixture.

Fixture Details:
- Home Team: {{homeTeam}}
- Away Team: {{awayTeam}}
- League: {{league}}
- Match Date: {{matchDate}}

Team Performance & Context:
- Home Form (Last 5): {{homeForm}}
- Away Form (Last 5): {{awayForm}}
- Head-to-Head History: {{headToHead}}
- Key Team News & Injuries: {{keyInjuries}}
- Implied Market Odds: {{odds}}
- Additional Notes: {{additionalContext}}

Instructions:
1. Synthesize form, match dynamics, and team strengths.
2. Select your definitive pick: strictly one of "home", "draw", or "away".
3. Assign a confidence score from 0 to 100 representing probability percentage.
4. Provide a concise analytical rationale of 50 words or fewer.
5. Return your answer ONLY as strict JSON matching this schema:
{
  "pick": "home" | "draw" | "away",
  "confidence": <number between 0 and 100>,
  "rationale": "<string of 50 words or fewer>"
}`;

export const matchAnalysisPrompt = new PromptTemplate<MatchContext>(
  MATCH_ANALYSIS_RAW_TEMPLATE,
  MATCH_ANALYSIS_PROMPT_VERSION,
  ['homeTeam', 'awayTeam'],
);
