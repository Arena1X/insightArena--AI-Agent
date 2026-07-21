/**
 * The strict JSON shape the LLM is asked to return for structure advice.
 * Kept as a plain interface (not a class) because it models the parsed
 * model output rather than an inbound HTTP payload.
 */
export interface StructureAdvice {
  scoringSuggestion: string;
  roundStructure: string;
  engagementTips: string[];
  titleSuggestions: string[];
}
