import { PromptTemplate } from './prompt-template';
import {
  matchAnalysisPrompt,
  MATCH_ANALYSIS_PROMPT_VERSION,
  MatchContext,
} from './match-analysis.prompt';

describe('PromptTemplate', () => {
  it('should return semantic version', () => {
    const template = new PromptTemplate('Hello {{name}}', '2.1.0', ['name']);
    expect(template.getVersion()).toBe('2.1.0');
  });

  it('should render variables correctly', () => {
    const template = new PromptTemplate<{ name: string; score: number }>(
      'Player {{name}} scored {{score}} points.',
      '1.0.0',
      ['name'],
    );
    const result = template.render({ name: 'Alice', score: 98 });
    expect(result).toBe('Player Alice scored 98 points.');
  });

  it('should throw an error when required variables are missing', () => {
    const template = new PromptTemplate<{ requiredA: string; requiredB: string }>(
      'Values: {{requiredA}}, {{requiredB}}',
      '1.0.0',
      ['requiredA', 'requiredB'],
    );

    expect(() => template.render({ requiredA: 'Present' } as any)).toThrow(
      'PromptTemplate [version: 1.0.0] missing required variables: requiredB',
    );
  });
});

describe('MatchAnalysisPrompt', () => {
  it('should have retrievable version string', () => {
    expect(matchAnalysisPrompt.getVersion()).toBe(MATCH_ANALYSIS_PROMPT_VERSION);
    expect(MATCH_ANALYSIS_PROMPT_VERSION).toBe('1.0.0');
  });

  it('should throw when homeTeam or awayTeam is missing', () => {
    expect(() =>
      matchAnalysisPrompt.render({
        homeTeam: 'Arsenal',
      } as any),
    ).toThrow('missing required variables: awayTeam');
  });

  it('should render prompt with full match context', () => {
    const context: MatchContext = {
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      league: 'Premier League',
      matchDate: '2026-10-15',
      homeForm: 'W-W-D-W-L',
      awayForm: 'L-D-W-L-D',
      headToHead: 'Arsenal won 3 of last 5',
      keyInjuries: 'Chelsea missing starting striker',
      odds: { home: 1.85, draw: 3.5, away: 4.2 },
      additionalContext: 'Derby match at Emirates Stadium',
    };

    const rendered = matchAnalysisPrompt.render(context);

    expect(rendered).toContain('Home Team: Arsenal');
    expect(rendered).toContain('Away Team: Chelsea');
    expect(rendered).toContain('League: Premier League');
    expect(rendered).toContain('Home Form (Last 5): W-W-D-W-L');
    expect(rendered).toContain('"pick": "home" | "draw" | "away"');
    expect(rendered).toContain('"confidence": <number between 0 and 100>');
  });
});
