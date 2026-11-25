/**
 * Signed model manifest + install state machine.
 *
 * The manifest is served by the `model-manifest` Edge Function and signed with
 * an Ed25519 key whose public half is compiled into the app. Artifacts are keyed
 * by SHA-256. Nothing in this file performs I/O: hashing and signature
 * verification are injected so the same code runs under Node, the browser and
 * React Native (Hermes).
 */
function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(',')}]`;
    const record = value;
    const keys = Object.keys(record)
        .filter((k) => record[k] !== undefined)
        .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
}
/** Byte-for-byte canonical form of everything except the signature. */
export function canonicalManifestPayload(manifest) {
    const { signature: _signature, ...rest } = manifest;
    return stableStringify(rest);
}
export function encodeUtf8(text) {
    return new TextEncoder().encode(text);
}
export async function verifyManifestSignature(manifest, publicKeyBase64, verify) {
    if (!manifest.signature)
        return false;
    const payload = encodeUtf8(canonicalManifestPayload(manifest));
    try {
        return await verify(payload, manifest.signature, publicKeyBase64);
    }
    catch {
        return false;
    }
}
export async function verifyArtifactSha256(bytes, expectedHex, sha256) {
    const normalized = expectedHex.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized))
        return false;
    const actual = (await sha256(bytes)).trim().toLowerCase();
    return actual === normalized;
}
/** Plain semver comparison: returns -1, 0 or 1. */
export function compareVersions(a, b) {
    const pa = a.split(/[.+-]/).map((p) => Number.parseInt(p, 10));
    const pb = b.split(/[.+-]/).map((p) => Number.parseInt(p, 10));
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i += 1) {
        const na = Number.isNaN(pa[i] ?? 0) ? 0 : pa[i] ?? 0;
        const nb = Number.isNaN(pb[i] ?? 0) ? 0 : pb[i] ?? 0;
        if (na > nb)
            return 1;
        if (na < nb)
            return -1;
    }
    return 0;
}
export function manifestIsCompatible(manifest, appVersion) {
    return compareVersions(appVersion, manifest.minAppVersion) >= 0;
}
export function isManifestShapeValid(value) {
    if (!value || typeof value !== 'object')
        return false;
    const m = value;
    return (m.schemaVersion === 1 &&
        typeof m.modelId === 'string' &&
        typeof m.version === 'string' &&
        typeof m.fileUrl === 'string' &&
        typeof m.sha256 === 'string' &&
        /^[0-9a-fA-F]{64}$/.test(String(m.sha256)) &&
        typeof m.sizeBytes === 'number' &&
        m.sizeBytes > 0 &&
        typeof m.signature === 'string' &&
        m.signature.length > 0 &&
        (m.format === 'onnx' || m.format === 'tflite'));
}
export const initialInstallState = {
    phase: 'idle',
    bytesReceived: 0,
    totalBytes: 0,
    attempt: 0,
};
export const MAX_INSTALL_ATTEMPTS = 3;
/**
 * Deterministic reducer for the first-launch install flow:
 * idle → fetching_manifest → awaiting_consent → downloading → verifying →
 * installing → health_check → ready (or `paused` / `failed` at any download step).
 */
export function installReducer(state, event) {
    switch (event.type) {
        case 'START':
            return { ...state, phase: 'fetching_manifest', error: undefined };
        case 'MANIFEST_READY':
            return { ...state, phase: 'awaiting_consent', totalBytes: event.totalBytes, version: event.version };
        case 'SKIPPED':
            return { ...state, phase: 'idle' };
        case 'CONSENT_GIVEN':
            if (state.phase !== 'awaiting_consent' && state.phase !== 'failed')
                return state;
            return { ...state, phase: 'downloading', attempt: state.attempt + 1, bytesReceived: 0, error: undefined };
        case 'PROGRESS': {
            if (state.phase !== 'downloading')
                return state;
            const bytes = Math.max(0, event.bytesReceived);
            return { ...state, bytesReceived: Math.min(bytes, state.totalBytes || bytes) };
        }
        case 'PAUSE':
            return state.phase === 'downloading' ? { ...state, phase: 'paused' } : state;
        case 'RESUME':
            return state.phase === 'paused' ? { ...state, phase: 'downloading' } : state;
        case 'DOWNLOAD_COMPLETE':
            return state.phase === 'downloading' ? { ...state, phase: 'verifying' } : state;
        case 'VERIFIED':
            return state.phase === 'verifying' ? { ...state, phase: 'installing' } : state;
        case 'INSTALLED':
            return state.phase === 'installing' ? { ...state, phase: 'health_check' } : state;
        case 'HEALTH_OK':
            return state.phase === 'health_check' ? { ...state, phase: 'ready' } : state;
        case 'FAILED':
            return { ...state, phase: 'failed', error: event.error };
        default:
            return state;
    }
}
export function canRetry(state) {
    return state.phase === 'failed' && state.attempt < MAX_INSTALL_ATTEMPTS;
}
export function progressPercent(state) {
    if (state.totalBytes <= 0)
        return 0;
    return Math.min(100, Math.round((state.bytesReceived / state.totalBytes) * 100));
}
export function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0)
        return '0 B';
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
//# sourceMappingURL=manifest.js.map