import {
  createServiceMock,
  MockableService,
  ServiceMock,
} from "./create-service-mock";

export function createLlmServiceMock<T extends object = MockableService>(
  overrides: Partial<ServiceMock<T>> = {}
): ServiceMock<T> {
  return createServiceMock<T>(overrides);
}
