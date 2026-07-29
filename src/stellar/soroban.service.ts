import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc as SorobanRpc,
} from '@stellar/stellar-sdk';
import {
  SorobanConfigError,
  SorobanSimulationError,
  SorobanSubmissionError,
  SorobanTimeoutError,
} from './errors';

export interface ResolveMarketResult {
  txHash: string;
}

const POLL_INTERVAL_MS = 1_000;
const POLL_TIMEOUT_MS = 30_000;
const BASE_FEE = '10000';

@Injectable()
export class SorobanService implements OnModuleInit {
  private readonly logger = new Logger(SorobanService.name);
  private readonly rpcServer: SorobanRpc.Server;
  private readonly networkPassphrase: string;
  private readonly contractId: string;
  private readonly network: string;
  private readonly isTestnet: boolean;
  private readonly keypair: Keypair | null;
  private readonly secretConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    this.network = (
      this.config.get<string>('STELLAR_NETWORK') ?? 'testnet'
    ).toLowerCase();
    this.isTestnet = this.network === 'testnet';
    this.networkPassphrase = this.isTestnet
      ? Networks.TESTNET
      : Networks.PUBLIC;

    const rpcUrl =
      this.config.get<string>('STELLAR_RPC_URL') ??
      (this.isTestnet
        ? 'https://soroban-testnet.stellar.org'
        : 'https://soroban.stellar.org');

    this.rpcServer = new SorobanRpc.Server(rpcUrl, {
      allowHttp: rpcUrl.startsWith('http://'),
    });

    this.contractId =
      this.config.get<string>('INSIGHT_ARENA_CONTRACT_ID') ?? '';

    const secret = this.config.get<string>('STELLAR_AGENT_SECRET_KEY');
    if (!secret) {
      this.keypair = null;
      this.secretConfigured = false;
      this.logger.warn(
        'STELLAR_AGENT_SECRET_KEY not set — SorobanService resolveMarket will fail closed until configured.',
      );
      return;
    }

    this.secretConfigured = true;
    try {
      this.keypair = Keypair.fromSecret(secret);
    } catch {
      // Never include the secret (or parse details that might echo it) in errors.
      throw new SorobanConfigError(
        'STELLAR_AGENT_SECRET_KEY is not a valid Stellar secret key',
      );
    }
  }

  /**
   * Boot-time checks: when a secret is configured it has already been parsed
   * in the constructor; on testnet, verify the account exists (Friendbot hint).
   */
  async onModuleInit(): Promise<void> {
    if (!this.keypair) {
      return;
    }

    this.logger.log(
      `SorobanService ready (network=${this.network}, account=${this.keypair.publicKey()})`,
    );

    if (!this.isTestnet) {
      return;
    }

    try {
      await this.rpcServer.getAccount(this.keypair.publicKey());
    } catch (error) {
      const hint =
        'Fund the agent account on testnet via Friendbot: https://friendbot.stellar.org/?addr=' +
        this.keypair.publicKey();
      const detail =
        error instanceof Error ? error.message : 'account lookup failed';
      throw new SorobanConfigError(
        `Agent account ${this.keypair.publicKey()} does not exist on testnet (${detail}). ${hint}`,
      );
    }
  }

  isConfigured(): boolean {
    return this.secretConfigured && this.keypair != null && !!this.contractId;
  }

  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  getPublicKey(): string {
    if (!this.keypair) {
      throw new SorobanConfigError(
        'STELLAR_AGENT_SECRET_KEY is required for SorobanService',
      );
    }
    return this.keypair.publicKey();
  }

  getRpcServer(): SorobanRpc.Server {
    return this.rpcServer;
  }

  /**
   * Invoke InsightArena `resolve_market(oracle, market_id, resolved_outcome)`:
   * simulate → assemble → sign → submit → poll getTransaction (max 30s).
   */
  async resolveMarket(
    marketId: string,
    outcome: string,
  ): Promise<ResolveMarketResult> {
    if (!this.keypair) {
      throw new SorobanConfigError(
        'STELLAR_AGENT_SECRET_KEY is required to resolve markets',
      );
    }
    if (!this.contractId) {
      throw new SorobanConfigError(
        'INSIGHT_ARENA_CONTRACT_ID is required to resolve markets',
      );
    }

    const marketIdNum = this.parseMarketId(marketId);
    const sanitizedOutcome = this.sanitizeOutcome(outcome);

    this.logger.log(
      `resolveMarket: marketId=${marketIdNum} outcome=${sanitizedOutcome}`,
    );

    const account = await this.rpcServer.getAccount(
      this.keypair.publicKey(),
    );
    const contract = new Contract(this.contractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'resolve_market',
          new Address(this.keypair.publicKey()).toScVal(),
          nativeToScVal(marketIdNum, { type: 'u64' }),
          nativeToScVal(sanitizedOutcome, { type: 'symbol' }),
        ),
      )
      .setTimeout(30)
      .build();

    const simulation = await this.rpcServer.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulation)) {
      throw new SorobanSimulationError(
        this.redactSecrets(
          `Simulation failed: ${simulation.error ?? 'unknown simulation error'}`,
        ),
      );
    }

    if (!SorobanRpc.Api.isSimulationSuccess(simulation)) {
      throw new SorobanSimulationError(
        'Simulation failed: unexpected simulation response',
      );
    }

    const assembled = SorobanRpc.assembleTransaction(tx, simulation).build();
    assembled.sign(this.keypair);

    let sendResponse: SorobanRpc.Api.SendTransactionResponse;
    try {
      sendResponse = await this.rpcServer.sendTransaction(assembled);
    } catch (error) {
      throw new SorobanSubmissionError(
        this.redactSecrets(
          error instanceof Error
            ? `Transaction submission failed: ${error.message}`
            : 'Transaction submission failed',
        ),
      );
    }

    if (
      sendResponse.status === 'ERROR' ||
      sendResponse.status === 'TRY_AGAIN_LATER' ||
      sendResponse.status === 'DUPLICATE'
    ) {
      throw new SorobanSubmissionError(
        this.redactSecrets(
          `Transaction submission failed with status ${sendResponse.status}` +
            (sendResponse.errorResult
              ? `: ${JSON.stringify(sendResponse.errorResult)}`
              : ''),
        ),
      );
    }

    const txHash = sendResponse.hash;
    this.logger.log(`resolveMarket submitted: txHash=${txHash}`);

    await this.pollUntilComplete(txHash);
    return { txHash };
  }

  private async pollUntilComplete(txHash: string): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const status = await this.rpcServer.getTransaction(txHash);

      if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        this.logger.log(`resolveMarket confirmed: txHash=${txHash}`);
        return;
      }

      if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new SorobanSubmissionError(
          this.redactSecrets(
            `Transaction ${txHash} failed on-chain with status FAILED`,
          ),
        );
      }

      // NOT_FOUND / PENDING — keep polling
      await this.sleep(POLL_INTERVAL_MS);
    }

    throw new SorobanTimeoutError(
      `Timed out waiting for transaction ${txHash} after ${POLL_TIMEOUT_MS / 1000}s`,
    );
  }

  private parseMarketId(marketId: string): bigint {
    const trimmed = marketId.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new SorobanConfigError(
        `marketId must be a non-negative integer string, got: ${marketId}`,
      );
    }
    return BigInt(trimmed);
  }

  /** Soroban Symbol values are limited; keep length within Symbol bounds. */
  private sanitizeOutcome(outcome: string): string {
    const trimmed = outcome.trim();
    if (!trimmed || trimmed.length > 32) {
      throw new SorobanConfigError(
        'outcome must be a non-empty Symbol-compatible string (max 32 chars)',
      );
    }
    return trimmed;
  }

  /** Strip any accidental secret-key material from error strings. */
  private redactSecrets(message: string): string {
    const secret = this.config.get<string>('STELLAR_AGENT_SECRET_KEY');
    if (!secret) {
      return message;
    }
    return message.split(secret).join('[REDACTED]');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
