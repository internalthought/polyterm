#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from _utils import find_repo_root, timestamp, safe_append_file


def append_log(log_path: Path, title: str, summary: str) -> None:
    header = f"## {title}\n\n"
    entry = f"- {timestamp()}: {summary}\n\n"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    if not log_path.exists():
        safe_append_file(log_path, header + entry)
    else:
        safe_append_file(log_path, header + entry)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Append documentation about a finished task to LOG.md in given folders.")
    parser.add_argument("--title", required=True, help="Entry title")
    parser.add_argument("--summary", required=True, help="Summary of work done and behavior changes")
    parser.add_argument("--paths", nargs="*", default=["."], help="Directories to update (default: current)")
    parser.add_argument("--all-dirs", action="store_true", help="Append to every directory containing an AGENTS.md as well.")
    args = parser.parse_args(argv)

    root = find_repo_root()
    paths = [root / p for p in args.paths]

    if args.all_dirs:
        for p in root.rglob("AGENTS.md"):
            if p.is_file():
                paths.append(p.parent)

    # De-duplicate
    seen: set[Path] = set()
    uniq_paths = []
    for p in paths:
        parent = p.resolve()
        if parent not in seen:
            uniq_paths.append(parent)
            seen.add(parent)

    for d in uniq_paths:
        append_log(d / "LOG.md", args.title, args.summary)
        print(f"Updated {d / 'LOG.md'}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

