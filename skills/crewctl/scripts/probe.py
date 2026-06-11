#!/usr/bin/env python3
"""Inspect a crewctl-enabled repository and print a compact JSON summary."""

from __future__ import annotations

import json
import os
import platform
import subprocess
import sys
from pathlib import Path


def run_command(cwd: Path, args: list[str]) -> dict:
    try:
        completed = subprocess.run(
            args,
            cwd=cwd,
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError as error:
        return {"ok": False, "error": str(error), "stdout": "", "stderr": ""}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Command timed out.", "stdout": "", "stderr": ""}

    return {
        "ok": completed.returncode == 0,
        "returncode": completed.returncode,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
    }


def npm_args(script: str) -> list[str]:
    npm = "npm.cmd" if platform.system().lower() == "windows" else "npm"
    return [npm, "run", script, "--silent"]


def load_json_output(result: dict) -> object | None:
    if not result.get("ok"):
        return None
    try:
        return json.loads(result.get("stdout") or "{}")
    except json.JSONDecodeError:
        return None


def main() -> int:
    cwd = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
    state_path = cwd / ".agent" / "workstate.json"
    config_path = cwd / "crewctl.config.json"

    status_result = run_command(cwd, npm_args("agent:status")) if state_path.exists() else None
    adapter_result = run_command(cwd, npm_args("agent:runtime-adapter")) if config_path.exists() else None

    payload = {
        "cwd": str(cwd),
        "platform": platform.system(),
        "crewctlEnabled": state_path.exists() and config_path.exists(),
        "files": {
            "state": state_path.exists(),
            "config": config_path.exists(),
            "package": (cwd / "package.json").exists(),
        },
        "status": load_json_output(status_result) if status_result else None,
        "adapter": load_json_output(adapter_result) if adapter_result else None,
        "errors": [
            item
            for item in [
                status_result if status_result and not status_result.get("ok") else None,
                adapter_result if adapter_result and not adapter_result.get("ok") else None,
            ]
            if item
        ],
    }

    print(json.dumps(payload, indent=2))
    return 0 if payload["crewctlEnabled"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
