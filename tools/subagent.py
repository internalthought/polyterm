#!/usr/bin/env python3
import argparse
import os
import sys
import uuid
from pathlib import Path

from _utils import find_repo_root, ensure_codex_dir, timestamp, run, read_file
from task import load_tasks


def write_brief(base: Path, task_text: str, target_dir: Path | None) -> Path:
    sid = str(uuid.uuid4())[:8]
    subdir = base / "subagents" / sid
    subdir.mkdir(parents=True, exist_ok=True)
    brief = subdir / "brief.md"
    target_rel = str(target_dir) if target_dir else "(repo root)"
    content = [
        f"# Subagent Brief - {sid}",
        f"Created: {timestamp()}",
        "",
        "## Task",
        task_text.strip(),
        "",
        "## Focus Directory",
        target_rel,
        "",
        "## Instructions",
        "- Follow TDD: write failing tests first, then implement the feature.",
        "- Keep commits atomic; ensure tests pass before each commit.",
        "- Update LOG.md and AGENTS.md memories as needed.",
        "",
    ]
    brief.write_text("\n".join(content) + "\n", encoding="utf-8")
    return brief


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Spawn a subagent Codex CLI for a focused task.")
    parser.add_argument("--task", required=True, help="Task for the subagent to execute.")
    parser.add_argument("--dir", type=Path, help="Optional working directory for the subagent focus.")
    parser.add_argument("--spawn", action="store_true", help="Open interactive Codex TUI with the brief as the initial prompt.")
    parser.add_argument("--exec", dest="exec_mode", action="store_true", help="Run 'codex exec' in automation mode with the brief as the prompt.")
    parser.add_argument("--profile", default="gpt5", help="Codex CLI profile to use (default: gpt5)")
    parser.add_argument("-m", "--model", help="Model name to pass to Codex CLI.")
    parser.add_argument("-a", "--ask-for-approval", action="store_true", help="Require approval mode in Codex CLI.")
    parser.add_argument("--full-auto", action="store_true", help="Enable full-auto mode in Codex CLI.")
    args = parser.parse_args(argv)

    if args.spawn and args.exec_mode:
        print("Choose only one of --spawn (interactive) or --exec (automation)", file=sys.stderr)
        return 2

    root = find_repo_root()
    codex_dir = ensure_codex_dir(root)
    brief = write_brief(codex_dir, args.task, args.dir)
    print(f"Subagent brief created at {brief}")

    if not args.spawn and not args.exec_mode:
        return 0

    # Build initial prompt from the brief contents
    prompt = read_file(brief)

    # Ensure Codex CLI is available
    code, _, _ = run(["which", "codex"], cwd=root)
    target_dir = (args.dir.resolve() if args.dir else root)
    if code != 0:
        print("Codex CLI not found in PATH. Launch manually using one of:")
        print(f"  codex --cd {target_dir} \"{prompt}\"")
        print(f"  codex exec --cd {target_dir} \"{prompt}\"")
        return 0

    base = ["codex"]
    if args.exec_mode:
        base.append("exec")
    base.extend(["--cd", str(target_dir)])
    if args.profile:
        base.extend(["--profile", args.profile])
    if args.model:
        base.extend(["--model", args.model])
    if args.ask_for_approval:
        base.append("--ask-for-approval")
    if args.full_auto:
        base.append("--full-auto")
    base.append(prompt)

    rc, out, err = run(base, cwd=root)
    if out:
        print(out, end="")
    if err:
        print(err, end="")
    return rc


if __name__ == "__main__":
    sys.exit(main())
