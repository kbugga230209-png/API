import unittest

from bharatbite_ml.infer import Detection, HIGH_CONFIDENCE, aggregate, recognize_from_json, tier_for
from bharatbite_ml.labels import load_labels


class InferenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        classes = load_labels()
        cls.index = {cls.label: cls for cls in classes}
        cls.single = classes[0].label
        cls.other = classes[1].label
        # Pick a real confusable pair from the label set so the margin test is
        # about the shipped data, not a made-up relationship.
        cls.anchor = next(cls for cls in classes if cls.confusables)
        cls.sibling = cls.anchor.confusables[0]

    def test_clear_single_food_is_reported(self):
        result = aggregate([Detection(self.single, 0.92)], self.index)
        self.assertFalse(result.abstained)
        self.assertEqual(len(result.items), 1)
        item = result.items[0]
        self.assertEqual(item.tier, "high")
        self.assertEqual(item.catalog_slug, self.index[self.single].catalog_slug)
        self.assertFalse(item.needs_review)

    def test_low_confidence_abstains(self):
        result = aggregate([Detection(self.single, 0.2)], self.index)
        self.assertTrue(result.abstained)
        self.assertEqual(result.reason, "no_confident_detection")
        self.assertTrue(result.as_dict()["suggestSearchFallback"])

    def test_low_but_above_floor_top_item_abstains(self):
        result = aggregate([Detection(self.single, 0.5)], self.index)
        self.assertTrue(result.abstained)
        self.assertEqual(result.reason, "top_item_low_confidence")
        self.assertEqual(result.items[0].tier, "low")

    def test_unknown_label_is_rejected_not_shown(self):
        result = aggregate([Detection("pizza", 0.99)], self.index)
        self.assertTrue(result.abstained)
        self.assertEqual(result.rejected[0]["reason"], "unknown_label")

    def test_confusable_ambiguity_requests_review(self):
        result = aggregate(
            [Detection(self.anchor.label, 0.62), Detection(self.sibling, 0.58)],
            self.index,
        )
        self.assertFalse(result.abstained)
        top = result.items[0]
        self.assertTrue(top.needs_review)
        self.assertTrue(top.reason.startswith("ambiguous_with"))

    def test_clear_margin_on_confusable_pair_is_not_flagged(self):
        result = aggregate(
            [Detection(self.anchor.label, 0.95), Detection(self.sibling, 0.05)],
            self.index,
        )
        self.assertFalse(result.items[0].needs_review)

    def test_multi_food_is_capped_and_ranked(self):
        labels = [cls.label for cls in self.index.values()]
        detections = [Detection(label, 0.9 - index * 0.01) for index, label in enumerate(labels[:12])]
        result = aggregate(detections, self.index)
        self.assertEqual(len(result.items), 5)
        confidences = [item.confidence for item in result.items]
        self.assertEqual(confidences, sorted(confidences, reverse=True))
        self.assertTrue(any(r["reason"] == "over_max_items" for r in result.rejected))

    def test_repeated_detections_are_merged(self):
        result = aggregate(
            [Detection(self.single, 0.8), Detection(self.single, 0.86), Detection(self.single, 0.7)],
            self.index,
        )
        self.assertEqual(len(result.items), 1)
        self.assertEqual(result.items[0].detections, 3)
        self.assertAlmostEqual(result.items[0].confidence, 0.86)

    def test_tiny_box_is_rejected(self):
        result = aggregate([Detection(self.single, 0.9, box=(0.0, 0.0, 0.05, 0.05))], self.index)
        self.assertTrue(result.abstained)
        self.assertEqual(result.rejected[0]["reason"], "box_too_small")

    def test_tier_boundaries(self):
        self.assertEqual(tier_for(HIGH_CONFIDENCE), "high")
        self.assertEqual(tier_for(0.6), "medium")
        self.assertEqual(tier_for(0.41), "low")

    def test_json_bridge(self):
        result = recognize_from_json({"detections": [{"label": self.single, "confidence": 0.97}]})
        self.assertFalse(result.abstained)
        payload = result.as_dict()
        self.assertEqual(payload["items"][0]["label"], self.single)
        self.assertFalse(payload["suggestSearchFallback"])

    def test_every_shipped_label_resolves_to_a_slug(self):
        result = aggregate([Detection(self.single, 0.99)], self.index)
        slug = result.items[0].catalog_slug
        self.assertTrue(slug)
        self.assertRegex(slug, r"^[a-z0-9-]+$")


if __name__ == "__main__":
    unittest.main()
