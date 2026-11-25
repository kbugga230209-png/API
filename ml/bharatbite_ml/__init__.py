"""BharatBite Indian food recognition pipeline.

Everything in this package is either pure standard-library logic (dataset
validation, split construction, label ⇄ catalog mapping, benchmark gating) or
lazily imported training code that is only touched when a real dataset exists.

No dataset and no model artifact is shipped in this repository. `dataset.py`
validates a manifest you supply; it never invents images.
"""

__all__ = ["catalog", "dataset", "labels", "benchmark"]
