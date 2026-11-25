import unittest

from bharatbite_ml import ed25519

# Official RFC 8032 §7.1 test vectors (Ed25519, empty/1-byte/2-byte messages).
VECTORS = [
    (
        "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
        "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
        "",
        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
    ),
    (
        "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb",
        "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c",
        "72",
        "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00",
    ),
    (
        "c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7",
        "fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025",
        "af82",
        "6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a",
    ),
]


class Ed25519Tests(unittest.TestCase):
    def test_rfc8032_vectors(self):
        for secret_hex, public_hex, message_hex, signature_hex in VECTORS:
            with self.subTest(secret=secret_hex[:8]):
                secret = bytes.fromhex(secret_hex)
                message = bytes.fromhex(message_hex)
                self.assertEqual(ed25519.public_key(secret).hex(), public_hex)
                self.assertEqual(ed25519.sign(secret, message).hex(), signature_hex)
                self.assertTrue(ed25519.verify(bytes.fromhex(public_hex), message, bytes.fromhex(signature_hex)))

    def test_signature_is_deterministic(self):
        secret = bytes.fromhex(VECTORS[0][0])
        self.assertEqual(ed25519.sign(secret, b"bharatbite"), ed25519.sign(secret, b"bharatbite"))

    def test_tampered_message_fails(self):
        secret = bytes.fromhex(VECTORS[0][0])
        public = ed25519.public_key(secret)
        signature = ed25519.sign(secret, b"model-v1")
        self.assertFalse(ed25519.verify(public, b"model-v2", signature))

    def test_tampered_signature_fails(self):
        secret = bytes.fromhex(VECTORS[0][0])
        public = ed25519.public_key(secret)
        signature = bytearray(ed25519.sign(secret, b"model-v1"))
        signature[0] ^= 0x01
        self.assertFalse(ed25519.verify(public, b"model-v1", bytes(signature)))

    def test_wrong_public_key_fails(self):
        secret = bytes.fromhex(VECTORS[0][0])
        signature = ed25519.sign(secret, b"payload")
        other = ed25519.public_key(bytes.fromhex(VECTORS[1][0]))
        self.assertFalse(ed25519.verify(other, b"payload", signature))

    def test_malformed_inputs_rejected(self):
        self.assertFalse(ed25519.verify(b"short", b"m", b"x" * 64))
        self.assertFalse(ed25519.verify(b"k" * 32, b"m", b"x" * 63))
        with self.assertRaises(ValueError):
            ed25519.public_key(b"short-secret")

    def test_generated_keys_round_trip(self):
        secret = ed25519.generate_secret()
        self.assertEqual(len(secret), 32)
        public = ed25519.public_key(secret)
        signature = ed25519.sign(secret, b"generated")
        self.assertTrue(ed25519.verify(public, b"generated", signature))


if __name__ == "__main__":
    unittest.main()
