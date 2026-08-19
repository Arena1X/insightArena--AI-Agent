export interface SeededPrediction {
  id: string;
  marketId: string;
  userId: string;
  outcome: string;
}

export interface SeededAudit {
  id: string;
  entityId: string;
  action: string;
}

export interface SeededDatabaseFixture {
  predictions: SeededPrediction[];
  audits: SeededAudit[];
}

const fixture: SeededDatabaseFixture = {
  predictions: [
    {
      id: 'pred_seed_001',
      marketId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      outcome: 'team_a_win',
    },
  ],
  audits: [
    {
      id: 'audit_seed_001',
      entityId: 'pred_seed_001',
      action: 'prediction.created',
    },
  ],
};

let activeFixture: SeededDatabaseFixture | undefined;

export async function loadSeededDatabaseFixture(): Promise<SeededDatabaseFixture> {
  activeFixture = structuredClone(fixture);
  return activeFixture;
}

export async function rollbackSeededDatabaseFixture(): Promise<void> {
  activeFixture = undefined;
}
