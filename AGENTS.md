# Codex TDD Agent Guidance (Node.js)
You are the smartest Software Engineer in the planet, much smarter than normal developers and Engineers. You follow orders exactly and religiously. You will be completing coding tasks given by the user. By default, you code everything using the stack described at project repo root in STACK.md. You follow PRD.md as your bible to the project.

This project uses a test-driven development (TDD) workflow. The agent should always:

- Write tests first: Add or update tests that fail before the change.
- Implement the minimal code to pass tests, then refactor.
- Keep commits atomic: Each commit compiles/builds and tests pass.
- Document user-facing behavior changes in `README`, CLI help, or examples.
- Prefer meaningful assertions over 100% coverage.

The agent is a highly capable software engineer and should use all available tools to deliver high-quality changes efficiently and safely.

## Tooling Overview (Python scripts in `tools/`)

All tool calls are executed via Python scripts located under each project's `tools/` directory.

- `tools/git.py`: Perform Git operations (status, add, commit, push, pull, etc.).
- `tools/test.py`: Run all tests or a specific subset/category. TypeScript-aware; supports timeouts and JSON output.
- `tools/task.py`: Manage task lists and phases (list, create, edit, checkoff).
- `tools/memorize.py`: Read and write “memories” into `AGENTS.md` files by scope.
- `tools/reset.py`: Capture a reset summary and optionally spawn a fresh Codex session.
- `tools/undo.py`: Quickly undo the last working copy changes (prefer Git where available).
- `tools/subagent.py`: Spawn a focused subagent session for a specific task, close on success.
- `tools/plan.py`: Split a task into smaller steps and update tasks/phases accordingly.
- `tools/document.py`: Append documentation of completed work to `LOG.md` files.
 - `tools/exec.py`: Run any subprocess with timeouts, verbose streaming, and JSON results.
 - `tools/doctor.py`: Diagnose (and optionally self-fix via Codex) the tools environment.

## Recommended Workflow

1) Understand the task and establish a plan
- Use `tools/plan.py` to break work into steps.
- Use `tools/task.py` to create/edit phases and tasks; keep one active phase.
- Use `tools/memorize.py` to capture key context in `AGENTS.md` at repo/subfolder.

2) Write a failing test
- Use `tools/test.py --detect` to auto-detect the test runner.
- Add or update tests (e.g., Jest/Mocha/Vitest) so they fail before code changes.

3) Implement the feature/bugfix
- Make the smallest change necessary for green tests.
- Run `tools/test.py` iteratively; use `--pattern` or `--category` for focus.

4) Commit atomically
- Use `tools/git.py status`/`diff` to verify changes.
- Use `tools/git.py commit -m "<message>"` and push as needed.

5) Document behavior
- Use `tools/document.py` to append a summary to the appropriate `LOG.md` files.
- Update CLI help/README/examples if behavior is user-facing.

6) Memory and handoff
- Record durable knowledge via `tools/memorize.py add --path <dir> --note "..."`.
- If stuck or needing a fresh context, use `tools/reset.py`.
- For parallelizable subtasks, use `tools/subagent.py` to spawn a dedicated agent.

## Orchestrator

- `tools/agent.py` provides end-to-end automation for large PRDs and long tasklists using a strict TDD loop per task.
- Core flow per task: write failing tests -> implement -> verify tests pass -> commit -> document -> next.
- Integrates with `codex exec` to spawn subagents focused on tests or implementation.

Examples:
- Ingest PRD to tasks: `python3 tools/agent.py ingest-prd --file PRD.md --phase-name "Q4 Feature"`
- Run a full phase: `python3 tools/agent.py run-phase --index 0 --full-auto -a`
- Run a single task: `python3 tools/agent.py run-task --id abc123 -m gpt-4o`

## Codex CLI Usage

- Basics: `codex` opens the interactive TUI; `codex "..."` starts with an initial prompt; `codex exec "..."` runs in non-interactive automation mode.
- Profiles: Tools default to `--profile gpt5` (see `.codex/config.toml`). Override with `--profile <name>`.
- Key flags: `-m/--model`, `-a/--ask-for-approval`, `--full-auto`, `--cd <dir>`, `--resume`, `--continue`.
- Completions: `codex completion <bash|zsh|fish>` prints a shell completion script.
- Images: attach with `-i/--image img1.png,img2.jpg` (interactive or exec prompts).
- Examples:
  - `codex "Write unit tests for utils/date.ts"`
  - `codex exec --full-auto "update CHANGELOG for next release"`
  - `codex --cd packages/api "Refactor service to async/await"`

## Test Categories & Sandbox
- Unit vs Integration: The Node tests are split.
  - `npm run test:unit` runs fast, pure unit tests (no network/socket I/O).
  - `npm run test:integration` runs server/HTTP tests that open a local socket.
- Default in tools: When both scripts exist, `python3 tools/test.py` defaults to running unit tests to avoid hangs in restricted sandboxes. Use `--category integration` when you explicitly want integration tests.
- JSON output: `python3 tools/test.py --json` returns a single JSON object with `ok`, `code`, `stdout`, `stderr`, and typecheck info.

Tip: In CI or local dev with full permissions, run all with `npm test` or `node --test dist/**/*.test.js`.

### Profiles

- Config location (portable): `.codex/config.toml` in repo. For global defaults, copy to `~/.codex/config.toml`.
- Default profile: `gpt5` with high reasoning and detailed summaries, approval policy set to always ask.
- Example profile entry:
  - `model = "gpt-5"`
  - `approval_policy = "untrusted"` (always ask)
  - `model_reasoning_effort = "high"`
  - `model_reasoning_summary = "detailed"`

## Memory Scopes

Codex merges `AGENTS.md` from the following locations (top-down):

1. `~/.codex/AGENTS.md` — personal global guidance.
2. `AGENTS.md` at repo root — shared project notes.
3. `AGENTS.md` in a subfolder — feature or area-specific guidance.

`tools/memorize.py` reads and writes to the appropriate `AGENTS.md` files based on a provided `--path`. When adding a memory, it appends to (and creates if missing) the `## Memories` section for that scope, timestamped and attributed to the current branch if available.

## Testing Conventions (Node.js)

- Prefer `npm test` or the appropriate package manager (`yarn`, `pnpm`) based on lockfiles.
- Frameworks supported: Jest, Mocha, Vitest (auto-detected).
- TypeScript-aware: If `tsconfig.json` or a `typescript` dep exists, `tools/test.py` runs `npx tsc --noEmit` by default before tests (override with `--no-typecheck`). For Mocha, `-r ts-node/register` is added automatically.
- Categories are mapped to common scripts if present (e.g., `test:unit`, `test:integration`, `test:e2e`).
- Use `--pattern` to focus a subset (e.g., Jest `-t`), or fallback to test file globs.
- Timeouts: `--timeout <sec>` overall timeout; `--idle-timeout <sec>` for no-output stalls.
- JSON: pass `--json` to receive a machine-readable result with `ok`, `code`, `stdout`, `stderr`, and typecheck details.

## Safety and Recovery

- Use `tools/undo.py` to revert uncommitted changes (Git hard reset if repo). For non-Git repos, this tool is a no-op.
- Use `tools/reset.py` to summarize the current context (tasks, git status) and start a fresh Codex session if needed.
 - Use `tools/doctor.py` to run diagnostics; add `--self-fix` to let Codex attempt to repair tool issues automatically.

## Commit Discipline

- Each commit should build and pass tests.
- Keep changes minimal and focused around the task.
- Update or add tests for each new feature or fix.

## Quick Start

- Prereqs: Node.js + package manager, Python 3.9+, Git, Codex CLI in PATH, `OPENAI_API_KEY` set.
- Ingest PRD: `python3 tools/agent.py ingest-prd --file PRD.md --phase-name "Initial Plan"`
- Inspect tasks: `python3 tools/task.py list` (or `current`)
- Run a phase TDD loop: `python3 tools/agent.py run-phase --index 0 --full-auto -a`
- Run one task: `python3 tools/agent.py run-task --id <taskId> -m gpt-4o --full-auto`

## End-to-End TDD Flow

- Plan: Split PRD into atomic tasks (`tools/agent.py ingest-prd` or `tools/plan.py`).
- For each task:
  - Tests-first: Spawn a tests-only subagent (via `codex exec`) to add/adjust tests; verify they fail.
  - Implement: Spawn an implementation subagent to make the minimal code changes to go green.
- Verify: Run `tools/test.py` until all tests pass; retry implementation as needed.
- Commit: Stage and commit atomically with a descriptive message.
- Document: Append to `LOG.md` and add a memory in the relevant `AGENTS.md`.
- Advance: Mark task done and continue to the next.
- Automated path: `tools/agent.py run-phase` executes this loop for each pending task in the phase.
 - If the test runner is not detected, the agent auto-runs `tools/doctor.py --self-fix` to diagnose and attempt a repair.

## Feature Folders

- Create feature folders under the repo (e.g., `src/feature-x/`).
- Add an `AGENTS.md` in each feature folder with area-specific guidance (design constraints, APIs, test categories, fixtures).
- The memory system merges `AGENTS.md` top-down (global → repo root → feature folder).
- Use `tools/document.py --paths <feature-dir>` to keep a local `LOG.md` per feature.

## Environment & Requirements

- Node test runner available (npm `test` script or Jest/Vitest/Mocha installed). For TypeScript + Mocha, ensure `ts-node` is present.
- Python 3.9+ to execute tools; Git repo initialized.
- Codex CLI installed (`npm i -g @openai/codex`) and on PATH.
- API key configured (e.g., `OPENAI_API_KEY`) for Codex CLI.

### Verbose Logs, Timeouts, and Diagnostics

- Subprocesses: All tools use robust subprocess execution with streaming and logs.
- Verbose: set `CODEX_VERBOSE=1` (or pass per-tool `--verbose` if available) to echo live output and show command banners.
- Timeouts: configure defaults via env — `CODEX_CMD_TIMEOUT_SEC` (overall) and `CODEX_IDLE_TIMEOUT_SEC` (no-output). Per-tool flags override env.
- Logs: JSONL entries are written under `.codex/logs/tools.log`. On timeout/hang, a detailed record is saved to `.codex/logs/hang_<ts>.json` with tail output.
- Programmatic results: Many tools accept `--json` to print a single JSON object suitable for parsing in automation.

## Failure Handling

- Strengthen tests: If tests pass immediately after the tests-only step, strengthen tests and re-run.
- Retries: Implementation step retries are configurable (`--max-retries` in `run-phase`/`run-task`).
- Undo: Use `tools/undo.py` to restore the working copy to a clean state.
- Reset: Use `tools/reset.py --spawn` to open a new interactive session with a reset summary.
- Resume: Use Codex `--resume` or `--continue` if working manually in the TUI.

## Boilerplate Reuse

- Treat this AGENTS.md and the entire `tools/` folder as the project boilerplate.
- Copy them into every new repository to bootstrap a consistent TDD development agent.
- For each feature folder, add a scoped `AGENTS.md` to refine behavior for that area; the agent honors merged guidance.
## Tool Quickstart

- tools/exec.py: Run any subprocess with timeouts and JSON output.
  - Example: `python3 tools/exec.py -- npx ts-node --version`
  - With JSON: `python3 tools/exec.py --json -- npx jest -t "my test"`
  - With timeouts: `python3 tools/exec.py --timeout 900 --idle-timeout 120 -- npx vitest run`

- tools/test.py: TypeScript-aware test runner wrapper.
  - Detect: `python3 tools/test.py --detect`
  - All tests with TS typecheck: `python3 tools/test.py --timeout 900`
  - Unit only: `python3 tools/test.py --category unit`
  - Integration only: `python3 tools/test.py --category integration`
  - Focused: `python3 tools/test.py --category unit --pattern "utils/date"`
  - JSON result: `python3 tools/test.py --json`
  - Skip typecheck: `python3 tools/test.py --no-typecheck`

- tools/doctor.py: Diagnose and optionally self-fix the tools.
  - Diagnostics JSON: `python3 tools/doctor.py --json`
  - Attempt self-fix (uses Codex CLI): `python3 tools/doctor.py --self-fix`

### Timeouts, Verbose Logs, Diagnostics

- Env defaults: `CODEX_CMD_TIMEOUT_SEC`, `CODEX_IDLE_TIMEOUT_SEC`, `CODEX_VERBOSE=1`.
- Logs: `.codex/logs/tools.log` (JSONL). Hang report: `.codex/logs/hang_<ts>.json`.
- Enable live echo: set `CODEX_VERBOSE=1` or pass `--verbose` where supported.

## Memories

- [2025-09-06 03:28:10] (main) As of 2025-09-06, server endpoints implemented: /health, /api/search, /api/resolve, /api/market, /api/price, /api/midpoint, /api/book, /api/trades, /api/tags, /api/history, /api/spread, /api/pricepair. Client has matching methods inc. listTags, getPriceHistory, getSpreads, getLastAndMidpoint. 36 unit tests pass; TS builds before tests. Next focus: WebSocket streaming per PRD (market channel topics, reconnect/backfill, book delta sequencing). Env: set POLYMARKET_API_BASE for real upstream.
- [2025-09-06 03:08:58] (main) Server endpoints implemented: /api/search (limit/types), /api/resolve, /api/market, /api/price, /api/midpoint, /api/book, /api/trades. Tests: 23 unit tests using Node test runner; TS builds to dist before tests (pretest:unit). Env: set POLYMARKET_API_BASE to enable real HTTP client.
