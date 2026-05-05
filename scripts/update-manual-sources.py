#!/usr/bin/env python3
from __future__ import annotations

import shlex
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PYTHON_CANDIDATES = [
    Path(sys.executable),
    Path("/Users/sbc/.pyenv/versions/3.11.6/bin/python3"),
    Path("/opt/homebrew/bin/python3"),
    Path("/usr/local/bin/python3"),
]


@dataclass
class Step:
    label: str
    command: list[str]


def discover_python_with_market_deps() -> str:
    for candidate in PYTHON_CANDIDATES:
        if not candidate.exists():
            continue
        result = subprocess.run(
            [str(candidate), "-c", "import pandas, yfinance"],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if result.returncode == 0:
            return str(candidate)
    raise RuntimeError("Could not find a Python interpreter with pandas and yfinance installed.")


def run(step: Step) -> None:
    print(f"\n[{step.label}]")
    print("cmd:", " ".join(shlex.quote(part) for part in step.command))
    started = time.perf_counter()
    result = subprocess.run(step.command, cwd=ROOT)
    elapsed = time.perf_counter() - started
    if result.returncode != 0:
        raise SystemExit(result.returncode)
    print(f"{step.label}: ok ({elapsed:.1f}s)")


def main() -> int:
    python_bin = discover_python_with_market_deps()
    steps = [
        Step("sp500 · wikipedia constituents snapshot", ["node", "scripts/extract-wikipedia.mjs"]),
        Step("sp500 · 15y timeseries csv", [python_bin, "scripts/build-timeseries-csv.py"]),
        Step("sp500 · company weights csv", [python_bin, "scripts/build-company-weights-csv.py"]),
        Step("sp500 · market-map returns csv", [python_bin, "scripts/build-returns-csv.py"]),
    ]

    for step in steps:
        run(step)

    print("\nsp500 manual sources updated successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
