"""Ed25519 (RFC 8032) sign/verify, standard library only.

Why hand-rolled: the signing step runs on an owner/CI machine where we do not
want to add a native crypto dependency just to produce one detached signature,
and the sandbox that generates the manifest has neither `cryptography` nor
`pynacl`. The implementation is verified against the official RFC 8032 test
vectors in `ml/tests/test_ed25519.py`; if those pass, the arithmetic is right.
Verification also runs on the JS side (`verifyManifestSignature`), which is the
authority the app actually trusts.
"""
from __future__ import annotations

import hashlib

P = 2**255 - 19
L = 2**252 + 27742317777372353535851937790883648493
D = (-121665 * pow(121666, P - 2, P)) % P
I = pow(2, (P - 1) // 4, P)


def _inv(x: int) -> int:
    return pow(x, P - 2, P)


def _recover_x(y: int, sign: int) -> int | None:
    if y >= P:
        return None
    x2 = (y * y - 1) * _inv(D * y * y + 1) % P
    if x2 == 0:
        return None if sign else 0
    x = pow(x2, (P + 3) // 8, P)
    if (x * x - x2) % P:
        x = x * I % P
    if (x * x - x2) % P:
        return None
    if (x & 1) != sign:
        x = P - x
    return x


G_Y = 4 * _inv(5) % P
G_X = _recover_x(G_Y, 0)
assert G_X is not None
G = (G_X, G_Y, 1, G_X * G_Y % P)
IDENTITY = (0, 1, 1, 0)


def _add(p1: tuple[int, int, int, int], p2: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    x1, y1, z1, t1 = p1
    x2, y2, z2, t2 = p2
    a = (y1 - x1) * (y2 - x2) % P
    b = (y1 + x1) * (y2 + x2) % P
    c = t1 * 2 * D * t2 % P
    dd = z1 * 2 * z2 % P
    e, f, g, h = b - a, dd - c, dd + c, b + a
    return e * f % P, g * h % P, f * g % P, e * h % P


def _mul(scalar: int, point: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    result = IDENTITY
    while scalar > 0:
        if scalar & 1:
            result = _add(result, point)
        point = _add(point, point)
        scalar >>= 1
    return result


def _encode(point: tuple[int, int, int, int]) -> bytes:
    x, y, z, _ = point
    zi = _inv(z)
    x, y = x * zi % P, y * zi % P
    return (y | ((x & 1) << 255)).to_bytes(32, "little")


def _decode(data: bytes) -> tuple[int, int, int, int] | None:
    if len(data) != 32:
        return None
    value = int.from_bytes(data, "little")
    sign = value >> 255
    y = value & ((1 << 255) - 1)
    x = _recover_x(y, sign)
    if x is None:
        return None
    return x, y, 1, x * y % P


def _sha512_int(*chunks: bytes) -> int:
    digest = hashlib.sha512()
    for chunk in chunks:
        digest.update(chunk)
    return int.from_bytes(digest.digest(), "little")


def _expand(secret: bytes) -> tuple[int, bytes]:
    if len(secret) != 32:
        raise ValueError("Ed25519 secret key must be 32 bytes")
    digest = hashlib.sha512(secret).digest()
    a = int.from_bytes(digest[:32], "little")
    a &= (1 << 254) - 8
    a |= 1 << 254
    return a, digest[32:]


def public_key(secret: bytes) -> bytes:
    a, _ = _expand(secret)
    return _encode(_mul(a, G))


def sign(secret: bytes, message: bytes) -> bytes:
    a, prefix = _expand(secret)
    public = _encode(_mul(a, G))
    r = _sha512_int(prefix, message) % L
    r_encoded = _encode(_mul(r, G))
    h = _sha512_int(r_encoded, public, message) % L
    s = (r + h * a) % L
    return r_encoded + s.to_bytes(32, "little")


def verify(public: bytes, message: bytes, signature: bytes) -> bool:
    if len(public) != 32 or len(signature) != 64:
        return False
    point = _decode(public)
    if point is None:
        return False
    r_encoded, s_encoded = signature[:32], signature[32:]
    s = int.from_bytes(s_encoded, "little")
    if s >= L:
        return False
    r_point = _decode(r_encoded)
    if r_point is None:
        return False
    h = _sha512_int(r_encoded, public, message) % L
    return _encode(_add(_mul(s, G), _mul(L - h, point))) == _encode(r_point)


def generate_secret() -> bytes:
    import os

    return os.urandom(32)
