from __future__ import annotations

import json
import os
import re
from typing import Any

from matching import ranked_fallback


def _extract_json_object(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if not raw:
        return {}
    if raw.startswith("```"):
        lines = raw.split("\n")
        if lines and lines[0].strip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw = "\n".join(lines).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            return json.loads(match.group(0))
        return {}


def _build_seeker_minimal(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": user.get("name"),
        "age": user.get("age"),
        "region": user.get("region"),
        "budget": user.get("budget"),
        "bio": user.get("bio"),
        "neighbor_requirements": user.get("neighbor_requirements"),
    }


def _prompt(seeker: dict[str, Any], candidates: list[dict[str, Any]]) -> str:
    payload = {
        "seeker": seeker,
        "candidates": [
            {
                "id": c.get("id"),
                "name": c.get("name"),
                "age": c.get("age"),
                "region": c.get("region"),
                "budget": c.get("budget"),
                "bio": c.get("bio"),
                "interests": c.get("interests", []),
            }
            for c in candidates
        ],
    }
    return (
        "Ты эксперт по подбору соседей для совместной аренды жилья.\n\n"
        "ГЛАВНЫЙ критерий оценки совместимости (дай этому наибольший вес при выставлении процентов):\n"
        "насколько требования ищущего в поле «neighbor_requirements» соответствуют тому, как кандидат описывает СЕБЯ — "
        "поля кандидата «bio», «interests», «budget» и общий образ жизни из этих текстов. "
        "Если кандидат явно не подходит под оговорённые требования (тишина/вечеринки, чистота, график, отношение к быту) — "
        "ставь заметно ниже процент.\n\n"
        "ВТОРОЙ по силе сигнал: насколько «bio» ищущего согласуется с общей информацией о кандидате (bio + интересы + бюджет): "
        "похожие ценности, ритм, хобби, бытовые ожидания.\n\n"
        "Дополнительно (слабее, для разрыва ничьих): близость возраста, один регион, сопоставимость бюджета. "
        "Не завышай процент, если главные два блока плохо бьются.\n\n"
        "Входные данные (JSON):\n"
        f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n\n"
        "Верни СТРОГО один JSON-объект без пояснений, без Markdown и без обрамления в ```:\n"
        '{"rankings":[{"id":"<ровно id из candidates>","compatibility_percent":<целое число 0-100>}, ...]}\n\n'
        "Требования:\n"
        "- Включи ровно всех кандидатов из входного списка, по одному объекту на id.\n"
        "- Поле id должно совпадать с id из candidates, не выдумывай новые id.\n"
        "- compatibility_percent — целое от 0 до 100; больше число = лучше совпадение по совместному проживанию.\n"
        "- Отсортируй массив rankings по убыванию compatibility_percent (самый подходящий первый).\n"
    )


def _merge_rankings(
    pool_by_id: dict[str, dict[str, Any]],
    rankings: list[dict[str, Any]],
    seeker: dict[str, Any],
    pool: list[dict[str, Any]],
    limit: int,
) -> list[dict[str, Any]]:
    pct_by_id: dict[str, int] = {}
    for row in rankings:
        cid = str(row.get("id", "")).strip()
        if cid not in pool_by_id:
            continue
        try:
            pct = int(row.get("compatibility_percent", row.get("percent", 0)))
        except (TypeError, ValueError):
            pct = 0
        pct = max(0, min(100, pct))
        pct_by_id[cid] = max(pct_by_id.get(cid, 0), pct)

    missing = [c for c in pool if c.get("id") not in pct_by_id]
    if missing:
        fill = ranked_fallback(seeker, missing, limit=len(missing))
        for item in fill:
            cid = str(item.get("id", ""))
            if cid:
                pct_by_id[cid] = int(item.get("compatibility_percent", 0))

    merged: list[dict[str, Any]] = []
    for c in pool:
        cid = str(c.get("id", ""))
        pct = pct_by_id.get(cid)
        if pct is None:
            pct = ranked_fallback(seeker, [c], limit=1)[0].get("compatibility_percent", 0)
        merged.append({**c, "compatibility_percent": int(pct)})

    merged.sort(key=lambda row: row.get("compatibility_percent", 0), reverse=True)
    return merged[:limit]


def rank_flatmates(
    seeker: dict[str, Any],
    candidates: list[dict[str, Any]],
    limit: int = 5,
) -> list[dict[str, Any]]:
    token = os.getenv("YCLOUD_AUTH_TOKEN")
    folder_id = os.getenv("YCLOUD_FOLDER_ID")
    seeker_min = _build_seeker_minimal(seeker)
    pool_by_id = {str(c["id"]): c for c in candidates if c.get("id")}

    if not token or not folder_id:
        return ranked_fallback(seeker_min, candidates, limit)

    try:
        from yandex_cloud_ml_sdk import YCloudML
    except Exception:
        return ranked_fallback(seeker_min, candidates, limit)

    prompt = _prompt(seeker_min, candidates)
    try:
        sdk = YCloudML(folder_id=folder_id, auth=token)
        model = sdk.models.completions("yandexgpt-lite")
        model.configure(temperature=0.25, max_tokens=1200)
        result = model.run(
            [
                {
                    "role": "system",
                    "text": (
                        "Ты возвращаешь только валидный JSON по заданной схеме, без текста до или после. "
                        "Ответ на русском контексте допустим только внутри строк JSON, но ключи — на английском как в примере."
                    ),
                },
                {"role": "user", "text": prompt},
            ],
        )
        text = (result.text or "").strip()
        data = _extract_json_object(text)
        rankings = data.get("rankings")
        if not isinstance(rankings, list) or not rankings:
            return ranked_fallback(seeker_min, candidates, limit)
        return _merge_rankings(pool_by_id, rankings, seeker_min, candidates, limit)
    except Exception:
        return ranked_fallback(seeker_min, candidates, limit)
