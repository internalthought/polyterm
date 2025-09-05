#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from _utils import find_repo_root
from task import load_tasks, save_tasks, add_phase, add_task, set_current_phase


def split_into_steps(text: str) -> list[str]:
    lines = [l.strip(" \t-•*#.") for l in text.splitlines()]
    steps = [l for l in lines if l]
    if steps:
        return steps
    # fallback: split by punctuation
    parts = [p.strip() for p in text.replace(";", ".").split(".")]
    return [p for p in parts if p]


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Create a plan by splitting a task into smaller tasks and adding them to tasks.json")
    parser.add_argument("--task", help="Task description or bullets (newline-separated)")
    parser.add_argument("--from-file", type=Path, help="Read task description from file")
    parser.add_argument("--phase-name", help="Name for a new phase (will be created)")
    args = parser.parse_args(argv)

    if not args.task and not args.from_file:
        print("Provide --task or --from-file", file=sys.stderr)
        return 2

    text = args.task or args.from_file.read_text(encoding="utf-8")
    steps = split_into_steps(text)
    if not steps:
        print("No steps detected", file=sys.stderr)
        return 1

    root = find_repo_root()
    data = load_tasks(root)
    idx = add_phase(data, args.phase_name or "Planned Work")
    set_current_phase(data, idx)
    for s in steps:
        add_task(data, idx, s)
    save_tasks(root, data)
    print(f"Added phase {idx} with {len(steps)} tasks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

