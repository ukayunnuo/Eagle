import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from PIL import Image

from scripts import web_ui


class WebUiTests(unittest.TestCase):
    def test_resolve_video_input_path_supports_common_shapes(self):
        self.assertEqual(web_ui._resolve_video_input_path("a.mp4"), "a.mp4")
        self.assertEqual(web_ui._resolve_video_input_path(Path("b.mp4")), "b.mp4")
        self.assertEqual(web_ui._resolve_video_input_path({"name": "c.mp4"}), "c.mp4")
        self.assertEqual(web_ui._resolve_video_input_path({"path": "d.mp4"}), "d.mp4")

    def test_build_task_args_has_detect_defaults(self):
        args = web_ui._build_task_args(
            task="detect",
            categories_text="",
            phrase="",
            generation_mode="hybrid",
            max_new_tokens=64,
            temperature=0.7,
        )
        self.assertEqual(args.categories, ["person"])
        self.assertEqual(args.phrase, "person")
        self.assertEqual(args.max_new_tokens, 64)
        self.assertEqual(args.temperature, 0.7)

    def test_run_image_annotation_writes_json(self):
        with TemporaryDirectory() as tmp:
            output_dir = Path(tmp)
            image = Image.new("RGB", (32, 24), color=(12, 23, 34))

            with patch("scripts.web_ui._ensure_output_dir", return_value=output_dir):
                with patch("scripts.web_ui._get_worker", return_value=object()):
                    with patch("scripts.web_ui.run_task", return_value="<ref>cat</ref><box><100><200><300><400></box>"):
                        _, json_path, answer, _ = web_ui.run_image_annotation(
                            image=image,
                            task="ground_multi",
                            categories_text="person",
                            phrase="猫",
                            generation_mode="hybrid",
                            max_new_tokens=64,
                            max_image_edge=768,
                            temperature=0.7,
                            model="nvidia/LocateAnything-3B",
                            device="cpu",
                            dtype="float32",
                        )

            json_data = json.loads(Path(json_path).read_text(encoding="utf-8"))
            self.assertEqual(answer, "<ref>cat</ref><box><100><200><300><400></box>")
            self.assertEqual(json_data["task"], "ground_multi")
            self.assertEqual(json_data["phrase"], "猫")
            self.assertTrue(Path(json_data["output_image"]).exists())

    def test_run_video_annotation_builds_outputs(self):
        with TemporaryDirectory() as tmp:
            output_dir = Path(tmp)

            with patch("scripts.web_ui._ensure_output_dir", return_value=output_dir):
                with patch("scripts.web_ui._get_worker", return_value=object()):
                    with patch(
                        "scripts.web_ui.annotate_video",
                        return_value={
                            "processed_frames": 10,
                            "frame_count": 100,
                            "output_video": str(output_dir / "demo.mp4"),
                        },
                    ):
                        output_video, output_json, summary_text = web_ui.run_video_annotation(
                            video_input="input.mp4",
                            task="ground_multi",
                            categories_text="person",
                            phrase="猫",
                            generation_mode="hybrid",
                            max_new_tokens=64,
                            max_image_edge=384,
                            temperature=0.7,
                            every_n_frames=10,
                            max_frames=0,
                            reuse_last=True,
                            model="nvidia/LocateAnything-3B",
                            device="cpu",
                            dtype="float32",
                        )

            self.assertTrue(output_video.endswith(".mp4"))
            self.assertTrue(output_json.endswith(".json"))
            self.assertIn("处理帧数：10 / 总帧数：100", summary_text)

    def test_collect_batch_files_filters_by_type(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "a.jpg").write_bytes(b"x")
            (root / "b.mp4").write_bytes(b"x")
            (root / "c.txt").write_text("ignore", encoding="utf-8")
            (root / "sub").mkdir()
            (root / "sub" / "d.png").write_bytes(b"x")

            files = web_ui._collect_batch_files(
                input_dir=str(root),
                include_images=True,
                include_videos=False,
                recursive=True,
                max_files=0,
            )
            self.assertEqual({path.name for path in files}, {"a.jpg", "d.png"})

    def test_run_batch_annotation_writes_summary(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            input_dir = root / "inputs"
            output_root = root / "outputs"
            input_dir.mkdir()
            Image.new("RGB", (8, 8), color=(100, 100, 100)).save(input_dir / "a.jpg")
            (input_dir / "b.mp4").write_bytes(b"x")

            with patch("scripts.web_ui._get_worker", return_value=object()):
                with patch("scripts.web_ui._ensure_output_dir", return_value=output_root):
                    with patch(
                        "scripts.web_ui.run_image_annotation",
                        return_value=(Image.new("RGB", (4, 4)), str(output_root / "image_a.json"), "<box><1><2><3><4></box>", "ok"),
                    ):
                        with patch(
                            "scripts.web_ui.run_video_annotation",
                            return_value=(str(output_root / "video_b.mp4"), str(output_root / "video_b.json"), "ok"),
                        ):
                            summary_json, summary_text = web_ui.run_batch_annotation(
                                input_dir=str(input_dir),
                                task="ground_multi",
                                categories_text="person",
                                phrase="猫",
                                generation_mode="hybrid",
                                max_new_tokens=64,
                                max_image_edge=384,
                                temperature=0.7,
                                every_n_frames=10,
                                max_frames=0,
                                reuse_last=True,
                                include_images=True,
                                include_videos=True,
                                recursive=False,
                                max_files=0,
                                model="nvidia/LocateAnything-3B",
                                device="cpu",
                                dtype="float32",
                            )

            data = json.loads(Path(summary_json).read_text(encoding="utf-8"))
            self.assertEqual(data["total_files"], 2)
            self.assertEqual(data["success_files"], 2)
            self.assertEqual(data["failed_files"], 0)
            self.assertIn("批量标注完成", summary_text)


if __name__ == "__main__":
    unittest.main()
