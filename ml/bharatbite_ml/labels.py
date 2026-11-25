"""Label set for recognition, and its mapping onto the nutrition catalog.

A classifier cannot be useful if its classes do not resolve to a row the diary
can log. This module is the contract between the two: every class carries the
catalog slug it maps to, the preparation variant that should be preselected, and
the classes it is routinely confused with (so the UI can ask instead of guess).
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .catalog import CatalogFood, load_catalog

DEFAULT_LABELS_PATH = Path(__file__).resolve().parents[1] / "labels.json"


@dataclass(frozen=True)
class LabelClass:
    label: str
    display_name: str
    catalog_slug: str
    variant: str = "homemade"
    confusables: tuple[str, ...] = field(default=())
    aliases: tuple[str, ...] = field(default=())


@dataclass(frozen=True)
class LabelReport:
    total: int
    mapped: int
    missing_slugs: tuple[str, ...]
    missing_variants: tuple[tuple[str, str], ...]
    duplicate_slugs: tuple[str, ...]
    unmapped_catalog_foods: tuple[str, ...]
    confusable_links_missing: tuple[tuple[str, str], ...]

    @property
    def ok(self) -> bool:
        return not (self.missing_slugs or self.missing_variants or self.duplicate_slugs or self.confusable_links_missing)

    def summary(self) -> str:
        return (
            f"{self.mapped}/{self.total} classes map to a catalog food; "
            f"{len(self.missing_slugs)} missing slugs, "
            f"{len(self.missing_variants)} missing variants, "
            f"{len(self.duplicate_slugs)} duplicate mappings, "
            f"{len(self.confusable_links_missing)} dangling confusable links"
        )


def load_labels(path: Path | None = None) -> list[LabelClass]:
    raw = json.loads(Path(path or DEFAULT_LABELS_PATH).read_text(encoding="utf-8"))
    classes = []
    for item in raw["classes"]:
        classes.append(
            LabelClass(
                label=item["label"],
                display_name=item.get("displayName", item["label"]),
                catalog_slug=item["catalogSlug"],
                variant=item.get("variant", "homemade"),
                confusables=tuple(item.get("confusables", ())),
                aliases=tuple(item.get("aliases", ())),
            )
        )
    return classes


def validate_labels(
    classes: list[LabelClass], catalog: dict[str, CatalogFood] | None = None
) -> LabelReport:
    foods = catalog if catalog is not None else load_catalog()
    labels = {c.label for c in classes}
    missing_slugs: list[str] = []
    missing_variants: list[tuple[str, str]] = []
    duplicate_slugs: list[str] = []
    confusable_links_missing: list[tuple[str, str]] = []
    seen: dict[str, str] = {}

    for cls in classes:
        food = foods.get(cls.catalog_slug)
        if food is None:
            missing_slugs.append(cls.catalog_slug)
            continue
        if cls.variant not in food.variants:
            missing_variants.append((cls.label, cls.variant))
        if cls.catalog_slug in seen:
            duplicate_slugs.append(cls.catalog_slug)
        seen[cls.catalog_slug] = cls.label
        for other in cls.confusables:
            if other not in labels:
                confusable_links_missing.append((cls.label, other))

    mapped = len({c.catalog_slug for c in classes if c.catalog_slug in foods})
    unmapped = tuple(sorted(slug for slug in foods if slug not in seen))
    return LabelReport(
        total=len(classes),
        mapped=mapped,
        missing_slugs=tuple(missing_slugs),
        missing_variants=tuple(missing_variants),
        duplicate_slugs=tuple(duplicate_slugs),
        unmapped_catalog_foods=unmapped,
        confusable_links_missing=tuple(confusable_links_missing),
    )


def label_to_slug_map(classes: list[LabelClass]) -> dict[str, str]:
    return {c.label: c.catalog_slug for c in classes}


def confusable_groups(classes: list[LabelClass]) -> list[set[str]]:
    """Symmetric closure of the confusable relation, used to penalise look-alikes."""
    adjacency = {c.label: set(c.confusables) | {c.label} for c in classes}
    for cls in classes:
        for other in cls.confusables:
            if other in adjacency:
                adjacency[other].add(cls.label)
    seen: set[str] = set()
    groups: list[set[str]] = []
    for label in adjacency:
        if label in seen:
            continue
        stack = [label]
        group: set[str] = set()
        while stack:
            current = stack.pop()
            if current in group:
                continue
            group.add(current)
            seen.add(current)
            stack.extend(adjacency.get(current, set()) - group)
        if len(group) > 1:
            groups.append(group)
    return groups
