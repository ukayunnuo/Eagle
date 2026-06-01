import unittest
from pathlib import Path

from PIL import Image

from scripts import infer_example


class FakeWorker:
    def __init__(self):
        self.calls = []

    def detect(self, image, categories, **kwargs):
        self.calls.append(("detect", image, categories, kwargs))
        return {"answer": "<box><1><2><3><4></box>"}

    def ground_multi(self, image, phrase, **kwargs):
        self.calls.append(("ground_multi", image, phrase, kwargs))
        return {"answer": "<box><5><6><7><8></box>"}


class InferExampleTests(unittest.TestCase):
    def test_parse_args_uses_project_demo_defaults(self):
        args = infer_example.parse_args([])

        self.assertEqual(args.model, "nvidia/LocateAnything-3B")
        self.assertEqual(args.image, "assets/images/teaser.jpg")
        self.assertEqual(args.task, "detect")
        self.assertEqual(args.categories, ["person"])
        self.assertEqual(args.max_new_tokens, 256)
        self.assertEqual(args.max_image_edge, 768)

    def test_run_task_calls_detect_with_categories(self):
        worker = FakeWorker()
        image = Image.new("RGB", (8, 8))
        args = infer_example.parse_args(["--categories", "person, car", "--max-new-tokens", "32"])

        answer = infer_example.run_task(worker, image, args)

        self.assertEqual(answer, "<box><1><2><3><4></box>")
        self.assertEqual(worker.calls[0][0], "detect")
        self.assertEqual(worker.calls[0][2], ["person", "car"])
        self.assertEqual(worker.calls[0][3]["max_new_tokens"], 32)

    def test_run_task_calls_ground_multi_with_phrase(self):
        worker = FakeWorker()
        image = Image.new("RGB", (8, 8))
        args = infer_example.parse_args(["--task", "ground_multi", "--phrase", "red shirt"])

        answer = infer_example.run_task(worker, image, args)

        self.assertEqual(answer, "<box><5><6><7><8></box>")
        self.assertEqual(worker.calls[0][0], "ground_multi")
        self.assertEqual(worker.calls[0][2], "red shirt")

    def test_prepare_image_resizes_long_edge(self):
        image = Image.new("RGB", (2000, 1000))

        resized = infer_example.prepare_image(image, max_edge=500)

        self.assertEqual(resized.size, (500, 250))
        self.assertEqual(resized.mode, "RGB")

    def test_parse_box_annotations_scales_to_image_size(self):
        answer = "<ref>cat</ref><box><100><200><300><400></box><|im_end|>"

        annotations = infer_example.parse_box_annotations(answer, image_width=2000, image_height=1000)

        self.assertEqual(
            annotations,
            [{"label": "cat", "box": (200.0, 200.0, 600.0, 400.0)}],
        )

    def test_parse_box_annotations_normalizes_inverted_boxes(self):
        answer = "<ref>car</ref><box><75><615><192><503></box>"

        annotations = infer_example.parse_box_annotations(answer, image_width=1000, image_height=1000)

        self.assertEqual(
            annotations,
            [{"label": "car", "box": (75.0, 503.0, 192.0, 615.0)}],
        )

    def test_draw_annotations_handles_inverted_boxes(self):
        image = Image.new("RGB", (100, 100))
        answer = "<ref>car</ref><box><75><615><192><503></box>"

        annotated = infer_example.draw_annotations(image, answer)

        self.assertEqual(annotated.size, (100, 100))

    def test_default_output_image_path_uses_json_stem(self):
        output = infer_example.default_output_image_path(Path("logs/street_result22.json"))

        self.assertEqual(output, Path("logs/street_result22_annotated.jpg"))


if __name__ == "__main__":
    unittest.main()
