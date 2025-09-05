#!/usr/bin/env python3
import argparse
import shutil
import sys
from pathlib import Path

from _utils import find_repo_root, ensure_codex_dir, timestamp, run, read_file
from task import load_tasks


def make_summary(root: Path, reason: str | None) -> str:
    # Git status
    code, out, err = run(["git", "status", "-sb"], cwd=root)
    git_status = out if code == 0 else err

    # Tasks snapshot
    data = load_tasks(root)
    cur = data.get("current_phase")
    lines = []
    lines.append(f"# Reset Summary - {timestamp()}\n")
    if reason:
        lines.append(f"Reason: {reason}\n")
    lines.append("## Git Status\n")
    lines.append("```\n" + (git_status or "(no status)") + "```\n")
    lines.append("## Tasks\n")
    if not data.get("phases"):
        lines.append("(no tasks)\n")
    else:
        for i, ph in enumerate(data["phases"]):
            mark = "*" if cur == i else "-"
            lines.append(f"{mark} {i}: {ph['name']}")
            for t in ph.get("tasks", []):
                chk = "[x]" if t.get("done") else "[ ]"
                lines.append(f"  {chk} {t['id']}: {t['title']}")
        lines.append("")
    return "\n".join(lines)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Create a reset summary and optionally start a Codex session with it.")
    parser.add_argument("--reason", help="Why resetting context")
    parser.add_argument("--spawn", action="store_true", help="Open interactive Codex TUI with the summary as the initial prompt.")
    parser.add_argument("--exec", dest="exec_mode", action="store_true", help="Run non-interactive 'codex exec' with the summary as the prompt.")
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
    summary = make_summary(root, args.reason)
    out_path = codex_dir / f"reset_summary_{timestamp().replace(':','-').replace(' ','_')}.md"
    out_path.write_text(summary, encoding="utf-8")
    print(f"Reset summary saved to {out_path}")

    if not args.spawn and not args.exec_mode:
        return 0

    # Build initial prompt referencing the summary
    prompt = (
        "Resetting context. Please read the following reset summary and continue the current task using TDD.\n\n"
        f"Reset summary path: {out_path}\n\n"
        f"--- Reset Summary ---\n{read_file(out_path)}\n"
        "\nGoals:\n"
        "- Recreate the plan, write failing tests first, then implement.\n"
        "- Use tools/test.py to run tests and keep commits atomic.\n"
    )

    # Ensure Codex CLI is available
    code, _, _ = run(["which", "codex"], cwd=root)
    if code != 0:
        print("Codex CLI not found in PATH. Launch manually using one of:")
        print(f"  codex --cd {root} \"{prompt}\"")
        print(f"  codex exec --cd {root} \"{prompt}\"")
        return 0

    base = ["codex"]
    if args.exec_mode:
        base.append("exec")
    base.extend(["--cd", str(root)])
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
