#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from _utils import (
    find_repo_root,
    detect_package_manager,
    detect_test_runner,
    package_script_exists,
    run,
    run_package_script,
)


def run_all_tests(root: Path, watch: bool) -> tuple[int, str, str]:
    # Try scripts first
    if package_script_exists(root, "test"):
        extra = ["--watch"] if watch else []
        return run_package_script(root, "test", extra_args=extra if extra else None)

    # Try common runners
    runner = detect_test_runner(root) or "jest"
    if runner == "jest":
        args = ["npx", "jest"]
        if watch:
            args.append("--watch")
        return run(args, cwd=root)
    if runner == "vitest":
        args = ["npx", "vitest", "run"]
        if watch:
            args = ["npx", "vitest"]  # watch mode
        return run(args, cwd=root)
    if runner == "mocha":
        args = ["npx", "mocha"]
        return run(args, cwd=root)
    if runner == "node-test-runner":
        args = ["node", "--test"]
        return run(args, cwd=root)
    return 127, "", f"No test script/runner detected. Please add an npm test script."


def run_category(root: Path, category: str, pattern: str | None, watch: bool) -> tuple[int, str, str]:
    # Map to npm scripts like test:unit, test:integration, test:e2e
    script = f"test:{category}"
    extra = []
    if watch:
        extra.append("--watch")
    if pattern:
        extra.append(pattern)
    if package_script_exists(root, script):
        return run_package_script(root, script, extra_args=extra if extra else None)
    # Fallback to runner flags
    runner = detect_test_runner(root) or "jest"
    if runner == "jest":
        args = ["npx", "jest"]
        if watch:
            args.append("--watch")
        if pattern:
            args.extend(["-t", pattern])
        return run(args, cwd=root)
    if runner == "vitest":
        args = ["npx", "vitest", "run"]
        if watch:
            args = ["npx", "vitest"]
        if pattern:
            args.extend(["-t", pattern])
        return run(args, cwd=root)
    if runner == "mocha":
        args = ["npx", "mocha"]
        if pattern:
            args.extend(["--grep", pattern])
        return run(args, cwd=root)
    if runner == "node-test-runner":
        args = ["node", "--test"]
        return run(args, cwd=root)
    return 127, "", f"No suitable test command for category '{category}'."


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Run tests for the Node.js project.")
    parser.add_argument("--category", choices=["unit", "integration", "e2e"], help="Run a specific test category.")
    parser.add_argument("--pattern", help="Focus tests by name/pattern (mapped to runner flags).")
    parser.add_argument("--watch", action="store_true", help="Run in watch mode if supported.")
    parser.add_argument("--detect", action="store_true", help="Only detect and print runner and package manager.")
    args = parser.parse_args(argv)

    root = find_repo_root()

    if args.detect:
        pm = detect_package_manager(root)
        runner = detect_test_runner(root) or "unknown"
        print(f"package_manager: {pm}")
        print(f"test_runner: {runner}")
        return 0

    if args.category:
        code, out, err = run_category(root, args.category, args.pattern, args.watch)
    else:
        code, out, err = run_all_tests(root, args.watch)

    if out:
        print(out, end="")
    if err:
        print(err, end="")
    return code


if __name__ == "__main__":
    sys.exit(main())

