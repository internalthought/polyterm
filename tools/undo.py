#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from _utils import find_repo_root, run


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Undo last working copy changes using Git. Defaults to restoring modified files only.")
    parser.add_argument("--include-untracked", action="store_true", help="Also remove untracked files/directories (git clean -fd).")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen without making changes.")
    args = parser.parse_args(argv)

    root = find_repo_root()
    # Ensure this is a git repo
    code, _, _ = run(["git", "rev-parse", "--is-inside-work-tree"], cwd=root)
    if code != 0:
        print("Not a Git repository; nothing to undo.")
        return 1

    if args.dry_run:
        print("Would run: git restore --staged . && git checkout -- .")
        if args.include_untracked:
            print("Would run: git clean -fd")
        return 0

    code1, out1, err1 = run(["git", "restore", "--staged", "."], cwd=root)
    code2, out2, err2 = run(["git", "checkout", "--", "."], cwd=root)
    out = (out1 or "") + (out2 or "")
    err = (err1 or "") + (err2 or "")
    rc = max(code1, code2)
    if args.include_untracked:
        code3, out3, err3 = run(["git", "clean", "-fd"], cwd=root)
        out += out3 or ""
        err += err3 or ""
        rc = max(rc, code3)
    if out:
        print(out, end="")
    if err:
        print(err, end="")
    return rc


if __name__ == "__main__":
    sys.exit(main())

