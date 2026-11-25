import assert from 'node:assert/strict';
import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { test } from 'node:test';
import { canonicalManifestPayload, compareVersions, formatBytes, installReducer, initialInstallState, isManifestShapeValid, manifestIsCompatible, progressPercent, verifyArtifactSha256, verifyManifestSignature, } from '../manifest.js';
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicKeyBase64 = Buffer.from(publicKey.export({ type: 'spki', format: 'der' })).toString('base64');
const verifier = async (payload, signatureBase64, keyBase64) => {
    const keyDer = Buffer.from(keyBase64, 'base64');
    const key = createPublicKey({ key: keyDer, format: 'der', type: 'spki' });
    return verify(null, Buffer.from(payload), key, Buffer.from(signatureBase64, 'base64'));
};
const sha256 = async (data) => createHash('sha256').update(Buffer.from(data)).digest('hex');
function signManifest(partial) {
    const payload = Buffer.from(canonicalManifestPayload(partial), 'utf8');
    const signature = sign(null, payload, privateKey).toString('base64');
    return { ...partial, signature };
}
const base = {
    schemaVersion: 1,
    modelId: 'bharatbite-indian-food-classifier',
    version: '1.0.0',
    channel: 'stable',
    format: 'onnx',
    architecture: 'efficientnet_lite0_int8',
    fileUrl: 'https://example.supabase.co/storage/v1/object/public/model-artifacts/bharatbite-1.0.0.onnx',
    sizeBytes: 12_400_000,
    sha256: 'a'.repeat(64),
    inputShape: [1, 224, 224, 3],
    labels: 320,
    validationTop1: 0.81,
    minAppVersion: '1.0.0',
    releasedAt: '2026-11-25T00:00:00.000Z',
};
test('canonical payload is order independent and excludes the signature', () => {
    const a = canonicalManifestPayload(base);
    const b = canonicalManifestPayload({ ...base, signature: 'zzz' });
    assert.equal(a, b);
    assert.ok(!a.includes('signature'));
});
test('a valid signature verifies and a tampered manifest does not', async () => {
    const signed = signManifest(base);
    assert.equal(await verifyManifestSignature(signed, publicKeyBase64, verifier), true);
    const tampered = { ...signed, labels: 31 };
    assert.equal(await verifyManifestSignature(tampered, publicKeyBase64, verifier), false);
});
test('a manifest signed by a different key is rejected', async () => {
    const other = generateKeyPairSync('ed25519');
    const otherPub = Buffer.from(other.publicKey.export({ type: 'spki', format: 'der' })).toString('base64');
    const signed = signManifest(base);
    assert.equal(await verifyManifestSignature(signed, otherPub, verifier), false);
});
test('artifact checksum verification', async () => {
    const bytes = new TextEncoder().encode('fake-onnx-bytes');
    const expected = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    assert.equal(await verifyArtifactSha256(bytes, expected, sha256), true);
    assert.equal(await verifyArtifactSha256(bytes, expected.toUpperCase(), sha256), true);
    assert.equal(await verifyArtifactSha256(bytes, 'b'.repeat(64), sha256), false);
    assert.equal(await verifyArtifactSha256(bytes, 'not-a-hash', sha256), false);
});
test('shape validation rejects bad manifests', () => {
    assert.equal(isManifestShapeValid(signManifest(base)), true);
    assert.equal(isManifestShapeValid({ ...base, signature: '' }), false);
    assert.equal(isManifestShapeValid({ ...base, sha256: 'short' }), false);
    assert.equal(isManifestShapeValid({ ...base, schemaVersion: 2 }), false);
    assert.equal(isManifestShapeValid(null), false);
});
test('semver comparison and min app version gate', () => {
    assert.equal(compareVersions('1.2.0', '1.10.0'), -1);
    assert.equal(compareVersions('2.0.0', '2.0.0'), 0);
    assert.equal(compareVersions('2.0.1', '2.0.0'), 1);
    const manifest = signManifest(base);
    assert.equal(manifestIsCompatible(manifest, '1.0.0'), true);
    assert.equal(manifestIsCompatible(manifest, '0.9.9'), false);
});
test('install flow requires consent before download and can pause/resume', () => {
    let state = installReducer(initialInstallState, { type: 'START' });
    assert.equal(state.phase, 'fetching_manifest');
    state = installReducer(state, { type: 'MANIFEST_READY', totalBytes: 12_400_000, version: '1.0.0' });
    assert.equal(state.phase, 'awaiting_consent');
    assert.equal(state.bytesReceived, 0);
    state = installReducer(state, { type: 'CONSENT_GIVEN' });
    assert.equal(state.phase, 'downloading');
    state = installReducer(state, { type: 'PROGRESS', bytesReceived: 6_200_000 });
    assert.equal(progressPercent(state), 50);
    state = installReducer(state, { type: 'PAUSE' });
    assert.equal(state.phase, 'paused');
    state = installReducer(state, { type: 'RESUME' });
    state = installReducer(state, { type: 'PROGRESS', bytesReceived: 12_400_000 });
    state = installReducer(state, { type: 'DOWNLOAD_COMPLETE' });
    assert.equal(state.phase, 'verifying');
    state = installReducer(state, { type: 'VERIFIED' });
    state = installReducer(state, { type: 'INSTALLED' });
    assert.equal(state.phase, 'health_check');
    state = installReducer(state, { type: 'HEALTH_OK' });
    assert.equal(state.phase, 'ready');
});
test('progress never exceeds 100% and formatting is human readable', () => {
    const state = { phase: 'downloading', bytesReceived: 99_999_999, totalBytes: 1000, attempt: 1 };
    assert.equal(progressPercent(state), 100);
    assert.equal(formatBytes(12_400_000), '11.8 MB');
    assert.equal(formatBytes(2048), '2 KB');
});
//# sourceMappingURL=manifest.test.js.map