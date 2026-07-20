export type MockableService = Record<string, (...args: unknown[]) => unknown>;

export type ServiceMock<T extends object> = jest.Mocked<T>;

export function createServiceMock<T extends object = MockableService>(
  overrides: Partial<ServiceMock<T>> = {}
): ServiceMock<T> {
  const target = { ...overrides } as ServiceMock<T>;

  return new Proxy(target, {
    get(current, property, receiver) {
      if (property === "then" && !Reflect.has(current, property)) {
        return undefined;
      }

      if (!Reflect.has(current, property)) {
        Reflect.set(current, property, jest.fn());
      }

      return Reflect.get(current, property, receiver);
    },
  });
}
