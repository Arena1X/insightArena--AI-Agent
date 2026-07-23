# AI Agent Issues & Feature Roadmap

This document serves as the **canonical task list** for the InsightArena AI Agent project. It tracks planned features, improvements, and known issues across all AI Agent roles.

## Overview

The AI Agent operates across five key domains:

- 🔮 **Prediction Analyst**: Generates confidence-scored picks and competes on leaderboards
- 🏟️ **Autonomous Market Creator**: Auto-populates platform with live fixtures
- ✅ **Oracle Validator**: Cross-checks results across multiple data sources
- 🏆 **Leaderboard Coach**: Provides personalized performance insights
- 🛠️ **Creator Assistant**: Helps users structure custom events

---

## Legend

- 🟢 **Ready to implement** — Well-defined, ready for a contributor
- 🟡 **In progress** — Someone is actively working on it
- 🔴 **Blocked** — Depends on another task or external work
- ✅ **Complete** — Finished and merged
- 🐛 **Bug** — Issue to be fixed
- 📈 **Enhancement** — Improvement to existing feature
- ✨ **Feature** — New functionality

---

## 🔮 Prediction Analyst

### Core Functionality

| Task | Status | Type | Priority | Notes |
|------|--------|------|----------|-------|
| Implement confidence scoring algorithm | 🟢 | ✨ | High | Bayesian model, based on historical accuracy |
| Fetch match data from API-Football | 🟢 | ✨ | High | Rate limiting, error handling |
| Generate predictions for all active matches | 🟢 | ✨ | High | Batch processing, scheduling |
| Submit predictions to leaderboard | 🟡 | ✨ | High | Soroban contract interaction |
| Cache predictions to reduce API calls | 🟢 | 📈 | Medium | Redis integration, TTL management |
| Handle prediction conflicts (same match, multiple models) | 🟢 | 📈 | Medium | Tie-breaking logic |

### Testing & Validation

| Task | Status | Type | Priority | Notes |
|------|--------|------|----------|-------|
| Unit tests for confidence scoring | 🟢 | ✨ | High | 80%+ coverage required |
| E2E tests for prediction pipeline | 🟢 | ✨ | High | Mock API-Football, test edge cases |
| Load test for 1000+ concurrent predictions | 🔴 | ✨ | Medium | Blocked on infrastructure setup |

---

## 🏟️ Autonomous Market Creator

### Core Functionality

| Task | Status | Type | Priority | Notes |
|------|--------|------|----------|-------|
| Fetch upcoming fixtures from API-Football | 🟢 | ✨ | High | Schedule daily/weekly fetches |
| Filter fixtures by league/sport/popularity | 🟢 | ✨ | High | Configurable filters, avoid duplicates |
| Auto-create markets on Soroban | 🟡 | ✨ | High | Contract calls, error recovery |
| Populate market metadata (teams, odds, etc.) | 🟢 | ✨ | Medium | Ensure Swagger spec includes all fields |
| Handle market creation failures gracefully | 🟢 | 📈 | Medium | Retry logic, logging |

### Configuration & Strategy

| Task | Status | Type | Priority | Notes |
|------|--------|------|----------|-------|
| Make market creation strategy configurable | 🟢 | 📈 | Medium | Support multiple creation strategies |
| Implement "only high-interest matches" strategy | 🟢 | ✨ | Medium | Filter by team popularity, league tier |
| Add scheduled creation (daily 9am UTC) | 🟢 | ✨ | Medium | NestJS schedule decorator |

---

## ✅ Oracle Validator

### Core Functionality

| Task | Status | Type | Priority | Notes |
|------|--------|------|----------|-------|
| Implement multi-source result validation | 🟢 | ✨ | High | Compare API-Football, ESPN, other oracles |
| Detect and flag result mismatches | 🟢 | ✨ | High | Alert mechanism for conflicts |
| Submit consensus results to Soroban | 🟡 | ✨ | High | Contract interaction, signature handling |
| Implement dispute resolution logic | 🟢 | ✨ | Medium | Define consensus threshold (2/3, unanimous, etc.) |

### Monitoring & Alerts

| Task | Status | Type | Priority | Notes |
|------|--------|------|----------|-------|
| Add logging for all oracle checks | 🟢 | 📈 | High | Structured logs, correlation IDs |
| Implement result validation metrics | 🟢 | 📈 | Medium | Track accuracy, response times |
| Alert when validation fails | 🟢 | ✨ | Medium | Email/Slack integration |

---

## 🏆 Leaderboard Coach

### Core Functionality

| Task | Status | Type | Priority | Notes |
|------|--------|------|----------|-------|
| Analyze user prediction history | 🟢 | ✨ | Medium | Calculate win rates, streaks, etc. |
| Generate personalized coaching advice | 🟢 | ✨ | Medium | LLM-powered recommendations |
| Identify weak categories (e.g., basketball) | 🟢 | ✨ | Medium | Per-sport performance analysis |
| Suggest diversification strategies | 🟢 | ✨ | Low | Reduce over-concentration in one sport |

### User Engagement

| Task | Status | Type | Priority | Notes |
|------|--------|------|----------|-------|
| Schedule weekly coaching emails | 🟢 | ✨ | Medium | Digest with top insights |
| Create coaching dashboard API | 🟢 | ✨ | Low | Expose advice via REST endpoint |

---

## 🛠️ Creator Assistant

### Core Functionality

| Task | Status | Type | Priority | Notes |
|------|--------|------|----------|-------|
| Recommend match selections for events | 🟢 | ✨ | Medium | Based on user preferences, popularity |
| Suggest optimal prediction deadlines | 🟢 | ✨ | Medium | Time zone aware, business logic |
| Validate event structure (prize pool, etc.) | 🟢 | ✨ | Medium | Pre-creation validation |
| Draft event descriptions (LLM) | 🟢 | ✨ | Low | Auto-generate compelling copy |

---

## 🛠️ Infrastructure & DevOps

| Task | Status | Type | Priority | Notes |
|------|--------|------|----------|-------|
| Set up CI/CD pipeline | ✅ | ✨ | High | GitHub Actions, automated tests |
| Docker containerization | 🟢 | ✨ | High | Prod-ready image, multi-stage build |
| Kubernetes deployment manifests | 🟢 | ✨ | Medium | Helm charts (future) |
| Implement request logging & tracing | 🟢 | ✨ | Medium | Correlation IDs, OpenTelemetry |
| Set up monitoring & alerting | 🟢 | ✨ | Medium | Prometheus, Grafana, PagerDuty |
| Environment-specific configurations | 🟢 | 📈 | Medium | dev, staging, prod with appropriate secrets |

---

## 🐛 Known Issues

| Issue | Status | Severity | Notes |
|-------|--------|----------|-------|
| API-Football rate limiting causes timeout on 1000+ fixtures | 🟢 | High | Add exponential backoff, queuing |
| Soroban contract calls fail intermittently (needs investigation) | 🔴 | High | Blocked on Stellar network stability |
| LLM API calls occasionally hang (30s+) | 🟢 | Medium | Add request timeout, circuit breaker |
| No error recovery for partial batch failures | 🟢 | Medium | Implement saga pattern or transaction logs |

---

## 📊 Metrics & Observability

| Task | Status | Type | Priority | Notes |
|------|--------|------|----------|-------|
| Track prediction accuracy over time | 🟢 | 📈 | Medium | Dashboard for internal review |
| Monitor Soroban contract performance | 🟢 | 📈 | Medium | Gas usage, transaction costs |
| Log all LLM API calls (cost tracking) | 🟢 | 📈 | Medium | Usage dashboard, budget alerts |

---

## 📚 Documentation

| Task | Status | Type | Priority | Notes |
|------|--------|------|----------|-------|
| Architecture decision records (ADRs) | 🟢 | 📈 | Medium | Document key design choices |
| API endpoint documentation (Swagger) | 🟢 | ✨ | High | Auto-generated from code |
| Contributor guide (CONTRIBUTING.md) | ✅ | ✨ | High | Setup, conventions, PR process |
| Deployment guide | 🟢 | ✨ | Medium | How to deploy to staging/prod |
| Performance tuning guide | 🟢 | 📈 | Low | Caching, database optimization |

---

## 🔄 How to Use This List

1. **Looking for something to work on?** Check for 🟢 **Ready to implement** items
2. **Want to propose a new feature?** Open a GitHub issue with the feature template
3. **Found a bug?** Use the bug template and reference the issue number here
4. **Updating status?** Open a PR to update this document

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on:
- Setting up your development environment
- Branch naming conventions
- Commit message format
- PR checklist

---

**Last Updated:** July 23, 2026

To suggest changes to this roadmap, open a GitHub issue or discussion. Major changes should be discussed with the team first.
