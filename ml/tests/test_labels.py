import unittest

from bharatbite_ml.catalog import load_catalog
from bharatbite_ml.labels import (
    confusable_groups,
    label_to_slug_map,
    load_labels,
    validate_labels,
)


class LabelSetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.classes = load_labels()
        cls.catalog = load_catalog()
        cls.report = validate_labels(cls.classes, cls.catalog)

    def test_fifty_classes(self):
        self.assertEqual(len(self.classes), 50)

    def test_report_is_clean(self):
        self.assertTrue(self.report.ok, self.report.summary())
        self.assertEqual(self.report.mapped, 50)
        self.assertEqual(list(self.report.missing_slugs), [])
        self.assertEqual(list(self.report.missing_variants), [])
        self.assertEqual(list(self.report.duplicate_slugs), [])

    def test_every_class_maps_to_a_real_catalog_food(self):
        for cls in self.classes:
            self.assertIn(cls.catalog_slug, self.catalog, cls.label)

    def test_variant_is_offered_by_the_catalog_food(self):
        for cls in self.classes:
            food = self.catalog[cls.catalog_slug]
            self.assertIn(cls.variant, food.variants, f"{cls.label} -> {cls.variant}")

    def test_labels_are_unique(self):
        names = [cls.label for cls in self.classes]
        self.assertEqual(len(names), len(set(names)))

    def test_confusables_resolve(self):
        names = {cls.label for cls in self.classes}
        for cls in self.classes:
            for other in cls.confusables:
                self.assertIn(other, names, f"{cls.label} lists unknown confusable {other}")
                self.assertNotEqual(other, cls.label)

    def test_confusable_groups_are_symmetric_closures(self):
        groups = confusable_groups(self.classes)
        self.assertTrue(groups)
        for group in groups:
            self.assertGreater(len(group), 1)
        covered = set().union(*groups)
        self.assertTrue(covered.issubset({cls.label for cls in self.classes}))

    def test_slug_map_is_one_to_one(self):
        mapping = label_to_slug_map(self.classes)
        self.assertEqual(len(mapping), 50)
        self.assertEqual(len(set(mapping.values())), 50)

    def test_missing_variant_is_reported(self):
        broken = list(self.classes)
        from dataclasses import replace

        broken[0] = replace(broken[0], variant="boiled-in-space")
        report = validate_labels(broken, self.catalog)
        self.assertFalse(report.ok)
        self.assertTrue(report.missing_variants)


if __name__ == "__main__":
    unittest.main()
