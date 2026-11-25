"""Emit a signed model manifest the app will accept, or refuse and explain why.

The manifest this produces is byte-compatible with `canonicalManifestPayload`
in `packages/core/src/manifest.ts` (sorted keys, no signature field, JSON with
no extra whitespace), so the Ed25519 signature made here verifies in the app
and in the `model-manifest` Edge Function's publish path.

Refusal is the default. A manifest is only written when:
  * a real artifact file exists and its SHA-256 is computed from the bytes,
  * the benchmark results for that exact artifact pass the promotion gates,
  * validationTop1 is a measured number, not null or 0,
  * the signing key is supplied out of band (never committed).
"""
from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from pathlib import Path

from . import ed25519
from .benchmark import GATES, BenchmarkIncomplete, ModelResult, parse_results
from .dataset import sha256_file

ARCHITECTURES = ("efficientnet_lite0_int8", "mobilenetv3_small_int8")
FORMATS = ("tflite", "onnx")
CHANNELS = ("dev", "beta", "stable")
REQUIRED = {
    "modelId",
    "version",
    "channel",
    "format",
    "architecture",
    "fileUrl",
    "inputShape",
    "labels",
    "minAppVersion",
    "releasedAt",
}


class ManifestRefused(RuntimeError):
    """Signing was refused; the message lists every reason."""

    def __init__(self, reasons: list[str]):
        self.reasons = reasons
        super().__init__("; ".join(reasons))


@dataclass
class SignedManifest:
    manifest: dict
    public_key_base64: str
    payload: bytes

    def as_json(self) -> str:
        return json.dumps(self.manifest, indent=2, ensure_ascii=False) + "\n"


def stable_stringify(value: object) -> str:
    """Mirror of the TS `stableStringify` used to canonicalize the payload."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value.is_integer() and abs(value) < 1e21:
            return json.dumps(int(value))
        return json.dumps(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(stable_stringify(item) for item in value) + "]"
    if isinstance(value, dict):
        items = sorted((k, v) for k, v in value.items() if v is not None)
        return "{" + ",".join(f"{json.dumps(k)}:{stable_stringify(v)}" for k, v in items) + "}"
    raise TypeError(f"cannot canonicalize {type(value)!r}")


def canonical_manifest_payload(manifest: dict) -> str:
    payload = {k: v for k, v in manifest.items() if k != "signature"}
    return stable_stringify(payload)


def load_secret(secret_hex: str) -> bytes:
    raw = bytes.fromhex(secret_hex.strip())
    if len(raw) != 32:
        raise ManifestRefused([f"signing key must be 32 bytes (64 hex chars), got {len(raw)}"])
    return raw


def find_result(results: dict, architecture: str, sha256: str) -> ModelResult:
    models, _ = parse_results(results)
    for model in models:
        if model.architecture != architecture:
            continue
        if model.artifact_sha256 != sha256:
            raise ManifestRefused(
                [
                    f"benchmark for {architecture} was run on artifact {model.artifact_sha256[:12]}…, "
                    f"not on {sha256[:12]}… — re-evaluate the exact file you want to publish"
                ]
            )
        return model
    raise ManifestRefused([f"no benchmark result for architecture {architecture}"])


def build_manifest(
    artifact: Path,
    results: dict,
    *,
    model_id: str,
    version: str,
    channel: str,
    format: str,
    architecture: str,
    file_url: str,
    input_shape: tuple[int, int, int, int] = (1, 224, 224, 3),
    labels: int,
    min_app_version: str = "0.1.0",
    released_at: str,
    notes: str | None = None,
    secret: bytes,
    gates: dict[str, float] | None = None,
) -> SignedManifest:
    reasons: list[str] = []
    if architecture not in ARCHITECTURES:
        reasons.append(f"architecture must be one of {ARCHITECTURES}")
    if format not in FORMATS:
        reasons.append(f"format must be one of {FORMATS}")
    if channel not in CHANNELS:
        reasons.append(f"channel must be one of {CHANNELS}")
    if labels <= 0:
        reasons.append("labels must be a positive count of recognition classes")
    if not file_url.startswith("https://"):
        reasons.append("fileUrl must be https — the app refuses plaintext downloads")
    if not artifact.is_file():
        reasons.append(f"artifact not found: {artifact}")
    if reasons:
        raise ManifestRefused(reasons)

    try:
        result = find_result(results, architecture, sha256_file(artifact))
    except BenchmarkIncomplete as exc:
        raise ManifestRefused([f"benchmark results unusable: {exc}"]) from exc

    failures = result.gate_failures(gates or GATES)
    if failures:
        reasons.append("benchmark gate not met: " + "; ".join(failures))
    if not result.top1:
        reasons.append("validationTop1 would be 0 — an unmeasured model cannot be published")
    if reasons:
        raise ManifestRefused(reasons)

    manifest = {
        "schemaVersion": 1,
        "modelId": model_id,
        "version": version,
        "channel": channel,
        "format": format,
        "architecture": architecture,
        "fileUrl": file_url,
        "sizeBytes": artifact.stat().st_size,
        "sha256": result.artifact_sha256,
        "inputShape": list(input_shape),
        "labels": labels,
        "validationTop1": round(result.top1, 4),
        "minAppVersion": min_app_version,
        "releasedAt": released_at,
    }
    if notes:
        manifest["notes"] = notes

    payload = canonical_manifest_payload(manifest).encode("utf-8")
    signature = ed25519.sign(secret, payload)
    manifest["signature"] = base64.b64encode(signature).decode("ascii")
    return SignedManifest(
        manifest=manifest,
        public_key_base64=base64.b64encode(ed25519.public_key(secret)).decode("ascii"),
        payload=payload,
    )


def verify_signed_manifest(signed: dict, public_key_base64: str) -> bool:
    signature = base64.b64decode(signed.get("signature", ""))
    payload = canonical_manifest_payload(signed).encode("utf-8")
    return ed25519.verify(base64.b64decode(public_key_base64), payload, signature)


def write_manifest(signed: SignedManifest, out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "model-manifest.json"
    key_path = out_dir / "model-manifest.public-key.txt"
    manifest_path.write_text(signed.as_json(), encoding="utf-8")
    key_path.write_text(signed.public_key_base64 + "\n", encoding="utf-8")
    return manifest_path, key_path
