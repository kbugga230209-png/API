"""Read the generated food catalog (the single source of nutrition truth)."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = REPO_ROOT / "packages" / "foods" / "generated" / "catalog.compact.json"


@dataclass(frozen=True)
class CatalogFood:
    slug: str
    name: str
    category: str
    cuisine: str
    default_variant: str
    variants: tuple[str, ...]


def load_catalog(path: Path | None = None) -> dict[str, CatalogFood]:
    source = path or CATALOG_PATH
    raw = json.loads(Path(source).read_text(encoding="utf-8"))
    foods: dict[str, CatalogFood] = {}
    for item in raw["foods"]:
        foods[item["slug"]] = CatalogFood(
            slug=item["slug"],
            name=item["name"],
            category=item["category"],
            cuisine=item["cuisine"],
            default_variant=item["defaultVariant"],
            variants=tuple(v["slug"] for v in item["variants"]),
        )
    return foods


def catalog_stats(path: Path | None = None) -> dict[str, int]:
    raw = json.loads(Path(path or CATALOG_PATH).read_text(encoding="utf-8"))
    return dict(raw["stats"])
