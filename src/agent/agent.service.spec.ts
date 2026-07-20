import { HttpService } from "@nestjs/axios";
import { TestingModule } from "@nestjs/testing";
import { AppModule } from "../app.module";
import {
  createApiFootballClientMock,
  createTestingModule,
} from "../../test/utils";
import { AgentService } from "./agent.service";

describe("AgentModule testing pattern", () => {
  let moduleRef: TestingModule;

  afterEach(async () => {
    await moduleRef?.close();
  });

  it("compiles the application with external clients mocked", async () => {
    const apiFootballClient =
      createApiFootballClientMock<Pick<HttpService, "get">>();

    moduleRef = await createTestingModule({ imports: [AppModule] }, [
      { token: HttpService, value: apiFootballClient },
    ]);

    expect(moduleRef.get(AgentService)).toBeInstanceOf(AgentService);
  });
});
