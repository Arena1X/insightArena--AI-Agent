# InsightArena AI Agent

InsightArena is a next-generation decentralized prediction market platform built natively on the **[Stellar network](https://stellar.org/)**. By leveraging Stellar's high-throughput consensus protocol and the robust **Soroban** smart contract environment, InsightArena provides users with a lightning-fast, highly secure, and incredibly cost-effective way to participate in global prediction events and competitive leaderboard challenges.

Users can submit predictions on real-world outcomes such as sports results, crypto prices, or other measurable events. Thanks to Stellar's nearly instant transaction finality and fraction-of-a-cent fees, participants can interact with markets seamlessly without the friction found on other blockchains. All predictions, outcomes, and payouts are automatically resolved and recorded transparently through secure Soroban smart contracts.

In addition to regular global markets, **any user can easily create their own custom prediction events and leaderboards**. Creators can open these events to the public or make them private competitions, generating special invite codes that friends can use to join in. Whether public or private, participants earn points based on performance and compete for top rewards.

By fusing traditional prediction markets with gamified competition, and powering it all with Stellar's enterprise-grade infrastructure, InsightArena creates an engaging, transparent, and trust-minimized ecosystem where users can test their insights, host private challenges, compete globally, and earn rewards based on their accuracy.

---

> [!IMPORTANT]
> **This repository is specifically for building the InsightArena AI Agent.** It acts as the autonomous intelligence layer responsible for market analysis, autonomous creation, outcome validation, and user coaching.

## 🤖 The AI Agent Roles

The AI Agent operates across four key domains:

1.  **🔮 Prediction Analyst**: Generates confidence-scored picks for every match and competes publicly on the leaderboards.
2.  **🏟️ Autonomous Market Creator**: Auto-populates the platform by pulling live fixtures from sports oracles and creating high-interest markets.
3.  **✅ Oracle Validator**: Cross-checks results across multiple data sources to ensure tamper-proof, consensus-driven outcome resolution on the Stellar network.
4.  **🏆 Leaderboard Coach**: Provides personalized performance insights and strategic nudges to users to drive engagement.
5.  **🛠️ Creator Assistant**: Acts as a personal assistant for users creating custom events, recommending optimal match selections, suggesting prediction deadlines, and helping structure competitions to maximise participation.

## 🏗️ Project Structure

This project is built using **NestJS** for robust service orchestration and **Python (FastAPI)** for machine learning model inference.

```text
src/
├── agent/            # Core AI Agent module
│   ├── dto/          # Data Transfer Objects
│   ├── entities/     # Database entities (if applicable)
│   ├── interfaces/   # Type definitions and interfaces
│   ├── agent.service.ts    # Main business logic
│   └── agent.controller.ts # API endpoints
├── config/           # Environment and app configuration
├── common/           # Shared guards, interceptors, and filters
├── main.ts           # Application entry point
└── app.module.ts     # Root module
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (optional, for DB/ML sidecar)

### Installation

```bash
pnpm install
```

### Run

```bash
# Development
pnpm run start:dev

# Production
pnpm run build
pnpm run start:prod
```

## 🛠️ Implementation Plan

Implementation is driven by GitHub Issues, covering:
- Oracle integration (API-Football)
- Soroban contract orchestration
- ML model integration
- User coaching logic

---
