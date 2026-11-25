"""Dataset source registry, licence policy and a reproducible acquisition path.

Two jobs:

  * `registry` — every candidate dataset with its licence status, whether it may
    be trained on, and what we may redistribute. Ambiguous-provenance sources
    are recorded (so the decision is auditable and nobody re-imports them by
    accident) but refused for training.
  * `fetch` — pulls images from licence-clean sources with per-image provenance
    (licence, source URL, author) into `ml/data/raw/<label>/`, deterministically
    and resumably. Today the only automated source is Wikimedia Commons, whose
    MediaWiki API exposes machine-readable licences.

Nothing here invents images, guesses a licence, or scrapes a site that forbids
it. A file whose licence is missing or not on the allow-list is skipped and
counted in the run report.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from .labels import load_labels

REGISTRY_PATH = Path(__file__).resolve().parents[1] / "dataset" / "sources.json"
DEFAULT_RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"

# Commons licence strings -> the ids dataset.LICENSE_ALLOW understands.
COMMONS_LICENCE_MAP = {
    "cc0": "CC0-1.0",
    "cc by 2.0": "CC-BY-4.0",
    "cc by 3.0": "CC-BY-4.0",
    "cc by 4.0": "CC-BY-4.0",
    "cc by-sa 2.0": "CC-BY-SA-4.0",
    "cc by-sa 3.0": "CC-BY-SA-4.0",
    "cc by-sa 4.0": "CC-BY-SA-4.0",
    "public domain": "CC0-1.0",
}
USER_AGENT = "BharatBiteDatasetBot/0.1 (https://github.com/kbugga230209-png/API; dataset acquisition)"


class SourcePolicyError(RuntimeError):
    """A source was used in a way its licence does not allow."""


@dataclass
class Source:
    id: str
    name: str
    url: str
    access: str
    licenses: list[str]
    license_status: str
    training_allowed: bool
    redistribution: str
    notes: str = ""
    eval_only: bool = False
    rejection: str | None = None
    risks: list[str] = field(default_factory=list)

    @property
    def usable_for_training(self) -> bool:
        return self.training_allowed and self.license_status in {"clear", "mixed"} and not self.rejection


def load_registry(path: Path | None = None) -> list[Source]:
    raw = json.loads((path or REGISTRY_PATH).read_text(encoding="utf-8"))
    sources: list[Source] = []
    for item in raw["sources"]:
        sources.append(
            Source(
                id=item["id"],
                name=item["name"],
                url=item["url"],
                access=item["access"],
                licenses=list(item.get("licenses", [])),
                license_status=item["licenseStatus"],
                training_allowed=bool(item.get("trainingAllowed")),
                redistribution=item.get("redistribution", ""),
                notes=item.get("licenseNotes", ""),
                eval_only=bool(item.get("evalOnly")),
                rejection=item.get("rejection"),
                risks=list(item.get("risks", [])),
            )
        )
    return sources


def validate_registry(sources: list[Source]) -> list[str]:
    """Structural and policy problems. An empty list means the registry is sound."""
    problems: list[str] = []
    seen: set[str] = set()
    for source in sources:
        if source.id in seen:
            problems.append(f"duplicate source id {source.id}")
        seen.add(source.id)
        if source.license_status not in {"clear", "mixed", "ambiguous"}:
            problems.append(f"{source.id}: unknown licenseStatus {source.license_status!r}")
        if not source.licenses:
            problems.append(f"{source.id}: no licences recorded")
        if source.license_status == "ambiguous" and source.training_allowed:
            problems.append(f"{source.id}: ambiguous licence cannot allow training")
        if source.training_allowed and not source.redistribution:
            problems.append(f"{source.id}: training data must state its redistribution terms")
        if not source.training_allowed and not (source.eval_only or source.rejection):
            problems.append(f"{source.id}: excluded source must say why (evalOnly or rejection)")
        if source.rejection and source.training_allowed:
            problems.append(f"{source.id}: rejected sources cannot be trained on")
    return problems


def training_sources(sources: list[Source]) -> list[Source]:
    return [s for s in sources if s.usable_for_training]


def require_training_allowed(sources: list[Source], source_id: str) -> Source:
    for source in sources:
        if source.id != source_id:
            continue
        if not source.usable_for_training:
            raise SourcePolicyError(
                f"{source_id} may not be used for training "
                f"(licenceStatus={source.license_status}, trainingAllowed={source.training_allowed}"
                + (f", rejection={source.rejection}" if source.rejection else "")
                + ")"
            )
        return source
    raise SourcePolicyError(f"unknown source {source_id}")


def mapping_coverage(sources: list[Source], labels: list[str] | None = None) -> dict:
    """How much of our label set each source can plausibly cover."""
    names = labels or [cls.label for cls in load_labels()]
    return {
        "labels": len(names),
        "trainingSources": [s.id for s in training_sources(sources)],
        "excludedSources": [s.id for s in sources if not s.usable_for_training],
    }


# --------------------------------------------------------------------------- #
# Wikimedia Commons acquisition
# --------------------------------------------------------------------------- #


def _api(params: dict) -> dict:
    query = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    request = urllib.request.Request(f"https://commons.wikimedia.org/w/api.php?{query}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def _strip_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", "", value or "")
    return html.unescape(text).strip()


def normalise_licence(raw: str) -> str | None:
    key = _strip_html(raw).lower().strip()
    for token, mapped in COMMONS_LICENCE_MAP.items():
        if key.startswith(token):
            return mapped
    return None


def search_terms(label: str, display_name: str, aliases: tuple[str, ...] = ()) -> list[str]:
    """Deterministic, deduplicated search terms for one class."""
    terms = [display_name, label.replace("-", " ")]
    terms.extend(aliases[:2])
    seen: list[str] = []
    for term in terms:
        cleaned = " ".join(term.replace("_", " ").split())
        if cleaned and cleaned.lower() not in {s.lower() for s in seen}:
            seen.append(cleaned)
    return seen


@dataclass
class FetchReport:
    source: str
    per_class: int
    downloaded: list[dict] = field(default_factory=list)
    skipped_licence: list[str] = field(default_factory=list)
    skipped_duplicate: list[str] = field(default_factory=list)
    skipped_error: list[str] = field(default_factory=list)
    per_class_counts: dict[str, int] = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "source": self.source,
            "perClassTarget": self.per_class,
            "downloaded": len(self.downloaded),
            "skippedLicence": len(self.skipped_licence),
            "skippedDuplicate": len(self.skipped_duplicate),
            "skippedError": len(self.skipped_error),
            "perClass": self.per_class_counts,
            "images": self.downloaded,
        }


def fetch_wikimedia(
    out_dir: Path,
    per_class: int = 6,
    classes: list[str] | None = None,
    dry_run: bool = False,
    max_search: int = 40,
) -> FetchReport:
    """Download licence-clean Commons images for each class, recording provenance.

    Deterministic: results are ordered by page id, and an image already on disk is
    skipped, so re-running resumes instead of re-downloading.
    """
    registry = load_registry()
    require_training_allowed(registry, "wikimedia-commons")

    label_classes = [cls for cls in load_labels() if classes is None or cls.label in classes]
    report = FetchReport(source="wikimedia-commons", per_class=per_class)
    out_dir = Path(out_dir)

    for cls in label_classes:
        saved = 0
        for term in search_terms(cls.label, cls.display_name, cls.aliases):
            if saved >= per_class:
                break
            try:
                payload = _api(
                    {
                        "action": "query",
                        "generator": "search",
                        "gsrsearch": f"{term} filetype:bitmap",
                        "gsrnamespace": "6",
                        "gsrlimit": str(max_search),
                        "prop": "imageinfo",
                        "iiprop": "url|size|extmetadata|mime",
                        "iiurlwidth": "512",
                    }
                )
            except Exception as exc:  # network, rate limit, malformed payload
                report.skipped_error.append(f"{cls.label}: search failed ({exc})")
                break

            pages = sorted(payload.get("query", {}).get("pages", []), key=lambda p: p.get("pageid", 0))
            for page in pages:
                if saved >= per_class:
                    break
                info = (page.get("imageinfo") or [{}])[0]
                meta = info.get("extmetadata") or {}
                licence_raw = (meta.get("LicenseShortName") or {}).get("value", "")
                licence = normalise_licence(licence_raw)
                author = _strip_html((meta.get("Artist") or {}).get("value", ""))
                source_url = info.get("descriptionurl") or page.get("title")
                thumb = info.get("thumburl")

                if not licence or not thumb or not source_url:
                    report.skipped_licence.append(f"{page.get('title')} ({licence_raw or 'no licence'})")
                    continue
                if licence in {"CC-BY-4.0", "CC-BY-SA-4.0"} and not author:
                    report.skipped_licence.append(f"{page.get('title')} (attribution missing)")
                    continue

                filename = f"{cls.label}/{page['pageid']}.jpg"
                target = out_dir / filename
                if target.exists():
                    saved += 1
                    continue
                if dry_run:
                    saved += 1
                    report.downloaded.append(
                        {"path": filename, "label": cls.label, "license": licence, "sourceUrl": source_url, "attribution": author}
                    )
                    continue

                try:
                    request = urllib.request.Request(thumb, headers={"User-Agent": USER_AGENT})
                    with urllib.request.urlopen(request, timeout=60) as response:
                        data = response.read()
                except Exception as exc:
                    report.skipped_error.append(f"{page.get('title')}: download failed ({exc})")
                    continue
                if len(data) < 5_000:
                    report.skipped_error.append(f"{page.get('title')}: suspiciously small ({len(data)} bytes)")
                    continue

                digest = hashlib.sha256(data).hexdigest()
                if any(entry["sha256"] == digest for entry in report.downloaded):
                    report.skipped_duplicate.append(f"{page.get('title')} (identical bytes already fetched)")
                    continue

                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                saved += 1
                report.downloaded.append(
                    {
                        "path": filename,
                        "label": cls.label,
                        "sha256": digest,
                        "bytes": len(data),
                        "width": info.get("width"),
                        "height": info.get("height"),
                        "license": licence,
                        "licenseRaw": licence_raw,
                        "sourceUrl": source_url,
                        "attribution": author,
                        "capturedRegion": None,
                    }
                )
        report.per_class_counts[cls.label] = saved
    return report


def write_provenance(report: FetchReport, path: Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report.as_dict(), indent=2) + "\n", encoding="utf-8")
    return path
