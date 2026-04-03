from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4
import re

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS


app = Flask(__name__)
CORS(app)
FRONTEND_DIR = (Path(__file__).resolve().parent.parent / "frontend").resolve()


@dataclass
class UserProfile:
    id: str
    name: str
    age: int
    region: str
    budget: str
    bio: str
    created_at: str


USERS: dict[str, UserProfile] = {}

# MVP mock pool. No DB, no AI service calls.
MATCH_POOL: list[dict[str, Any]] = [
    {
        "id": "m-1",
        "name": "Maria",
        "age": 24,
        "region": "Moscow",
        "budget": "up to 35000",
        "bio": "Love clean space, yoga, movies, and quiet evenings.",
        "interests": ["yoga", "movies", "travel", "cleanliness"],
    },
    {
        "id": "m-2",
        "name": "Ivan",
        "age": 27,
        "region": "Saint Petersburg",
        "budget": "up to 28000",
        "bio": "Work in tech, into running, board games, and coffee.",
        "interests": ["running", "board games", "coffee", "tech"],
    },
    {
        "id": "m-3",
        "name": "Alina",
        "age": 22,
        "region": "Kazan",
        "budget": "up to 22000",
        "bio": "Creative routine, design, music, and tidy shared spaces.",
        "interests": ["design", "music", "photo", "cleanliness"],
    },
    {
        "id": "m-4",
        "name": "Maksim",
        "age": 29,
        "region": "Yekaterinburg",
        "budget": "up to 30000",
        "bio": "Gym, cooking, and clear boundaries with flatmates.",
        "interests": ["gym", "cooking", "series", "boundaries"],
    },
    {
        "id": "m-5",
        "name": "Ekaterina",
        "age": 26,
        "region": "Novosibirsk",
        "budget": "up to 25000",
        "bio": "Books, pilates, language learning, and stable routines.",
        "interests": ["books", "pilates", "english", "routine"],
    },
    {
        "id": "m-6",
        "name": "Artem",
        "age": 25,
        "region": "Moscow",
        "budget": "up to 32000",
        "bio": "Cycling, movies, and respectful communication.",
        "interests": ["cycling", "movies", "travel", "communication"],
    },
    {
        "id": "m-7",
        "name": "Sofia",
        "age": 23,
        "region": "Kazan",
        "budget": "up to 24000",
        "bio": "Morning runs, healthy food, and calm evenings.",
        "interests": ["running", "cooking", "health", "quiet"],
    },
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_text(value: str) -> list[str]:
    return re.findall(r"[a-zA-Zа-яА-ЯёЁ0-9]+", value.lower())


def validate_profile_payload(payload: dict[str, Any]) -> tuple[bool, str]:
    required_fields = ["name", "age", "region", "budget", "bio"]
    for field in required_fields:
        if field not in payload:
            return False, f"Missing field: {field}"
        if isinstance(payload[field], str) and not payload[field].strip():
            return False, f"Field '{field}' cannot be empty"

    try:
        age = int(payload["age"])
    except (TypeError, ValueError):
        return False, "Field 'age' must be an integer"

    if age < 18 or age > 99:
        return False, "Field 'age' must be between 18 and 99"

    return True, ""


def match_score(user: UserProfile, candidate: dict[str, Any]) -> int:
    score = 0

    if user.region.strip().lower() == str(candidate.get("region", "")).strip().lower():
        score += 3

    user_tokens = set(normalize_text(user.bio))
    candidate_tokens = set(normalize_text(candidate.get("bio", "")))
    interests = {str(x).lower() for x in candidate.get("interests", [])}
    token_overlap = len((user_tokens & candidate_tokens) | (user_tokens & interests))
    score += token_overlap

    age_gap = abs(user.age - int(candidate.get("age", user.age)))
    if age_gap <= 2:
        score += 2
    elif age_gap <= 5:
        score += 1

    return score


def top_matches(user: UserProfile, limit: int = 5) -> list[dict[str, Any]]:
    scored = []
    for candidate in MATCH_POOL:
        scored.append((match_score(user, candidate), candidate))

    scored.sort(key=lambda row: row[0], reverse=True)
    return [{**candidate, "score": score} for score, candidate in scored[:limit]]


@app.get("/api/health")
def health() -> Any:
    return jsonify({"ok": True, "users_in_memory": len(USERS)})


@app.get("/")
def root() -> Any:
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/<path:path>")
def frontend_assets(path: str) -> Any:
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404

    asset_path = FRONTEND_DIR / path
    if asset_path.is_file():
        return send_from_directory(FRONTEND_DIR, path)

    return send_from_directory(FRONTEND_DIR, "index.html")


@app.post("/api/profiles")
def create_profile() -> Any:
    payload = request.get_json(silent=True) or {}
    valid, error = validate_profile_payload(payload)
    if not valid:
        return jsonify({"error": error}), 400

    profile = UserProfile(
        id=str(uuid4()),
        name=str(payload["name"]).strip(),
        age=int(payload["age"]),
        region=str(payload["region"]).strip(),
        budget=str(payload["budget"]).strip(),
        bio=str(payload["bio"]).strip(),
        created_at=now_iso(),
    )
    USERS[profile.id] = profile
    return jsonify(asdict(profile)), 201


@app.post("/api/matches")
def get_matches() -> Any:
    payload = request.get_json(silent=True) or {}
    profile_id = payload.get("profile_id")
    if not profile_id or profile_id not in USERS:
        return jsonify({"error": "Unknown profile_id"}), 404

    user = USERS[profile_id]
    return jsonify({"profile_id": user.id, "matches": top_matches(user, limit=5)})


@app.post("/api/search")
def create_profile_and_match() -> Any:
    payload = request.get_json(silent=True) or {}
    valid, error = validate_profile_payload(payload)
    if not valid:
        return jsonify({"error": error}), 400

    profile = UserProfile(
        id=str(uuid4()),
        name=str(payload["name"]).strip(),
        age=int(payload["age"]),
        region=str(payload["region"]).strip(),
        budget=str(payload["budget"]).strip(),
        bio=str(payload["bio"]).strip(),
        created_at=now_iso(),
    )
    USERS[profile.id] = profile
    return jsonify({"profile": asdict(profile), "matches": top_matches(profile, limit=5)}), 201


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
