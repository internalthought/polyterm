#!/usr/bin/env python3
import argparse
import sys
import uuid
from pathlib import Path

from _utils import find_repo_root, ensure_codex_dir, read_json, write_json, timestamp


TASKS_FILE = ".codex/tasks.json"


def load_tasks(root: Path) -> dict:
    path = root / TASKS_FILE
    data = read_json(path, {"phases": [], "current_phase": None})
    # Normalize
    if "phases" not in data or not isinstance(data["phases"], list):
        data["phases"] = []
    if "current_phase" not in data or (
        data["current_phase"] is not None and not isinstance(data["current_phase"], int)
    ):
        data["current_phase"] = None
    return data


def save_tasks(root: Path, data: dict) -> None:
    write_json(root / TASKS_FILE, data)


def ensure_phase(data: dict, idx: int) -> None:
    while len(data["phases"]) <= idx:
        data["phases"].append({"name": f"Phase {len(data['phases'])+1}", "tasks": [], "created": timestamp()})


def current_phase_index(data: dict) -> int | None:
    return data.get("current_phase")


def set_current_phase(data: dict, idx: int) -> None:
    ensure_phase(data, idx)
    data["current_phase"] = idx


def add_phase(data: dict, name: str | None) -> int:
    idx = len(data["phases"])
    data["phases"].append({"name": name or f"Phase {idx+1}", "tasks": [], "created": timestamp()})
    if data.get("current_phase") is None:
        data["current_phase"] = idx
    return idx


def add_task(data: dict, phase_idx: int, title: str, notes: str | None = None) -> str:
    ensure_phase(data, phase_idx)
    tid = str(uuid.uuid4())[:8]
    task = {"id": tid, "title": title, "done": False, "notes": notes or "", "created": timestamp()}
    data["phases"][phase_idx]["tasks"].append(task)
    return tid


def find_task(data: dict, tid: str) -> tuple[int, int] | None:
    for pi, ph in enumerate(data["phases"]):
        for ti, t in enumerate(ph.get("tasks", [])):
            if t.get("id") == tid:
                return pi, ti
    return None


def cmd_list(data: dict) -> int:
    if not data["phases"]:
        print("No phases or tasks yet. Use 'add-phase' or 'add-task'.")
        return 0
    cur = data.get("current_phase")
    for i, ph in enumerate(data["phases"]):
        mark = "*" if i == cur else "-"
        print(f"{mark} {i}: {ph['name']} (created {ph.get('created','')})")
        for t in ph.get("tasks", []):
            chk = "[x]" if t.get("done") else "[ ]"
            print(f"    {chk} {t['id']}: {t['title']}")
    return 0


def cmd_current(data: dict) -> int:
    idx = data.get("current_phase")
    if idx is None or idx >= len(data["phases"]):
        print("No active phase. Use 'add-phase' or 'set-phase'.")
        return 0
    ph = data["phases"][idx]
    print(f"Active phase: {idx} - {ph['name']}")
    for t in ph.get("tasks", []):
        if not t.get("done"):
            print(f"  [ ] {t['id']}: {t['title']}")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Manage tasklist and phases.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="List all phases and tasks.")
    sub.add_parser("current", help="Show current phase and pending tasks.")

    p_addp = sub.add_parser("add-phase", help="Add a new phase.")
    p_addp.add_argument("--name", help="Phase name")

    p_setp = sub.add_parser("set-phase", help="Set current phase by index.")
    p_setp.add_argument("index", type=int, help="Phase index")

    p_addt = sub.add_parser("add-task", help="Add a task to a phase (defaults to current phase).")
    p_addt.add_argument("title", help="Task title")
    p_addt.add_argument("--phase", type=int, help="Phase index")
    p_addt.add_argument("--notes", help="Task notes")

    p_check = sub.add_parser("check", help="Mark task as done by id.")
    p_check.add_argument("id", help="Task id")

    p_edit = sub.add_parser("edit-task", help="Edit a task title/notes by id.")
    p_edit.add_argument("id", help="Task id")
    p_edit.add_argument("--title", help="New title")
    p_edit.add_argument("--notes", help="New notes")

    p_rm = sub.add_parser("remove-task", help="Remove a task by id.")
    p_rm.add_argument("id", help="Task id")

    args = parser.parse_args(argv)
    root = find_repo_root()
    ensure_codex_dir(root)
    data = load_tasks(root)

    if args.cmd == "list":
        return cmd_list(data)

    if args.cmd == "current":
        return cmd_current(data)

    if args.cmd == "add-phase":
        idx = add_phase(data, args.name)
        set_current_phase(data, idx)
        save_tasks(root, data)
        print(f"Added phase {idx}: {data['phases'][idx]['name']}")
        return 0

    if args.cmd == "set-phase":
        set_current_phase(data, args.index)
        save_tasks(root, data)
        print(f"Set current phase to {args.index}")
        return 0

    if args.cmd == "add-task":
        phase = args.phase if args.phase is not None else data.get("current_phase") or 0
        ensure_phase(data, phase)
        tid = add_task(data, phase, args.title, args.notes)
        save_tasks(root, data)
        print(f"Added task {tid} to phase {phase}")
        return 0

    if args.cmd == "check":
        loc = find_task(data, args.id)
        if not loc:
            print("Task not found", file=sys.stderr)
            return 1
        pi, ti = loc
        data["phases"][pi]["tasks"][ti]["done"] = True
        data["phases"][pi]["tasks"][ti]["completed"] = timestamp()
        save_tasks(root, data)
        print(f"Checked off {args.id}")
        return 0

    if args.cmd == "edit-task":
        loc = find_task(data, args.id)
        if not loc:
            print("Task not found", file=sys.stderr)
            return 1
        pi, ti = loc
        if args.title is not None:
            data["phases"][pi]["tasks"][ti]["title"] = args.title
        if args.notes is not None:
            data["phases"][pi]["tasks"][ti]["notes"] = args.notes
        save_tasks(root, data)
        print(f"Edited task {args.id}")
        return 0

    if args.cmd == "remove-task":
        loc = find_task(data, args.id)
        if not loc:
            print("Task not found", file=sys.stderr)
            return 1
        pi, ti = loc
        data["phases"][pi]["tasks"].pop(ti)
        save_tasks(root, data)
        print(f"Removed task {args.id}")
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())

