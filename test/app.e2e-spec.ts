import { Controller, Get, Inject, INestApplication } from "@nestjs/common";
import request = require("supertest");
import {
  createInsightArenaClientMock,
  createLlmServiceMock,
  createSorobanServiceMock,
  createTestingModule,
} from "./utils";

const LLM_SERVICE = Symbol("LlmService");
const INSIGHT_ARENA_CLIENT = Symbol("InsightArenaClient");
const SOROBAN_SERVICE = Symbol("SorobanService");

interface LlmServiceContract {
  summarize(): Promise<string>;
}

interface InsightArenaClientContract {
  getStatus(): Promise<string>;
}

interface SorobanServiceContract {
  getNetwork(): Promise<string>;
}

@Controller("test-harness")
class TestHarnessController {
  constructor(
    @Inject(LLM_SERVICE) private readonly llmService: LlmServiceContract,
    @Inject(INSIGHT_ARENA_CLIENT)
    private readonly insightArenaClient: InsightArenaClientContract,
    @Inject(SOROBAN_SERVICE)
    private readonly sorobanService: SorobanServiceContract
  ) {}

  @Get()
  async getStatus() {
    const [llm, insightArena, soroban] = await Promise.all([
      this.llmService.summarize(),
      this.insightArenaClient.getStatus(),
      this.sorobanService.getNetwork(),
    ]);

    return { llm, insightArena, soroban };
  }
}

describe("HTTP testing pattern (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const llmService = createLlmServiceMock<LlmServiceContract>({
      summarize: jest.fn().mockResolvedValue("ready"),
    });
    const insightArenaClient =
      createInsightArenaClientMock<InsightArenaClientContract>({
        getStatus: jest.fn().mockResolvedValue("connected"),
      });
    const sorobanService = createSorobanServiceMock<SorobanServiceContract>({
      getNetwork: jest.fn().mockResolvedValue("testnet"),
    });

    const moduleRef = await createTestingModule({
      controllers: [TestHarnessController],
      providers: [
        { provide: LLM_SERVICE, useValue: llmService },
        { provide: INSIGHT_ARENA_CLIENT, useValue: insightArenaClient },
        { provide: SOROBAN_SERVICE, useValue: sorobanService },
      ],
    });

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves an endpoint with every external boundary mocked", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/test-harness")
      .expect(200)
      .expect({
        llm: "ready",
        insightArena: "connected",
        soroban: "testnet",
      });
  });
});
