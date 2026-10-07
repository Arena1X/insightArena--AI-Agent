/**
 * Generic PromptTemplate helper supporting named placeholders and required-variable validation.
 * Pure functions: safe to evaluate in isolation without LLM or network dependencies.
 */
export class PromptTemplate<T extends Record<string, any> = Record<string, any>> {
  constructor(
    public readonly template: string,
    public readonly version: string,
    public readonly requiredVariables: (keyof T)[] = [],
  ) {}

  /**
   * Returns the semantic version of this prompt template.
   */
  public getVersion(): string {
    return this.version;
  }

  /**
   * Renders the template string with variables supplied in context.
   * Throws an Error at render time if any required variable is missing or undefined.
   */
  public render(variables: T): string {
    const missing: string[] = [];
    for (const reqVar of this.requiredVariables) {
      const val = variables[reqVar];
      if (val === undefined || val === null) {
        missing.push(String(reqVar));
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `PromptTemplate [version: ${this.version}] missing required variables: ${missing.join(', ')}`,
      );
    }

    return this.template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const value = variables[key as keyof T];
      if (value === undefined || value === null) {
        return '';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    });
  }
}
