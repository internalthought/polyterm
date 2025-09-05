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
- `tools/test.py`: Run all tests or a specific subset/category.
- `tools/task.py`: Manage task lists and phases (list, create, edit, checkoff).
- `tools/memorize.py`: Read and write “memories” into `AGENTS.md` files by scope.
- `tools/reset.py`: Capture a reset summary and optionally spawn a fresh Codex session.
- `tools/undo.py`: Quickly undo the last working copy changes (prefer Git where available).
- `tools/subagent.py`: Spawn a focused subagent session for a specific task, close on success.
- `tools/plan.py`: Split a task into smaller steps and update tasks/phases accordingly.
- `tools/document.py`: Append documentation of completed work to `LOG.md` files.

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
- Frameworks supported: Jest, Mocha, Vitest (auto-detected when feasible).
- Categories are mapped to common scripts if present (e.g., `test:unit`, `test:integration`, `test:e2e`).
- Use `--pattern` to focus a subset (e.g., Jest `-t`), or fallback to test file globs.

## Safety and Recovery

- Use `tools/undo.py` to revert uncommitted changes (Git hard reset if repo). For non-Git repos, this tool is a no-op.
- Use `tools/reset.py` to summarize the current context (tasks, git status) and start a fresh Codex session if needed.

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

## Feature Folders

- Create feature folders under the repo (e.g., `src/feature-x/`).
- Add an `AGENTS.md` in each feature folder with area-specific guidance (design constraints, APIs, test categories, fixtures).
- The memory system merges `AGENTS.md` top-down (global → repo root → feature folder).
- Use `tools/document.py --paths <feature-dir>` to keep a local `LOG.md` per feature.

## Environment & Requirements

- Node test runner available (npm `test` script or Jest/Vitest/Mocha installed).
- Python 3.9+ to execute tools; Git repo initialized.
- Codex CLI installed (`npm i -g @openai/codex`) and on PATH.
- API key configured (e.g., `OPENAI_API_KEY`) for Codex CLI.

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
