from __future__ import annotations

import re
from typing import Any

MATCH_POOL: list[dict[str, Any]] = [
    {
        "id": "m-1",
        "name": "Maria",
        "age": 24,
        "region": "Москва",
        "budget": 35_000,
        "bio": "Love clean space, yoga, movies, and quiet evenings.",
        "interests": ["yoga", "movies", "travel", "cleanliness"],
    },
    {
        "id": "m-2",
        "name": "Ivan",
        "age": 27,
        "region": "Москва",
        "budget": 28_000,
        "bio": "Work in tech, into running, board games, and coffee.",
        "interests": ["running", "board games", "coffee", "tech"],
    },
    {
        "id": "m-3",
        "name": "Alina",
        "age": 22,
        "region": "Москва",
        "budget": 22_000,
        "bio": "Creative routine, design, music, and tidy shared spaces.",
        "interests": ["design", "music", "photo", "cleanliness"],
    },
    {
        "id": "m-4",
        "name": "Maksim",
        "age": 29,
        "region": "Москва",
        "budget": 30_000,
        "bio": "Gym, cooking, and clear boundaries with flatmates.",
        "interests": ["gym", "cooking", "series", "boundaries"],
    },
    {
        "id": "m-5",
        "name": "Ekaterina",
        "age": 26,
        "region": "Москва",
        "budget": 25_000,
        "bio": "Books, pilates, language learning, and stable routines.",
        "interests": ["books", "pilates", "english", "routine"],
    },
    {
        "id": "m-6",
        "name": "Artem",
        "age": 25,
        "region": "Москва",
        "budget": 32_000,
        "bio": "Cycling, movies, and respectful communication.",
        "interests": ["cycling", "movies", "travel", "communication"],
    },
    {
        "id": "m-7",
        "name": "Sofia",
        "age": 23,
        "region": "Москва",
        "budget": 24_000,
        "bio": "Morning runs, healthy food, and calm evenings.",
        "interests": ["running", "cooking", "health", "quiet"],
    },
]


def normalize_text(value: str) -> list[str]:
    return re.findall(r"[a-zA-Zа-яА-ЯёЁ0-9]+", value.lower())


def _region_key(raw: str) -> str:
    t = str(raw).strip().lower()
    if t in ("москва", "moscow", "msk"):
        return "москва"
    return t


def _budget_amount(raw: Any) -> int | None:
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw if raw > 0 else None
    if isinstance(raw, float) and raw.is_integer():
        iv = int(raw)
        return iv if iv > 0 else None
    nums = [int(x) for x in re.findall(r"\d+", str(raw))]
    return max(nums) if nums else None


def _budget_similarity(user_budget: Any, candidate_budget: Any) -> int:
    u = _budget_amount(user_budget)
    c = _budget_amount(candidate_budget)
    if u is not None and c is not None and u > 0 and c > 0:
        ratio = min(u, c) / max(u, c)
        return int(round(10 * ratio))
    ut = set(normalize_text(str(user_budget)))
    ct = set(normalize_text(str(candidate_budget)))
    return min(3, len(ut & ct))


def _candidate_portrait_tokens(candidate: dict[str, Any]) -> set[str]:
    bio_t = set(normalize_text(str(candidate.get("bio", ""))))
    interest_t: set[str] = set()
    for x in candidate.get("interests", []):
        interest_t.update(normalize_text(str(x)))
    budget_t = set(normalize_text(str(candidate.get("budget", ""))))
    return bio_t | interest_t | budget_t


def match_score(user: dict[str, Any], candidate: dict[str, Any]) -> int:
    """Главный акцент: требования к соседу ↔ портрет кандидата; второй — bio ищущего ↔ тот же портрет."""
    score = 0

    user_bio_tokens = set(normalize_text(str(user.get("bio", ""))))
    req_tokens = set(normalize_text(str(user.get("neighbor_requirements", ""))))
    portrait = _candidate_portrait_tokens(candidate)

    if req_tokens:
        score += 8 * len(req_tokens & portrait)
    if user_bio_tokens and portrait:
        score += 5 * len(user_bio_tokens & portrait)

    if _region_key(str(user.get("region", ""))) == _region_key(str(candidate.get("region", ""))):
        score += 2

    try:
        u_age = int(user.get("age", 0))
    except (TypeError, ValueError):
        u_age = 0
    try:
        c_age = int(candidate.get("age", u_age))
    except (TypeError, ValueError):
        c_age = u_age
    if u_age and c_age:
        score += max(0, 6 - abs(u_age - c_age))

    bsim = _budget_similarity(user.get("budget"), candidate.get("budget"))
    score += min(4, (bsim * 2 + 1) // 3)

    return score


def ranked_fallback(user: dict[str, Any], pool: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    scored = [(match_score(user, c), c) for c in pool]
    max_s = max((s for s, _ in scored), default=1)
    rows = []
    for s, c in sorted(scored, key=lambda row: row[0], reverse=True):
        pct = int(round(100 * s / max_s)) if max_s else 0
        pct = max(0, min(100, pct))
        rows.append({**c, "compatibility_percent": pct})
    return rows[:limit]
