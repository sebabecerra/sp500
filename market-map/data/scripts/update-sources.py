#!/usr/bin/env python3
from __future__ import annotations

import shlex
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


MARKET_MAP_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = Path(__file__).resolve().parents[3]
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
            cwd=MARKET_MAP_ROOT,
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
    result = subprocess.run(step.command, cwd=MARKET_MAP_ROOT)
    elapsed = time.perf_counter() - started
    if result.returncode != 0:
        raise SystemExit(result.returncode)
    print(f"{step.label}: ok ({elapsed:.1f}s)")


def main() -> int:
    python_bin = discover_python_with_market_deps()
    steps = [
        Step("market-map · wikipedia constituents snapshot", [python_bin, "data/scripts/extract-wikipedia.py"]),
        Step("market-map · 15y timeseries csv", [python_bin, "data/scripts/build-timeseries-csv.py"]),
        Step("market-map · company weights csv", [python_bin, "data/scripts/build-company-weights-csv.py"]),
        Step("market-map · returns csv", [python_bin, "data/scripts/build-returns-csv.py"]),
    ]

    for step in steps:
        run(step)

    print("\nmarket-map sources updated successfully.")
    print(f"Shared sources folder: {REPO_ROOT / 'sources'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
