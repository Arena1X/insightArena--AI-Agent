/**
 * Jest stand-in for `@stellar/stellar-sdk`.
 * Keeps unit tests offline and avoids transforming ESM `@noble/*` packages.
 */

export const Networks = {
  TESTNET: 'Test SDF Network ; September 2015',
  PUBLIC: 'Public Global Stellar Network ; July 2015',
};

export class Keypair {
  static _seq = 0;

  constructor(
    private readonly _publicKey: string,
    private readonly _secret: string,
  ) {}

  static random(): Keypair {
    Keypair._seq += 1;
    const n = Keypair._seq;
    const secret = `SMOCKSECRETKEY${String(n).padStart(44, 'X')}`;
    return Keypair.fromSecret(secret);
  }

  static fromSecret(secret: string): Keypair {
    if (!secret || !secret.startsWith('S') || secret.length < 10) {
      throw new Error('bad secret');
    }
    // Deterministic public key derived from the secret so round-trips match.
    const suffix = secret.slice(1).padEnd(50, '0').slice(0, 50);
    return new Keypair(`G${suffix}`, secret);
  }

  static fromPublicKey(publicKey: string): Keypair {
    if (!publicKey.startsWith('G')) {
      throw new Error('bad public key');
    }
    return new Keypair(publicKey, '');
  }

  publicKey(): string {
    return this._publicKey;
  }

  secret(): string {
    return this._secret;
  }
}

export class Account {
  constructor(
    public readonly _accountId: string,
    public sequence: string,
  ) {}

  accountId(): string {
    return this._accountId;
  }

  sequenceNumber(): string {
    return this.sequence;
  }

  incrementSequenceNumber(): void {
    this.sequence = String(BigInt(this.sequence) + 1n);
  }
}

export class Address {
  constructor(private readonly value: string) {}

  toScVal(): { address: string } {
    return { address: this.value };
  }
}

export class Contract {
  constructor(private readonly contractId: string) {}

  call(method: string, ...args: unknown[]) {
    return { type: 'contract', contractId: this.contractId, method, args };
  }
}

export class TransactionBuilder {
  private operations: unknown[] = [];

  constructor(
    public readonly source: Account,
    public readonly opts: { fee: string; networkPassphrase: string },
  ) {}

  addOperation(op: unknown): this {
    this.operations.push(op);
    return this;
  }

  setTimeout(_seconds: number): this {
    return this;
  }

  build(): {
    operations: unknown[];
    sign: (kp: Keypair) => void;
  } {
    return {
      operations: this.operations,
      sign: jest.fn(),
    };
  }
}

export function nativeToScVal(
  value: unknown,
  _opts?: { type?: string },
): { value: unknown } {
  return { value };
}

export const StrKey = {
  encodeContract: (buf: Buffer | Uint8Array): string =>
    `C${Buffer.from(buf).toString('hex').slice(0, 54).padEnd(54, '0')}`,
};

export class SorobanDataBuilder {
  build() {
    return {};
  }
}

type SimulationResult =
  | { error: string; _parsed?: boolean }
  | {
      results: unknown[];
      transactionData: SorobanDataBuilder;
      result: { auth: unknown[] };
      minResourceFee: string;
      latestLedger: number;
      _parsed?: boolean;
    };

const Api = {
  GetTransactionStatus: {
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    NOT_FOUND: 'NOT_FOUND',
    PENDING: 'PENDING',
  },
  isSimulationError: (
    sim: SimulationResult,
  ): sim is { error: string; _parsed?: boolean } =>
    !!sim &&
    typeof sim === 'object' &&
    'error' in sim &&
    !!(sim as { error?: string }).error,
  isSimulationSuccess: (sim: SimulationResult): boolean =>
    !!sim &&
    typeof sim === 'object' &&
    !('error' in sim && (sim as { error?: string }).error),
};

export class Server {
  constructor(
    public readonly serverURL: string,
    _opts?: { allowHttp?: boolean },
  ) {}

  async getAccount(accountId: string): Promise<Account> {
    return new Account(accountId, '1');
  }

  async simulateTransaction(_tx: unknown): Promise<SimulationResult> {
    return {
      results: [{}],
      transactionData: new SorobanDataBuilder(),
      result: { auth: [] },
      minResourceFee: '100',
      latestLedger: 1,
      _parsed: true,
    };
  }

  async sendTransaction(_tx: unknown): Promise<{
    status: string;
    hash: string;
    errorResult?: unknown;
  }> {
    return {
      status: 'PENDING',
      hash: 'a'.repeat(64),
    };
  }

  async getTransaction(_hash: string): Promise<{
    status: string;
    hash: string;
  }> {
    return {
      status: Api.GetTransactionStatus.SUCCESS,
      hash: 'a'.repeat(64),
    };
  }

  async getHealth(): Promise<{ status: string }> {
    return { status: 'healthy' };
  }
}

export const rpc = {
  Server,
  Api,
  assembleTransaction: (
    _tx: unknown,
    _sim: unknown,
  ): { build: () => { sign: (kp: Keypair) => void } } => ({
    build: () => ({
      sign: jest.fn(),
    }),
  }),
};

export default {
  Networks,
  Keypair,
  Account,
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  StrKey,
  SorobanDataBuilder,
  rpc,
};
