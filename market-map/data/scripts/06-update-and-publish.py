#!/usr/bin/env python3
from __future__ import annotations

import shlex
import subprocess
import sys
import time
from datetime import date
from dataclasses import dataclass
from pathlib import Path


MARKET_MAP_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = Path(__file__).resolve().parents[3]
TARGET_PATH = "market-map"


@dataclass
class Step:
    label: str
    command: list[str]
    cwd: Path


def run(step: Step) -> None:
    print(f"\n[{step.label}]")
    print("cwd:", step.cwd)
    print("cmd:", " ".join(shlex.quote(part) for part in step.command))
    started = time.perf_counter()
    result = subprocess.run(step.command, cwd=step.cwd)
    elapsed = time.perf_counter() - started
    if result.returncode != 0:
        raise SystemExit(result.returncode)
    print(f"{step.label}: ok ({elapsed:.1f}s)")


def get_output(command: list[str], cwd: Path) -> str:
    result = subprocess.run(command, cwd=cwd, text=True, capture_output=True)
    if result.returncode != 0:
        if result.stderr:
            print(result.stderr)
        raise SystemExit(result.returncode)
    return result.stdout.strip()


def ensure_on_main() -> None:
    branch = get_output(["git", "branch", "--show-current"], REPO_ROOT)
    if branch != "main":
        raise SystemExit(f"This publish script must run from main. Current branch: {branch}")


def market_map_status() -> str:
    return get_output(["git", "status", "--short", TARGET_PATH], REPO_ROOT)


def main() -> int:
    ensure_on_main()

    steps = [
        Step(
            "market-map · refresh data and build final datasets",
            [sys.executable, "data/scripts/00-update-sources.py"],
            MARKET_MAP_ROOT,
        ),
        Step(
            "market-map · app build sanity check",
            ["npm", "run", "build"],
            MARKET_MAP_ROOT,
        ),
    ]

    for step in steps:
        run(step)

    status_before_stage = market_map_status()
    if not status_before_stage:
        print("\nNo market-map changes detected. Nothing to commit or push.")
        return 0

    commit_message = f"Update market-map data {date.today().isoformat()}"
    git_steps = [
        Step("git · stage market-map only", ["git", "add", TARGET_PATH], REPO_ROOT),
        Step("git · commit market-map changes", ["git", "commit", "-m", commit_message], REPO_ROOT),
        Step("git · push main", ["git", "push", "origin", "main"], REPO_ROOT),
    ]

    for step in git_steps:
        run(step)

    print("\nMarket-map updated and pushed. GitHub Pages will rebuild from main.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
