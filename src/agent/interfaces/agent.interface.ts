export interface AgentCapability {
  name: string;
  operational: boolean;
  message?: string;
}

export type AgentStatus = 'healthy' | 'degraded' | 'down';
export type AgentMode = 'active' | 'idle' | 'maintenance';
export type RiskLevel = 'low' | 'medium' | 'high';
export type PredictionStatus = 'pending' | 'settled_won' | 'settled_lost';
export type PerformanceTrend = 'improving' | 'declining' | 'stable';
export type AdvicePriority = 'low' | 'medium' | 'high';
export type CoachFocus = 'improve_accuracy' | 'risk_management' | 'market_selection' | 'general';

export interface MarketAnalysis {
  marketId: string;
  confidence: number;
  reasoning: string;
  recommendation: string;
  factors: AnalysisFactor[];
  riskLevel?: RiskLevel;
  analyzedAt: Date;
}

export interface AnalysisFactor {
  name: string;
  assessment: string;
  weight?: number;
}

export interface AgentPrediction {
  predictionId: string;
  marketId: string;
  outcome: string;
  confidence: number;
  status: PredictionStatus;
  createdAt: Date;
}

export interface CoachAdvice {
  userId: string;
  metrics: PerformanceMetric[];
  advice: AdviceItem[];
  trend: PerformanceTrend;
  generatedAt: Date;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
}

export interface AdviceItem {
  message: string;
  priority: AdvicePriority;
  impact?: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  correctPredictions: number;
  totalPredictions: number;
  accuracy: number;
  isCurrentUser: boolean;
}

export interface LeaderboardInsight {
  userId: string;
  leaderboardType: string;
  currentRank: number;
  totalParticipants: number;
  rankTrend: string;
  topEntries?: LeaderboardEntry[];
  generatedAt: Date;
}
