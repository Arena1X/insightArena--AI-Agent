# Contributing to InsightArena AI Agent

Welcome! This guide will help you set up your development environment and start contributing to the InsightArena AI Agent.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+** — [Download here](https://nodejs.org)
- **pnpm 10+** — Install globally: `npm install -g pnpm@10`
- **Git** — [Download here](https://git-scm.com)
- **Docker & Docker Compose** (optional, for local database) — [Download here](https://www.docker.com/products/docker-desktop)
- **PostgreSQL 15+** (alternative to Docker for database)

Verify your setup:

```bash
node --version    # Should be v20+
pnpm --version    # Should be 10+
git --version     # Any recent version
```

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/insightarena-ai-agent.git
cd insightarena-ai-agent
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

Copy the example environment file and populate it with your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```dotenv
# App
PORT=3001
NODE_ENV=development

# LLM (Required for Prediction Analyst, Leaderboard Coach, Creator Assistant)
OPENAI_API_KEY=sk-your-key-here

# Sports Oracle (Required for Autonomous Market Creator)
API_FOOTBALL_KEY=your-api-football-key
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io

# Stellar / Soroban (Required for Oracle Validator, blockchain interactions)
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_AGENT_SECRET_KEY=S...
INSIGHT_ARENA_CONTRACT_ID=C...

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=insight_arena_agent

# InsightArena Backend API
INSIGHT_ARENA_API_URL=http://localhost:3000/api
```

**Note:** For local development without external APIs, you can use placeholder values. Tests are configured to mock external services.

### 4. Set Up Database

**Option A: Using Docker Compose**

```bash
docker compose up -d postgres
```

**Option B: Using Local PostgreSQL**

```bash
createdb insight_arena_agent
psql insight_arena_agent < schema.sql  # If a schema file exists
```

### 5. Verify Setup

Run the test suite to confirm everything is working:

```bash
pnpm test
```

You should see tests passing (or skipped if external services are unavailable).

## Development Workflow

### Running the Application

```bash
# Start in development mode with hot reload
pnpm start:dev

# The app will be available at http://localhost:3001
```

### Building

```bash
pnpm build
```

The compiled output will be in the `dist/` directory.

### Testing

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode (reruns on file changes)
pnpm test:watch

# Run tests with coverage report
pnpm test:cov

# Run e2e tests
pnpm test:e2e
```

### Code Quality

```bash
# Format code with Prettier
pnpm format

# Lint and fix issues with ESLint
pnpm lint
```

Run these before committing:

```bash
pnpm lint && pnpm format && pnpm test
```

## Git Conventions

### Branch Naming

Use this format for branch names:

```
feat/issue-NN-slug        # New feature
fix/issue-NN-slug         # Bug fix
docs/issue-NN-slug        # Documentation
refactor/issue-NN-slug    # Code refactoring
test/issue-NN-slug        # Tests
chore/issue-NN-slug       # Build, dependencies, etc.
```

**Example:**

```bash
git checkout -b feat/issue-42-prediction-analyst-confidence-scoring
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(agent): add confidence scoring to prediction analyst

- Implements Bayesian confidence scoring based on historical accuracy
- Adds confidence levels to prediction results
- Closes #42
```

**Format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- **scope**: Module name (e.g., `agent`, `assistant`, `db`)
- **subject**: Imperative, present tense, lowercase, no period
- **body**: Explain what and why (wrapped at 72 chars)
- **footer**: Reference issues (`Closes #42`, `Fixes #10`)

**Examples:**

```bash
git commit -m "feat(assistant): add market participation forecast

Implements participation forecast service using historical event data
and user engagement patterns.

Closes #35"
```

## Pull Request Process

### Before Opening a PR

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/issue-NN-your-feature
   ```

2. **Make your changes** and commit regularly with clear messages.

3. **Keep your branch up to date**:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

4. **Run the full test suite**:
   ```bash
   pnpm lint && pnpm format && pnpm test && pnpm test:e2e
   ```

5. **Update Swagger documentation** if you modify API endpoints:
   - Ensure `@ApiOperation`, `@ApiResponse`, and `@ApiBody` decorators are present
   - Test the Swagger UI at `http://localhost:3001/api/docs`

### Opening a PR

Use the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md). Your PR should include:

- **Linked Issue**: Reference the GitHub issue (e.g., `Closes #42`)
- **Summary**: Brief description of changes
- **Testing Evidence**: Screenshots, curl commands, or test output
- **Checklist**: Confirm all boxes are checked

### PR Checklist

Before submitting, ensure:

- ✅ Code follows the project's coding standards
- ✅ All tests pass (`pnpm test`)
- ✅ Linting passes (`pnpm lint`)
- ✅ Code is formatted (`pnpm format`)
- ✅ New tests added for new features
- ✅ API documentation updated (if applicable)
- ✅ Swagger schema is correct
- ✅ No console.log or debug code committed
- ✅ Branch is up to date with `main`
- ✅ Commit messages follow conventions

## Code Style

### TypeScript

- Use **strict mode** (`strict: true` in tsconfig.json)
- Use **explicit types** — avoid `any`
- Use **const/let** — never `var`
- Use **arrow functions** for callbacks
- Use **async/await** instead of `.then()`

### NestJS Conventions

- **Modules**: Group related features (`agent.module.ts`, `assistant.module.ts`)
- **Services**: Contain business logic
- **Controllers**: Handle HTTP requests
- **DTOs**: Validate request/response data with `class-validator`
- **Interfaces**: Define type contracts

### Naming Conventions

```typescript
// Classes and Interfaces
class AgentService {}
interface IAgentConfig {}

// Files
agent.service.ts
agent.controller.ts
agent.module.ts
agent.interface.ts

// Variables and Functions
const predictionResults: PredictionResult[] = [];
function calculateConfidence(): number {}
```

## Testing Guidelines

### Unit Tests

- Test business logic in services
- Mock external dependencies (APIs, databases)
- Aim for 80%+ coverage
- Use descriptive test names: `should return confidence score when predictions exist`

### E2E Tests

- Test critical user flows
- Use the test utilities in `test/utils/`
- Mock external services

### Test Structure

```typescript
describe('AgentService', () => {
  let service: AgentService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AgentService],
    }).compile();
    service = module.get<AgentService>(AgentService);
  });

  describe('predictMatch', () => {
    it('should return prediction with confidence score', async () => {
      const result = await service.predictMatch({ matchId: 1 });
      expect(result.confidence).toBeGreaterThan(0);
    });
  });
});
```

## Reporting Issues

Found a bug? Have a feature idea? Check [AI_AGENT_ISSUES.md](./AI_AGENT_ISSUES.md) first — it's our canonical task list.

If it's not listed there:

1. **Search existing issues** to avoid duplicates
2. **Use the issue template** when creating a new issue
3. **Provide context**: What were you doing? What happened? What did you expect?
4. **Include examples**: Code snippets, error logs, screenshots

## Getting Help

- **Documentation**: Check the main [README.md](./README.md)
- **Issues**: Browse [AI_AGENT_ISSUES.md](./AI_AGENT_ISSUES.md)
- **Discussions**: Use GitHub Discussions for questions
- **Discord/Slack**: (Add community chat link if available)

## License

By contributing, you agree that your contributions will be licensed under the project's license.

---

**Happy coding!** 🚀

For questions or suggestions about this guide, open an issue or start a discussion.
