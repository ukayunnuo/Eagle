"""Tests for eagle_worker.py — EagleWorker model loading and task routing."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import torch
from PIL import Image

from eagle_worker import EagleWorker, _detect_model_family


# ---------------------------------------------------------------------------
# _detect_model_family
# ---------------------------------------------------------------------------

class TestDetectModelFamily:
    def test_locateanything_type(self):
        config = SimpleNamespace(model_type="locateanything")
        assert _detect_model_family(config) == "locateanything"

    def test_eagle2_type(self):
        for mt in ("eagle_2_5_vl", "eagle2", "eagle2_vl"):
            config = SimpleNamespace(model_type=mt)
            assert _detect_model_family(config) == f"eagle2" or _detect_model_family(config) == "eagle2"

    def test_unknown_type_fallback_eagle2(self):
        config = SimpleNamespace(model_type="unknown_model")
        assert _detect_model_family(config) == "eagle2"

    def test_auto_map_locateanything(self):
        config = SimpleNamespace(
            model_type="something_else",
            auto_map={"AutoModel": "modeling_locateanything.LocateAnythingForConditionalGeneration"},
        )
        assert _detect_model_family(config) == "locateanything"

    def test_auto_map_eagle(self):
        config = SimpleNamespace(
            model_type="something_else",
            auto_map={"AutoModel": "modeling_eagle2_5_vl.Eagle2_5_VLForConditionalGeneration"},
        )
        assert _detect_model_family(config) == "eagle2"


# ---------------------------------------------------------------------------
# EagleWorker init (mocked)
# ---------------------------------------------------------------------------

def _make_worker(family: str = "eagle2") -> EagleWorker:
    """Create an EagleWorker with fully mocked HF loading."""
    with (
        patch("eagle_worker.AutoTokenizer") as mock_tok,
        patch("eagle_worker.AutoProcessor") as mock_proc,
        patch("eagle_worker.AutoModel") as mock_model,
    ):
        mock_model.from_pretrained.return_value.config = SimpleNamespace(
            model_type="eagle_2_5_vl" if family == "eagle2" else "locateanything"
        )
        mock_model.from_pretrained.return_value.to.return_value = mock_model.from_pretrained.return_value
        mock_model.from_pretrained.return_value.eval.return_value = mock_model.from_pretrained.return_value

        worker = EagleWorker("fake-model-path", device="cpu", dtype=torch.float32)
    return worker


class TestEagleWorkerInit:
    def test_family_detection_eagle2(self):
        worker = _make_worker("eagle2")
        assert worker.family == "eagle2"

    def test_family_detection_locateanything(self):
        worker = _make_worker("locateanything")
        assert worker.family == "locateanything"


# ---------------------------------------------------------------------------
# Task methods
# ---------------------------------------------------------------------------

class TestEagleWorkerTasks:
    def _mock_predict(self, worker: EagleWorker, answer: str = "<box><100><200><300><400></box>"):
        """Replace predict() with a mock that returns a fixed answer."""
        worker.predict = MagicMock(return_value={"answer": answer})

    def test_detect_calls_predict(self):
        worker = _make_worker()
        self._mock_predict(worker)
        img = Image.new("RGB", (10, 10))

        result = worker.detect(img, ["person", "car"])

        worker.predict.assert_called_once()
        call_args = worker.predict.call_args
        assert "person</c>car" in call_args[0][1]

    def test_ground_multi_calls_predict(self):
        worker = _make_worker()
        self._mock_predict(worker)
        img = Image.new("RGB", (10, 10))

        result = worker.ground_multi(img, "red car")

        worker.predict.assert_called_once()
        assert "red car" in worker.predict.call_args[0][1]

    def test_detect_text_calls_predict(self):
        worker = _make_worker()
        self._mock_predict(worker)
        img = Image.new("RGB", (10, 10))

        worker.detect_text(img)

        assert "Detect all the text" in worker.predict.call_args[0][1]

    def test_point_calls_predict(self):
        worker = _make_worker()
        self._mock_predict(worker)
        img = Image.new("RGB", (10, 10))

        worker.point(img, "the traffic light")

        assert "Point to" in worker.predict.call_args[0][1]

    def test_ground_gui_box(self):
        worker = _make_worker()
        self._mock_predict(worker)
        img = Image.new("RGB", (10, 10))

        worker.ground_gui(img, "search button", output_type="box")

        assert "Locate the region" in worker.predict.call_args[0][1]

    def test_ground_gui_point(self):
        worker = _make_worker()
        self._mock_predict(worker)
        img = Image.new("RGB", (10, 10))

        worker.ground_gui(img, "search button", output_type="point")

        assert "Point to" in worker.predict.call_args[0][1]

    def test_chat_calls_predict(self):
        worker = _make_worker()
        self._mock_predict(worker, answer="This image shows a cat.")
        img = Image.new("RGB", (10, 10))

        result = worker.chat(img, "What is in this image?")

        worker.predict.assert_called_once()
        assert result["answer"] == "This image shows a cat."


# ---------------------------------------------------------------------------
# Output parsing
# ---------------------------------------------------------------------------

class TestParseBoxes:
    def test_single_box(self):
        answer = "<box><100><200><300><400></box>"
        boxes = EagleWorker.parse_boxes(answer, 1000, 1000)
        assert len(boxes) == 1
        assert boxes[0]["x1"] == 100.0
        assert boxes[0]["y1"] == 200.0
        assert boxes[0]["x2"] == 300.0
        assert boxes[0]["y2"] == 400.0

    def test_multiple_boxes(self):
        answer = "<box><0><0><500><500></box><box><100><100><900><900></box>"
        boxes = EagleWorker.parse_boxes(answer, 1000, 1000)
        assert len(boxes) == 2

    def test_scaled_coordinates(self):
        answer = "<box><500><500><1000><1000></box>"
        boxes = EagleWorker.parse_boxes(answer, 640, 480)
        assert boxes[0]["x1"] == 320.0
        assert boxes[0]["y1"] == 240.0
        assert boxes[0]["x2"] == 640.0
        assert boxes[0]["y2"] == 480.0

    def test_no_boxes(self):
        assert EagleWorker.parse_boxes("no boxes here", 100, 100) == []


class TestParsePoints:
    def test_single_point(self):
        answer = "<box><500><500></box>"
        points = EagleWorker.parse_points(answer, 1000, 1000)
        assert len(points) == 1
        assert points[0]["x"] == 500.0
        assert points[0]["y"] == 500.0

    def test_no_points(self):
        assert EagleWorker.parse_points("no points", 100, 100) == []
