import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Account,
  Keypair,
  StrKey,
  SorobanDataBuilder,
  rpc as SorobanRpc,
} from '@stellar/stellar-sdk';
import {
  SorobanSimulationError,
  SorobanSubmissionError,
  SorobanTimeoutError,
  SorobanConfigError,
} from './errors';
import { SorobanService } from './soroban.service';

describe('SorobanService', () => {
  const agentKeypair = Keypair.random();
  const contractId = StrKey.encodeContract(Buffer.alloc(32, 1));
  const txHash = 'a'.repeat(64);

  let service: SorobanService;
  let moduleRef: TestingModule;
  let configValues: Record<string, string>;

  function mockConfig(): ConfigService {
    return {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;
  }

  beforeEach(async () => {
    configValues = {
      STELLAR_NETWORK: 'testnet',
      STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org',
      STELLAR_AGENT_SECRET_KEY: agentKeypair.secret(),
      INSIGHT_ARENA_CONTRACT_ID: contractId,
    };

    jest
      .spyOn(SorobanRpc.Server.prototype, 'getAccount')
      .mockResolvedValue(new Account(agentKeypair.publicKey(), '1') as never);

    jest
      .spyOn(SorobanRpc.Server.prototype, 'simulateTransaction')
      .mockResolvedValue({
        results: [{}],
        transactionData: new SorobanDataBuilder(),
        result: { auth: [] },
        minResourceFee: '100',
        latestLedger: 1,
        _parsed: true,
      } as never);

    jest.spyOn(SorobanRpc, 'assembleTransaction').mockReturnValue({
      build: () => ({
        sign: jest.fn(),
      }),
    } as never);

    jest
      .spyOn(SorobanRpc.Server.prototype, 'sendTransaction')
      .mockResolvedValue({
        status: 'PENDING',
        hash: txHash,
      } as never);

    jest
      .spyOn(SorobanRpc.Server.prototype, 'getTransaction')
      .mockResolvedValue({
        status: SorobanRpc.Api.GetTransactionStatus.SUCCESS,
        hash: txHash,
      } as never);

    moduleRef = await Test.createTestingModule({
      providers: [
        SorobanService,
        { provide: ConfigService, useValue: mockConfig() },
      ],
    }).compile();

    service = moduleRef.get(SorobanService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await moduleRef?.close();
  });

  describe('boot validation', () => {
    it('parses the agent secret and exposes the public key', () => {
      expect(service.getPublicKey()).toBe(agentKeypair.publicKey());
      expect(service.getNetworkPassphrase()).toContain('Test SDF');
    });

    it('throws SorobanConfigError for an invalid secret key', () => {
      configValues.STELLAR_AGENT_SECRET_KEY = 'not-a-secret';
      expect(
        () =>
          new SorobanService({
            get: (key: string) => configValues[key],
          } as ConfigService),
      ).toThrow(SorobanConfigError);
    });

    it('on testnet, onModuleInit fails with a Friendbot hint when the account is missing', async () => {
      jest
        .spyOn(SorobanRpc.Server.prototype, 'getAccount')
        .mockRejectedValue(new Error('Account not found'));

      await expect(service.onModuleInit()).rejects.toThrow(/Friendbot/);
      await expect(service.onModuleInit()).rejects.toThrow(SorobanConfigError);
    });
  });

  describe('resolveMarket', () => {
    it('returns the tx hash on the successful simulate → submit → confirm path', async () => {
      const result = await service.resolveMarket('42', 'Yes');

      expect(result.txHash).toBe(txHash);
      expect(
        SorobanRpc.Server.prototype.simulateTransaction,
      ).toHaveBeenCalled();
      expect(SorobanRpc.Server.prototype.sendTransaction).toHaveBeenCalled();
      expect(SorobanRpc.Server.prototype.getTransaction).toHaveBeenCalledWith(
        txHash,
      );
    });

    it('aborts with SorobanSimulationError before submission when simulation fails', async () => {
      jest
        .spyOn(SorobanRpc.Server.prototype, 'simulateTransaction')
        .mockResolvedValue({
          error: 'Contract Error: Unauthorized',
          _parsed: true,
        } as never);

      await expect(service.resolveMarket('42', 'Yes')).rejects.toBeInstanceOf(
        SorobanSimulationError,
      );
      expect(SorobanRpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
    });

    it('returns SorobanSubmissionError when sendTransaction reports ERROR', async () => {
      jest
        .spyOn(SorobanRpc.Server.prototype, 'sendTransaction')
        .mockResolvedValue({
          status: 'ERROR',
          hash: txHash,
          errorResult: { detail: 'boom' },
        } as never);

      await expect(service.resolveMarket('42', 'Yes')).rejects.toBeInstanceOf(
        SorobanSubmissionError,
      );
    });

    it('returns SorobanTimeoutError when confirmation exceeds 30s', async () => {
      jest
        .spyOn(SorobanRpc.Server.prototype, 'getTransaction')
        .mockResolvedValue({
          status: SorobanRpc.Api.GetTransactionStatus.NOT_FOUND,
        } as never);

      let now = 1_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      jest
        .spyOn(
          service as unknown as { sleep: (ms: number) => Promise<void> },
          'sleep',
        )
        .mockImplementation(async () => {
          now += 31_000;
        });

      await expect(service.resolveMarket('42', 'Yes')).rejects.toBeInstanceOf(
        SorobanTimeoutError,
      );
    });

    it('never logs or surfaces the agent secret key', async () => {
      const secret = agentKeypair.secret();
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const debugSpy = jest
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation();

      jest
        .spyOn(SorobanRpc.Server.prototype, 'simulateTransaction')
        .mockResolvedValue({
          error: `Contract Error involving ${secret}`,
          _parsed: true,
        } as never);

      await expect(service.resolveMarket('7', 'No')).rejects.toMatchObject({
        message: expect.not.stringContaining(secret),
      });

      try {
        await service.resolveMarket('7', 'No');
      } catch (error) {
        expect((error as Error).message).not.toContain(secret);
        expect((error as Error).message).toContain('[REDACTED]');
      }

      const logged = [
        ...logSpy.mock.calls,
        ...errorSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...debugSpy.mock.calls,
      ]
        .flat()
        .map(String)
        .join('\n');

      expect(logged).not.toContain(secret);
    });

    it('rejects non-numeric market ids with SorobanConfigError', async () => {
      await expect(
        service.resolveMarket('market_abc', 'Yes'),
      ).rejects.toBeInstanceOf(SorobanConfigError);
    });
  });
});
