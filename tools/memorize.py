#!/usr/bin/env python3
import argparse
import os
import sys
from pathlib import Path

from _utils import (
    find_repo_root,
    read_file,
    write_file,
    upsert_memories_section,
    extract_memories,
    timestamp,
    run,
)


def agents_md_paths(root: Path, scope: Path | None) -> list[Path]:
    paths: list[Path] = []
    # 1) Global (~/.codex/AGENTS.md)
    home = Path(os.path.expanduser("~"))
    global_agents = home / ".codex" / "AGENTS.md"
    paths.append(global_agents)
    # 2) Repo root AGENTS.md
    paths.append(root / "AGENTS.md")
    # 3) Scoped path AGENTS.md
    if scope:
        if scope.is_absolute():
            scoped = scope / "AGENTS.md"
        else:
            scoped = (root / scope).resolve() / "AGENTS.md"
        paths.append(scoped)
    return paths


def add_memory(root: Path, scope: Path, note: str) -> Path:
    # Create or update AGENTS.md within the scope path
    if not scope.is_absolute():
        scope = (root / scope).resolve()
    scope.mkdir(parents=True, exist_ok=True)
    target = scope / "AGENTS.md"
    # Gather branch info if any
    code, out, _ = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=root)
    branch = out.strip() if code == 0 else "unknown-branch"
    entry = f"[{timestamp()}] ({branch}) {note}"
    content = read_file(target)
    updated = upsert_memories_section(content, entry)
    write_file(target, updated)
    return target


def read_memories(root: Path, scope: Path | None) -> list[str]:
    items: list[str] = []
    seen = set()
    for p in agents_md_paths(root, scope):
        txt = read_file(p)
        for m in extract_memories(txt):
            if m not in seen:
                items.append(m)
                seen.add(m)
    return items


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Read and add memories in AGENTS.md files by scope.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add", help="Add a memory to a scoped folder's AGENTS.md")
    p_add.add_argument("--path", required=True, type=Path, help="Scoped directory for the memory")
    p_add.add_argument("--note", required=True, help="The memory text to append")

    p_read = sub.add_parser("read", help="Read merged memories (global -> root -> scoped)")
    p_read.add_argument("--path", type=Path, help="Optional scope directory")

    args = parser.parse_args(argv)
    root = find_repo_root()

    if args.cmd == "add":
        target = add_memory(root, args.path, args.note)
        print(f"Added memory to {target}")
        return 0

    if args.cmd == "read":
        items = read_memories(root, args.path)
        for it in items:
            print(f"- {it}")
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())

