#!/usr/bin/env python3
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path


def timestamp() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")


def find_repo_root(start: Path | None = None) -> Path:
    """Ascend from start to locate repo root by .git or package.json; fallback to cwd."""
    if start is None:
        start = Path.cwd()
    cur = start.resolve()
    for parent in [cur] + list(cur.parents):
        if (parent / ".git").exists() or (parent / "package.json").exists():
            return parent
    return cur


def ensure_codex_dir(root: Path) -> Path:
    codex = root / ".codex"
    codex.mkdir(exist_ok=True)
    return codex


def run(cmd: list[str], cwd: Path | None = None) -> tuple[int, str, str]:
    """Run a subprocess and capture output."""
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except FileNotFoundError as e:
        return 127, "", f"Executable not found: {cmd[0]}\n{e}"


def read_json(path: Path, default):
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default
    except json.JSONDecodeError:
        return default


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def detect_package_manager(root: Path) -> str:
    if (root / "pnpm-lock.yaml").exists():
        return "pnpm"
    if (root / "yarn.lock").exists():
        return "yarn"
    return "npm"


def read_package_json(root: Path) -> dict:
    return read_json(root / "package.json", {})


def detect_test_runner(root: Path) -> str | None:
    pkg = read_package_json(root)
    scripts = (pkg.get("scripts") or {})
    script_str = " ".join(scripts.values()).lower()
    # Prefer explicit config
    if "jest" in script_str:
        return "jest"
    if "vitest" in script_str:
        return "vitest"
    if "mocha" in script_str:
        return "mocha"
    if re.search(r"node\s+--test", script_str):
        return "node-test-runner"
    # Heuristics based on devDeps
    dev_deps = (pkg.get("devDependencies") or {}) | (pkg.get("dependencies") or {})
    for k in dev_deps.keys():
        kl = k.lower()
        if kl == "jest" or kl.startswith("@jest/"):
            return "jest"
        if kl == "vitest":
            return "vitest"
        if kl == "mocha":
            return "mocha"
    return None


def package_script_exists(root: Path, name: str) -> bool:
    pkg = read_package_json(root)
    scripts = (pkg.get("scripts") or {})
    return name in scripts


def run_package_script(root: Path, script: str, extra_args: list[str] | None = None) -> tuple[int, str, str]:
    mgr = detect_package_manager(root)
    cmd = []
    if mgr == "pnpm":
        cmd = ["pnpm", "run", script]
    elif mgr == "yarn":
        # yarn v1 supports `yarn <script>`; v2+ uses `yarn run <script>`
        cmd = ["yarn", script]
    else:
        cmd = ["npm", "run", script]
    if extra_args:
        cmd.extend(["--", *extra_args])
    return run(cmd, cwd=root)


def safe_append_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(content)


def read_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def write_file(path: Path, data: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(data, encoding="utf-8")


def upsert_memories_section(text: str, entry: str) -> str:
    """Insert or append an entry under a '## Memories' section in AGENTS.md content."""
    if not text.strip():
        return f"## Memories\n\n- {entry}\n"
    lines = text.splitlines()
    out = []
    i = 0
    inserted = False
    while i < len(lines):
        out.append(lines[i])
        if lines[i].strip().lower() == "## memories":
            # Append after this header and any immediate blank lines
            i += 1
            while i < len(lines) and lines[i].strip() == "":
                out.append(lines[i])
                i += 1
            out.append(f"- {entry}")
            inserted = True
            # Copy the rest as-is
            while i < len(lines):
                out.append(lines[i])
                i += 1
            break
        i += 1
    if not inserted:
        # Add a new section at the end
        if out and out[-1].strip() != "":
            out.append("")
        out.append("## Memories")
        out.append("")
        out.append(f"- {entry}")
    return "\n".join(out) + "\n"


def extract_memories(text: str) -> list[str]:
    """Extract bullet lines under the first '## Memories' section."""
    lines = text.splitlines()
    in_mem = False
    items: list[str] = []
    for line in lines:
        if line.strip().lower() == "## memories":
            in_mem = True
            continue
        if in_mem:
            if re.match(r"^## ", line):
                break
            m = re.match(r"^\s*[-*]\s+(.*)$", line)
            if m:
                items.append(m.group(1).strip())
    return items


