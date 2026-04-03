from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from ai_service import rank_flatmates
from matching import MATCH_POOL


app = Flask(__name__)
CORS(app)
FRONTEND_DIR = (Path(__file__).resolve().parent.parent / "frontend").resolve()


@dataclass
class UserProfile:
    id: str
    name: str
    age: int
    region: str
    budget: int
    bio: str
    neighbor_requirements: str
    created_at: str


USERS: dict[str, UserProfile] = {}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


_BUDGET_MIN = 1
_BUDGET_MAX = 9_999_999


def parse_budget(raw: Any) -> tuple[bool, int, str]:
    if raw is None:
        return False, 0, "Missing field: budget"
    if isinstance(raw, bool):
        return False, 0, "Field 'budget' must be a positive integer"
    if isinstance(raw, int):
        if _BUDGET_MIN <= raw <= _BUDGET_MAX:
            return True, raw, ""
        return False, 0, f"Field 'budget' must be between {_BUDGET_MIN} and {_BUDGET_MAX}"
    if isinstance(raw, float):
        if raw.is_integer():
            iv = int(raw)
            if _BUDGET_MIN <= iv <= _BUDGET_MAX:
                return True, iv, ""
        return False, 0, "Field 'budget' must be a positive integer"
    if isinstance(raw, str):
        s = raw.strip().replace(" ", "")
        if not s:
            return False, 0, "Field 'budget' cannot be empty"
        if not s.isdigit():
            return False, 0, "Field 'budget' must be a positive integer"
        v = int(s)
        if _BUDGET_MIN <= v <= _BUDGET_MAX:
            return True, v, ""
        return False, 0, f"Field 'budget' must be between {_BUDGET_MIN} and {_BUDGET_MAX}"
    return False, 0, "Field 'budget' must be a positive integer"


def validate_profile_payload(payload: dict[str, Any]) -> tuple[bool, str]:
    required_fields = ["name", "age", "region", "budget", "bio", "neighbor_requirements"]
    for field in required_fields:
        if field not in payload:
            return False, f"Missing field: {field}"

    ok_b, _, err_b = parse_budget(payload["budget"])
    if not ok_b:
        return False, err_b

    for field in ("name", "region", "bio", "neighbor_requirements"):
        val = payload[field]
        if not isinstance(val, str) or not val.strip():
            return False, f"Field '{field}' cannot be empty"

    try:
        age = int(payload["age"])
    except (TypeError, ValueError):
        return False, "Field 'age' must be an integer"

    return True, ""


def top_matches(user: UserProfile, limit: int | None = None) -> list[dict[str, Any]]:
    cap = len(MATCH_POOL) if limit is None else min(limit, len(MATCH_POOL))
    return rank_flatmates(asdict(user), MATCH_POOL, limit=cap)


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

    _, budget_int, _ = parse_budget(payload["budget"])
    profile = UserProfile(
        id=str(uuid4()),
        name=str(payload["name"]).strip(),
        age=int(payload["age"]),
        region=str(payload["region"]).strip(),
        budget=budget_int,
        bio=str(payload["bio"]).strip(),
        neighbor_requirements=str(payload["neighbor_requirements"]).strip(),
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
    return jsonify({"profile_id": user.id, "matches": top_matches(user)})


@app.post("/api/search")
def create_profile_and_match() -> Any:
    payload = request.get_json(silent=True) or {}
    valid, error = validate_profile_payload(payload)
    if not valid:
        return jsonify({"error": error}), 400

    _, budget_int, _ = parse_budget(payload["budget"])
    profile = UserProfile(
        id=str(uuid4()),
        name=str(payload["name"]).strip(),
        age=int(payload["age"]),
        region=str(payload["region"]).strip(),
        budget=budget_int,
        bio=str(payload["bio"]).strip(),
        neighbor_requirements=str(payload["neighbor_requirements"]).strip(),
        created_at=now_iso(),
    )
    USERS[profile.id] = profile
    return jsonify({"profile": asdict(profile), "matches": top_matches(profile)}), 201


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
