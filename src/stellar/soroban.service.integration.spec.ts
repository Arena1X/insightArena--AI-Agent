/**
 * Live Stellar testnet check for SorobanService.resolveMarket.
 *
 * Gated behind RUN_STELLAR_TESTS=1 (skipped otherwise). Uses the Jest
 * stellar-sdk mock by default — for a true end-to-end run against testnet,
 * use the manual script documented in the PR:
 *
 *   RUN_STELLAR_TESTS=1 npx ts-node -r tsconfig-paths/register \
 *     scripts/verify-soroban-resolve.ts
 *
 * Required env for the script:
 *   STELLAR_NETWORK=testnet
 *   STELLAR_RPC_URL=https://soroban-testnet.stellar.org
 *   STELLAR_AGENT_SECRET_KEY=S...
 *   INSIGHT_ARENA_CONTRACT_ID=C...
 *   STELLAR_TEST_MARKET_ID=<u64>
 *   STELLAR_TEST_OUTCOME=<Symbol>
 */
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SorobanService } from './soroban.service';

const runLive = process.env.RUN_STELLAR_TESTS === '1';

(runLive ? describe : describe.skip)(
  'SorobanService (Stellar testnet integration)',
  () => {
    let service: SorobanService;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          SorobanService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string) => process.env[key],
            },
          },
        ],
      }).compile();

      service = moduleRef.get(SorobanService);
      await service.onModuleInit();
    });

    it('submits resolve_market and returns a confirmed tx hash', async () => {
      const marketId = process.env.STELLAR_TEST_MARKET_ID ?? '1';
      const outcome = process.env.STELLAR_TEST_OUTCOME ?? 'Yes';

      const result = await service.resolveMarket(marketId, outcome);
      expect(result.txHash).toMatch(/^[a-f0-9]{64}$/i);
    }, 60_000);
  },
);
