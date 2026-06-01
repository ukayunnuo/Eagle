import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import cv2
import numpy as np

from scripts import annotate_video


class AnnotateVideoTests(unittest.TestCase):
    def test_parse_args_sets_video_defaults(self):
        args = annotate_video.parse_args(["--video", "input.mp4"])

        self.assertEqual(args.video, "input.mp4")
        self.assertEqual(args.model, "nvidia/LocateAnything-3B")
        self.assertEqual(args.task, "ground_multi")
        self.assertEqual(args.phrase, "猫")
        self.assertEqual(args.every_n_frames, 1)
        self.assertTrue(args.reuse_last)

    def test_should_infer_frame_uses_interval(self):
        self.assertTrue(annotate_video.should_infer_frame(0, every_n_frames=10))
        self.assertFalse(annotate_video.should_infer_frame(9, every_n_frames=10))
        self.assertTrue(annotate_video.should_infer_frame(10, every_n_frames=10))

    def test_make_frame_record_marks_reused_answers(self):
        record = annotate_video.make_frame_record(
            frame_index=3,
            timestamp_sec=0.12,
            answer="<box><1><2><3><4></box>",
            inferred=False,
        )

        self.assertEqual(record["frame_index"], 3)
        self.assertEqual(record["timestamp_sec"], 0.12)
        self.assertEqual(record["answer"], "<box><1><2><3><4></box>")
        self.assertFalse(record["inferred"])

    def test_annotate_video_writes_video_and_json(self):
        with TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            input_video = tmp_path / "input.mp4"
            output_video = tmp_path / "output.mp4"
            output_json = tmp_path / "output.json"

            writer = cv2.VideoWriter(str(input_video), cv2.VideoWriter_fourcc(*"mp4v"), 5.0, (64, 48))
            for _ in range(2):
                writer.write(np.full((48, 64, 3), 80, dtype=np.uint8))
            writer.release()

            args = annotate_video.parse_args(
                [
                    "--video",
                    str(input_video),
                    "--output-video",
                    str(output_video),
                    "--output-json",
                    str(output_json),
                    "--max-frames",
                    "2",
                ]
            )

            with patch("scripts.annotate_video.LocateAnythingWorker", return_value=object()):
                with patch("scripts.annotate_video.run_task", return_value="<ref>cat</ref><box><100><100><500><500></box>"):
                    summary = annotate_video.annotate_video(args)

            self.assertEqual(summary["processed_frames"], 2)
            self.assertTrue(output_video.exists())
            self.assertTrue(output_json.exists())
            self.assertEqual(len(summary["frames"]), 2)


if __name__ == "__main__":
    unittest.main()
