import { InjectionToken, ModuleMetadata } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

export interface TestingProviderOverride {
  token: InjectionToken;
  value: unknown;
}

export async function createTestingModule(
  metadata: ModuleMetadata,
  overrides: TestingProviderOverride[] = []
): Promise<TestingModule> {
  const builder = Test.createTestingModule(metadata);

  for (const { token, value } of overrides) {
    builder.overrideProvider(token).useValue(value);
  }

  return builder.compile();
}
