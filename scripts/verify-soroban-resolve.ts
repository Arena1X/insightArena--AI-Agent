/**
 * Manual Stellar testnet verification for resolveMarket.
 *
 * Usage:
 *   RUN_STELLAR_TESTS=1 npx ts-node -r tsconfig-paths/register scripts/verify-soroban-resolve.ts
 *
 * Requires a funded agent account, deployed InsightArena contract id, and a
 * market that the agent (oracle) is allowed to resolve.
 */
import { ConfigService } from '@nestjs/config';
import { SorobanService } from '../src/stellar/soroban.service';

async function main(): Promise<void> {
  if (process.env.RUN_STELLAR_TESTS !== '1') {
    console.error('Set RUN_STELLAR_TESTS=1 to run this script.');
    process.exit(1);
  }

  const required = [
    'STELLAR_AGENT_SECRET_KEY',
    'INSIGHT_ARENA_CONTRACT_ID',
    'STELLAR_TEST_MARKET_ID',
    'STELLAR_TEST_OUTCOME',
  ] as const;

  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required env: ${key}`);
      process.exit(1);
    }
  }

  const config = {
    get: (key: string) => process.env[key],
  } as ConfigService;

  const service = new SorobanService(config);
  await service.onModuleInit();

  const result = await service.resolveMarket(
    process.env.STELLAR_TEST_MARKET_ID!,
    process.env.STELLAR_TEST_OUTCOME!,
  );

  console.log('resolveMarket succeeded:', result);
}

main().catch((error) => {
  console.error('verify-soroban-resolve failed:', error);
  process.exit(1);
});
