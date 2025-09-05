#!/usr/bin/env python3
import argparse
import os
import sys
import time
from pathlib import Path

from _utils import find_repo_root, run, read_file, write_file, timestamp
from task import load_tasks, save_tasks, add_phase, add_task, set_current_phase, find_task
from plan import split_into_steps


def detect_codex(root: Path) -> bool:
    code, _, _ = run(["which", "codex"], cwd=root)
    return code == 0


def run_tests(root: Path) -> bool:
    code, out, err = run([sys.executable, str(root / "tools" / "test.py")], cwd=root)
    if out:
        print(out, end="")
    if err:
        print(err, end="")
    return code == 0


def git_commit(root: Path, message: str) -> bool:
    # Stage all and commit
    code1, out1, err1 = run([sys.executable, str(root / "tools" / "git.py"), "--", "add", "-A"], cwd=root)
    if out1:
        print(out1, end="")
    if err1:
        print(err1, end="")
    code2, out2, err2 = run([sys.executable, str(root / "tools" / "git.py"), "--", "commit", "-m", message], cwd=root)
    if out2:
        print(out2, end="")
    if err2:
        print(err2, end="")
    if code2 == 0:
        return True
    # tolerate no-op commits
    joined = (out2 or "") + (err2 or "")
    if "nothing to commit" in joined.lower() or "nothing added to commit" in joined.lower():
        return True
    return False


def subagent_exec(root: Path, prompt: str, workdir: Path | None, profile: str | None, model: str | None, ask: bool, full_auto: bool) -> int:
    # If codex is not available, print the prompt and return non-zero
    if not detect_codex(root):
        print("Codex CLI not found. Please install @openai/codex and re-run.")
        print("Prompt:")
        print(prompt)
        return 127
    base = ["codex", "exec", "--cd", str(workdir or root)]
    if profile:
        base.extend(["--profile", profile])
    if model:
        base.extend(["--model", model])
    if ask:
        base.append("--ask-for-approval")
    if full_auto:
        base.append("--full-auto")
    base.append(prompt)
    code, out, err = run(base, cwd=root)
    if out:
        print(out, end="")
    if err:
        print(err, end="")
    return code


def orchestrate_task(root: Path, task_id: str, workdir: Path | None, profile: str | None, model: str | None, ask: bool, full_auto: bool, max_retries: int) -> bool:
    data = load_tasks(root)
    loc = find_task(data, task_id)
    if not loc:
        print(f"Task {task_id} not found", file=sys.stderr)
        return False
    pi, ti = loc
    t = data["phases"][pi]["tasks"][ti]
    title = t["title"]

    # 1) Write failing tests
    test_prompt = (
        f"You are Codex working in TDD mode.\n"
        f"Task: {title}\n\n"
        "Write or update tests ONLY for this task, do not implement the feature yet.\n"
        "Aim for meaningful assertions; keep coverage reasonable.\n"
        "Use Node.js conventions and existing test framework.\n"
        "After writing tests, run `python3 tools/test.py` to verify they FAIL (red).\n"
        "When tests fail as expected, stop.\n"
    )
    print(f"[agent] Writing tests for task {task_id}: {title}")
    rc = subagent_exec(root, test_prompt, workdir, profile, model, ask, full_auto)
    if rc != 0:
        print(f"Subagent returned {rc} while writing tests.")
    # Verify tests fail
    ok = run_tests(root)
    if ok:
        print("Tests passed unexpectedly after test-writing phase. Strengthening tests...")
        # One retry to strengthen tests
        rc2 = subagent_exec(root, test_prompt + "\nStrengthen tests to ensure they fail before implementation.", workdir, profile, model, ask, full_auto)
        ok2 = run_tests(root)
        if ok2:
            print("Tests still pass; proceeding, but this may indicate weak tests.")

    # 2) Implement feature until tests pass
    tries = 0
    while tries <= max_retries:
        impl_prompt = (
            f"You are Codex working in TDD mode.\n"
            f"Task: {title}\n\n"
            "Implement the minimal code required to pass the existing failing tests.\n"
            "Run `python3 tools/test.py` repeatedly until all tests pass.\n"
            "Keep changes focused; avoid unrelated refactors.\n"
        )
        print(f"[agent] Implementing for task {task_id} (attempt {tries+1}/{max_retries+1})")
        rc = subagent_exec(root, impl_prompt, workdir, profile, model, ask, full_auto)
        ok = run_tests(root)
        if ok:
            break
        tries += 1

    if not ok:
        print("Tests still failing after implementation attempts.", file=sys.stderr)
        return False

    # 3) Commit and mark done
    msg = f"feat: {title} [task:{task_id}]"
    committed = git_commit(root, msg)
    if not committed:
        print("Git commit failed; please check repository state.", file=sys.stderr)
        return False
    # Document
    run([sys.executable, str(root / "tools" / "document.py"), "--title", title, "--summary", f"Completed via TDD; commit message: {msg}", "--paths", str(workdir or ".")], cwd=root)
    # Memorize key context at scope
    run([sys.executable, str(root / "tools" / "memorize.py"), "add", "--path", str(workdir or "."), "--note", f"Completed task '{title}' via TDD; commit: {msg}"], cwd=root)
    # Mark done
    data["phases"][pi]["tasks"][ti]["done"] = True
    data["phases"][pi]["tasks"][ti]["completed"] = timestamp()
    save_tasks(root, data)
    print(f"[agent] Task {task_id} complete and committed.")
    return True


def ingest_prd(root: Path, text: str, phase_name: str | None) -> int:
    steps = split_into_steps(text)
    if not steps:
        print("No tasks detected in PRD.", file=sys.stderr)
        return 1
    data = load_tasks(root)
    idx = add_phase(data, phase_name or "PRD Plan")
    set_current_phase(data, idx)
    for s in steps:
        add_task(data, idx, s)
    save_tasks(root, data)
    print(f"Ingested PRD into phase {idx} with {len(steps)} tasks.")
    return 0


def run_phase(root: Path, phase_idx: int, profile: str | None, model: str | None, ask: bool, full_auto: bool, max_retries: int, workdir: Path | None) -> int:
    data = load_tasks(root)
    if phase_idx < 0 or phase_idx >= len(data.get("phases", [])):
        print(f"Phase {phase_idx} not found", file=sys.stderr)
        return 1
    ph = data["phases"][phase_idx]
    for t in ph.get("tasks", []):
        if t.get("done"):
            continue
        task_id = t.get("id")
        ok = orchestrate_task(root, task_id, workdir, profile, model, ask, full_auto, max_retries)
        if not ok:
            print(f"Stopping due to failure on task {task_id}.")
            return 2
    print(f"Phase {phase_idx} completed.")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="End-to-end TDD Agent Orchestrator (PRD -> tasks -> tests -> code -> commit)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_ing = sub.add_parser("ingest-prd", help="Split a PRD/text into an atomic tasklist and create a phase.")
    g = p_ing.add_mutually_exclusive_group(required=True)
    g.add_argument("--file", type=Path, help="PRD file to read")
    g.add_argument("--text", help="PRD text inline")
    p_ing.add_argument("--phase-name", help="Name for the new phase")

    p_runp = sub.add_parser("run-phase", help="Execute all pending tasks in a phase using TDD workflow.")
    p_runp.add_argument("--index", type=int, required=True, help="Phase index to run")
    p_runp.add_argument("--dir", type=Path, help="Focus working directory")
    p_runp.add_argument("--profile", default="gpt5", help="Codex CLI profile (default: gpt5)")
    p_runp.add_argument("-m", "--model", help="Model for Codex CLI")
    p_runp.add_argument("-a", "--ask-for-approval", action="store_true", help="Require approval in Codex CLI")
    p_runp.add_argument("--full-auto", action="store_true", help="Enable full-auto mode")
    p_runp.add_argument("--max-retries", type=int, default=2, help="Max implementation retries per task")

    p_runt = sub.add_parser("run-task", help="Execute a single task by id using TDD workflow.")
    p_runt.add_argument("--id", required=True, help="Task id")
    p_runt.add_argument("--dir", type=Path, help="Focus working directory")
    p_runt.add_argument("--profile", default="gpt5", help="Codex CLI profile (default: gpt5)")
    p_runt.add_argument("-m", "--model", help="Model for Codex CLI")
    p_runt.add_argument("-a", "--ask-for-approval", action="store_true", help="Require approval in Codex CLI")
    p_runt.add_argument("--full-auto", action="store_true", help="Enable full-auto mode")
    p_runt.add_argument("--max-retries", type=int, default=2, help="Max implementation retries")

    args = parser.parse_args(argv)
    root = find_repo_root()

    if args.cmd == "ingest-prd":
        text = args.text if args.text else read_file(args.file)
        return ingest_prd(root, text, args.phase_name)

    if args.cmd == "run-phase":
        return run_phase(root, args.index, args.profile, args.model, args.ask_for_approval, args.full_auto, args.max_retries, args.dir)

    if args.cmd == "run-task":
        ok = orchestrate_task(root, args.id, args.dir, args.profile, args.model, args.ask_for_approval, args.full_auto, args.max_retries)
        return 0 if ok else 2

    return 1


if __name__ == "__main__":
    sys.exit(main())
