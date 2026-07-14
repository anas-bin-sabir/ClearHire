"""Score requirement extraction against the labelled briefs.

Usage (from backend/):
  python -m scripts.eval_extraction            # deterministic parser, offline
  python -m scripts.eval_extraction --llm      # Claude (needs ANTHROPIC_API_KEY; ~30 calls)
  python -m scripts.eval_extraction --verbose  # per-brief misses
  python -m scripts.eval_extraction --set holdout  # briefs never used for tuning

Skills are grounded with the taxonomy's exact/alias lookup only (no database), so
the scores measure the extractor rather than semantic grounding.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.ai import llm  # noqa: E402
from app.ai.project_parser import ParsedBrief, extract_deterministic, extract_with_llm  # noqa: E402
from app.ai.skill_taxonomy import canonicalize  # noqa: E402

FIXTURES = {
    # Development set: the deterministic parser's vocabulary was tuned against it.
    "dev": BACKEND_ROOT / "tests" / "fixtures" / "briefs.jsonl",
    # Held out: written before measuring and never used for tuning.
    "holdout": BACKEND_ROOT / "tests" / "fixtures" / "briefs_holdout.jsonl",
}


@dataclass
class Scores:
    tp: int = 0
    fp: int = 0
    fn: int = 0
    importance_ok: int = 0
    counts: dict[str, list[int]] = field(
        default_factory=lambda: {k: [0, 0] for k in ("budget", "budget_type", "deadline", "team_size")}
    )
    misses: list[str] = field(default_factory=list)

    def check(self, name: str, ok: bool, brief_id: int, detail: str) -> None:
        self.counts[name][0] += int(ok)
        self.counts[name][1] += 1
        if not ok:
            self.misses.append(f"#{brief_id} {name}: {detail}")

    @property
    def precision(self) -> float:
        return self.tp / (self.tp + self.fp) if self.tp + self.fp else 1.0

    @property
    def recall(self) -> float:
        return self.tp / (self.tp + self.fn) if self.tp + self.fn else 1.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if p + r else 0.0

    def accuracy(self, name: str) -> float:
        ok, total = self.counts[name]
        return ok / total if total else 1.0

    def summary(self) -> dict[str, float]:
        return {
            "skills_precision": round(self.precision, 3),
            "skills_recall": round(self.recall, 3),
            "skills_f1": round(self.f1, 3),
            "importance_accuracy": round(self.importance_ok / self.tp, 3) if self.tp else 1.0,
            **{f"{name}_accuracy": round(self.accuracy(name), 3) for name in self.counts},
        }


def load_briefs(name: str = "dev") -> list[dict]:
    path = FIXTURES[name]
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def score(briefs: list[dict], predictions: list[ParsedBrief]) -> Scores:
    scores = Scores()
    for brief, parsed in zip(briefs, predictions):
        gold = {s: "must" for s in brief["skills"]} | {s: "nice" for s in brief["nice"]}
        predicted: dict[str, str] = {}
        for skill in parsed.skills:
            name = canonicalize(skill.name)
            if predicted.get(name) != "must":
                predicted[name] = skill.importance
        hits = gold.keys() & predicted.keys()
        scores.tp += len(hits)
        scores.fp += len(predicted.keys() - gold.keys())
        scores.fn += len(gold.keys() - predicted.keys())
        scores.importance_ok += sum(gold[s] == predicted[s] for s in hits)
        if predicted.keys() != gold.keys():
            scores.misses.append(
                f"#{brief['id']} skills: missing {sorted(gold.keys() - predicted.keys())}, "
                f"extra {sorted(predicted.keys() - gold.keys())}"
            )

        budget = parsed.budget_amount
        gold_budget = brief["budget"]
        budget_ok = (budget is None and gold_budget is None) or (
            budget is not None
            and gold_budget is not None
            and abs(budget - gold_budget) <= 0.01 * gold_budget
        )
        scores.check("budget", budget_ok, brief["id"], f"{budget} != {gold_budget}")
        if gold_budget is not None:
            scores.check(
                "budget_type",
                parsed.budget_type == brief["budget_type"],
                brief["id"],
                f"{parsed.budget_type} != {brief['budget_type']}",
            )
        scores.check(
            "deadline",
            parsed.deadline_days == brief["deadline_days"],
            brief["id"],
            f"{parsed.deadline_days} != {brief['deadline_days']}",
        )
        scores.check(
            "team_size",
            (parsed.team_size or 1) == brief["team_size"],
            brief["id"],
            f"{parsed.team_size} != {brief['team_size']}",
        )
    return scores


async def predict_llm(briefs: list[dict]) -> list[ParsedBrief]:
    results = []
    for brief in briefs:
        try:
            results.append((await extract_with_llm(brief["text"])).value)
        except llm.LLMUnavailable as exc:
            print(f"#{brief['id']}: Claude unavailable ({exc}); using deterministic parser")
            results.append(extract_deterministic(brief["text"]))
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--llm", action="store_true", help="Evaluate the Claude extractor")
    parser.add_argument("--verbose", action="store_true", help="Print per-brief misses")
    parser.add_argument("--set", choices=sorted(FIXTURES), default="dev", dest="brief_set")
    args = parser.parse_args()

    briefs = load_briefs(args.brief_set)
    if args.llm:
        if not llm.is_configured():
            sys.exit("ANTHROPIC_API_KEY is not set")
        predictions = asyncio.run(predict_llm(briefs))
    else:
        predictions = [extract_deterministic(b["text"]) for b in briefs]

    scores = score(briefs, predictions)
    print(json.dumps({"extractor": "claude" if args.llm else "deterministic",
                      "set": args.brief_set, "briefs": len(briefs), **scores.summary()}, indent=2))
    if args.verbose:
        print("\n".join(scores.misses) or "no misses")


if __name__ == "__main__":
    main()
