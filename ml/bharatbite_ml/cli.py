"""Command line entry point: `python3 -m bharatbite_ml.cli <command>`.

Every command is read-only except `manifest`, which requires an explicit output
directory and a signing key passed through the environment (never argv — argv
ends up in shell history and CI logs).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from . import ed25519
from .benchmark import BenchmarkIncomplete, compare, load_results, render_markdown, template as bench_template
from .dataset import build_split, load_manifest, split_report, validate_manifest
from .export_manifest import ManifestRefused, build_manifest, load_secret, verify_signed_manifest, write_manifest
from .infer import recognize_from_json
from .labels import load_labels, validate_labels
from .manifest_tool import build_manifest_from_directory, write_manifest as write_dataset_manifest

ML_ROOT = Path(__file__).resolve().parent.parent
SIGNING_ENV = "BHARATBITE_MODEL_SIGNING_KEY"


def _print(payload: object) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def cmd_validate_labels(args: argparse.Namespace) -> int:
    classes = load_labels(args.labels)
    result = validate_labels(classes)
    _print(
        {
            "ok": result.ok,
            "classes": len(classes),
            "mapped": result.mapped,
            "missingSlugs": list(result.missing_slugs),
            "missingVariants": [list(v) for v in result.missing_variants],
            "duplicateMappings": list(result.duplicate_slugs),
            "danglingConfusables": [list(v) for v in result.confusable_links_missing],
            "unmappedCatalogFoods": len(result.unmapped_catalog_foods),
        }
    )
    return 0 if result.ok else 1


def cmd_validate_dataset(args: argparse.Namespace) -> int:
    manifest = load_manifest(Path(args.manifest))
    declared = [cls.label for cls in load_labels()]
    report = validate_manifest(manifest, Path(args.root), declared, verify_hashes=not args.no_hash)
    _print(
        {
            "ok": report.ok,
            "summary": report.summary(),
            "perClass": dict(sorted(report.per_class.items())),
            "perSplit": report.per_split,
            "errors": [i.__dict__ for i in report.errors],
            "warnings": [i.__dict__ for i in report.warnings],
        }
    )
    return 0 if report.ok else 1


def cmd_manifest_from_dir(args: argparse.Namespace) -> int:
    manifest, problems = build_manifest_from_directory(
        Path(args.root),
        license_id=args.license,
        source_url=args.source_url,
        attribution=args.attribution,
        val_fraction=args.val_fraction,
        test_fraction=args.test_fraction,
        corpus=args.corpus,
    )
    payload = {
        "ok": not problems,
        "images": len(manifest["images"]),
        "classes": len(manifest["classes"]),
        "perSplit": {
            split: len([i for i in manifest["images"] if i["split"] == split])
            for split in ("train", "val", "test")
        },
        "problems": problems,
    }
    if problems:
        _print(payload)
        return 1
    path = write_dataset_manifest(manifest, Path(args.out))
    payload["written"] = str(path)
    _print(payload)
    return 0


def cmd_split_plan(args: argparse.Namespace) -> int:
    manifest = load_manifest(Path(args.manifest))
    plan: dict[str, list[str]] = {"train": [], "val": [], "test": []}
    for image in manifest.get("images", []):
        plan[image["split"]].append(image["sha256"])
    report = split_report(plan)
    _print({"counts": report["counts"], "overlaps": report["overlaps"], "ok": not report["overlaps"]})
    return 0 if not report["overlaps"] else 1


def cmd_split_preview(args: argparse.Namespace) -> int:
    labels = [cls.label for cls in load_labels()]
    plan = build_split(labels, seed=args.seed)
    _print({"seed": args.seed, "classes": len(labels), "counts": {k: len(v) for k, v in plan.items()}})
    return 0


def cmd_benchmark(args: argparse.Namespace) -> int:
    path = Path(args.results)
    if not path.exists():
        if args.template:
            _print(bench_template())
            return 0
        print(f"no results file at {path} — no evaluation has been run yet", file=sys.stderr)
        return 1
    try:
        result = compare(load_results(path))
    except BenchmarkIncomplete as exc:
        print(f"results unusable: {exc}", file=sys.stderr)
        return 1
    if args.markdown:
        print(render_markdown(result))
    else:
        _print(
            {
                "evaluatedOn": result["evaluatedOn"],
                "recommended": result["recommended"],
                "accuracyWinner": result["accuracyWinner"],
                "latencyWinner": result["latencyWinner"],
                "sizeWinner": result["sizeWinner"],
                "gateFailures": result["gateFailures"],
                "models": [m.__dict__ | {"size_mb": round(m.size_mb, 2)} for m in result["models"]],
            }
        )
    return 0 if result["recommended"] else 1


def cmd_manifest(args: argparse.Namespace) -> int:
    secret_hex = os.environ.get(SIGNING_ENV, "").strip()
    if not secret_hex:
        print(
            f"refusing to sign: set {SIGNING_ENV} in the environment of this process only "
            "(it must never be committed or passed on the command line)",
            file=sys.stderr,
        )
        return 2
    try:
        signed = build_manifest(
            Path(args.artifact),
            load_results(Path(args.results)),
            model_id=args.model_id,
            version=args.version,
            channel=args.channel,
            format=args.format,
            architecture=args.architecture,
            file_url=args.file_url,
            labels=len(load_labels()),
            min_app_version=args.min_app_version,
            released_at=args.released_at,
            notes=args.notes,
            secret=load_secret(secret_hex),
        )
    except ManifestRefused as exc:
        print("refusing to sign:", file=sys.stderr)
        for reason in exc.reasons:
            print(f"  - {reason}", file=sys.stderr)
        return 1
    manifest_path, key_path = write_manifest(signed, Path(args.out))
    _print(
        {
            "manifest": str(manifest_path),
            "publicKey": str(key_path),
            "sha256": signed.manifest["sha256"],
            "validationTop1": signed.manifest["validationTop1"],
            "selfCheck": verify_signed_manifest(signed.manifest, signed.public_key_base64),
        }
    )
    return 0


def cmd_verify_manifest(args: argparse.Namespace) -> int:
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    public_key = Path(args.public_key).read_text(encoding="utf-8").strip()
    ok = verify_signed_manifest(manifest, public_key)
    _print({"ok": ok, "modelId": manifest.get("modelId"), "version": manifest.get("version")})
    return 0 if ok else 1


def cmd_new_key(args: argparse.Namespace) -> int:
    secret = ed25519.generate_secret()
    print(f"private key (hex, store as {SIGNING_ENV} secret, never commit): {secret.hex()}")
    print(f"public key (base64, safe to commit / compile into the app): "
          f"{__import__('base64').b64encode(ed25519.public_key(secret)).decode()}")
    return 0


def cmd_infer(args: argparse.Namespace) -> int:
    payload = json.loads(Path(args.detections).read_text(encoding="utf-8"))
    _print(recognize_from_json(payload).as_dict())
    return 0


def cmd_selftest(args: argparse.Namespace) -> int:
    """Prove the pure-Python half works without dataset, GPU or network."""
    classes = load_labels()
    label_result = validate_labels(classes)
    plan = build_split({cls.label: [f"{cls.label}-{i}" for i in range(20)] for cls in classes[:3]})
    checks = {
        "labelsValid": label_result.ok,
        "classes": len(classes),
        "splitCounts": {k: len(v) for k, v in plan.items()},
        "ed25519Available": hasattr(ed25519, "sign"),
    }
    _print(checks)
    return 0 if label_result.ok else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="bharatbite_ml", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("validate-labels", help="check labels.json against the nutrition catalog")
    p.add_argument("--labels", default=None)
    p.set_defaults(func=cmd_validate_labels)

    p = sub.add_parser("validate-dataset", help="validate a dataset manifest and its image files")
    p.add_argument("--manifest", required=True)
    p.add_argument("--root", required=True)
    p.add_argument("--no-hash", action="store_true", help="skip SHA-256 verification (structure only)")
    p.set_defaults(func=cmd_validate_dataset)

    p = sub.add_parser("manifest-from-dir", help="hash an image tree into a dataset manifest")
    p.add_argument("--root", required=True, help="directory containing one folder per class")
    p.add_argument("--out", required=True)
    p.add_argument("--license", required=True)
    p.add_argument("--source-url", required=True)
    p.add_argument("--attribution", default="")
    p.add_argument("--corpus", default="inference-corpus-v1")
    p.add_argument("--val-fraction", type=float, default=0.15)
    p.add_argument("--test-fraction", type=float, default=0.15)
    p.set_defaults(func=cmd_manifest_from_dir)

    p = sub.add_parser("split-plan", help="inspect the split recorded in a manifest for leakage")
    p.add_argument("--manifest", required=True)
    p.set_defaults(func=cmd_split_plan)

    p = sub.add_parser("split-preview", help="show the deterministic class-stratified split plan")
    p.add_argument("--seed", type=int, default=20261125)
    p.set_defaults(func=cmd_split_preview)

    p = sub.add_parser("benchmark", help="compare candidate models against the promotion gates")
    p.add_argument("--results", default=str(ML_ROOT / "benchmark" / "results.json"))
    p.add_argument("--markdown", action="store_true")
    p.add_argument("--template", action="store_true", help="print the empty results template")
    p.set_defaults(func=cmd_benchmark)

    p = sub.add_parser("manifest", help="sign a model manifest (refuses if gates are unmet)")
    p.add_argument("--artifact", required=True)
    p.add_argument("--results", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--model-id", required=True)
    p.add_argument("--version", required=True)
    p.add_argument("--architecture", required=True)
    p.add_argument("--format", default="tflite")
    p.add_argument("--channel", default="dev")
    p.add_argument("--file-url", required=True)
    p.add_argument("--min-app-version", default="0.1.0")
    p.add_argument("--released-at", required=True)
    p.add_argument("--notes", default=None)
    p.set_defaults(func=cmd_manifest)

    p = sub.add_parser("verify-manifest", help="verify a signed manifest offline")
    p.add_argument("--manifest", required=True)
    p.add_argument("--public-key", required=True)
    p.set_defaults(func=cmd_verify_manifest)

    p = sub.add_parser("new-key", help="generate an Ed25519 keypair for manifest signing")
    p.set_defaults(func=cmd_new_key)

    p = sub.add_parser("infer", help="apply confidence/abstain rules to raw detections")
    p.add_argument("--detections", required=True)
    p.set_defaults(func=cmd_infer)

    p = sub.add_parser("selftest", help="exercise the pure-Python pipeline")
    p.set_defaults(func=cmd_selftest)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
