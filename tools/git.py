#!/usr/bin/env python3
import argparse
import os
import sys
from pathlib import Path

from _utils import find_repo_root, run


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Run arbitrary git commands in the repo root and return output.")
    parser.add_argument("git_args", nargs=argparse.REMAINDER, help="Arguments passed to git after '--'. Example: tools/git.py -- status -sb")
    args = parser.parse_args(argv)

    # Allow `tools/git.py status -sb` without '--'
    git_args = args.git_args
    if git_args and git_args[0] == "--":
        git_args = git_args[1:]
    if not git_args:
        print("Usage: tools/git.py -- <git-args>\nExample: tools/git.py -- status -sb", file=sys.stderr)
        return 2

    root = find_repo_root()
    code, out, err = run(["git", *git_args], cwd=root)
    if out:
        print(out, end="")
    if err:
        print(err, end="", file=sys.stderr)
    return code


if __name__ == "__main__":
    sys.exit(main())

