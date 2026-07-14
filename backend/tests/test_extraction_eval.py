"""Regression floors for the deterministic extractor (the no-LLM fallback).

The dev set was used to tune the parser's vocabulary; the holdout set never was,
so its floors are the honest measure. Run `python -m scripts.eval_extraction --llm`
to score Claude on the same briefs.
"""

import pytest

from app.ai.project_parser import extract_deterministic
from scripts.eval_extraction import load_briefs, score

FLOORS = {
    "dev": {"skills_f1": 0.95, "budget_accuracy": 0.95, "deadline_accuracy": 0.95,
            "team_size_accuracy": 0.9},
    "holdout": {"skills_f1": 0.9, "budget_accuracy": 0.9, "deadline_accuracy": 0.9,
                "team_size_accuracy": 0.85},
}


@pytest.mark.parametrize("brief_set", sorted(FLOORS))
def test_deterministic_extractor_meets_floors(brief_set):
    briefs = load_briefs(brief_set)
    summary = score(briefs, [extract_deterministic(b["text"]) for b in briefs]).summary()
    for metric, floor in FLOORS[brief_set].items():
        assert summary[metric] >= floor, (brief_set, metric, summary)
