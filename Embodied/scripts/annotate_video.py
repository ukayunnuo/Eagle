import argparse
import json
import logging
import os
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from locateanything_worker import LocateAnythingWorker
from scripts.infer_example import _comma_list, _torch_dtype, draw_annotations, prepare_image, run_task

logger = logging.getLogger(__name__)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Annotate a video with LocateAnything boxes.")
    parser.add_argument("--video", required=True)
    parser.add_argument("--model", default="nvidia/LocateAnything-3B")
    parser.add_argument("--task", default="ground_multi", choices=["detect", "ground_multi", "detect_text", "point", "ground_gui"])
    parser.add_argument("--categories", type=_comma_list, default=["person"])
    parser.add_argument("--phrase", default="猫")
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--dtype", default="bfloat16", choices=["bfloat16", "float16", "float32"])
    parser.add_argument("--generation-mode", default="hybrid", choices=["fast", "slow", "hybrid"])
    parser.add_argument("--max-new-tokens", type=int, default=128)
    parser.add_argument("--max-image-edge", type=int, default=768)
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--every-n-frames", type=int, default=1)
    parser.add_argument("--max-frames", type=int, default=0)
    parser.add_argument("--output-video", default="logs/video_annotated.mp4")
    parser.add_argument("--output-json", default="logs/video_annotations.json")
    parser.add_argument("--no-reuse-last", dest="reuse_last", action="store_false")
    parser.set_defaults(reuse_last=True)
    return parser.parse_args(argv)


def should_infer_frame(frame_index: int, every_n_frames: int) -> bool:
    interval = max(1, every_n_frames)
    return frame_index % interval == 0


def make_frame_record(frame_index: int, timestamp_sec: float, answer: str, inferred: bool) -> dict:
    return {
        "frame_index": frame_index,
        "timestamp_sec": round(timestamp_sec, 4),
        "inferred": inferred,
        "answer": answer,
    }


def _frame_to_image(frame) -> Image.Image:
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb).convert("RGB")


def _image_to_frame(image: Image.Image):
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def annotate_video(args: argparse.Namespace, worker: LocateAnythingWorker | None = None) -> dict:
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

    video_path = Path(args.video)
    output_video_path = Path(args.output_video)
    output_json_path = Path(args.output_json)
    output_video_path.parent.mkdir(parents=True, exist_ok=True)
    output_json_path.parent.mkdir(parents=True, exist_ok=True)

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(output_video_path), fourcc, fps, (width, height))
    if not writer.isOpened():
        capture.release()
        raise RuntimeError(f"Cannot create output video: {output_video_path}")

    if worker is None:
        worker = LocateAnythingWorker(args.model, device=args.device, dtype=_torch_dtype(args.dtype))
    records = []
    last_answer = ""
    processed = 0
    frame_index = 0

    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if args.max_frames and processed >= args.max_frames:
                break

            original_image = _frame_to_image(frame)
            timestamp_sec = frame_index / fps if fps else 0.0
            inferred = should_infer_frame(frame_index, args.every_n_frames)

            if inferred:
                logger.info("推理帧 %d (%.2fs)...", frame_index, timestamp_sec)
                model_image = prepare_image(original_image, args.max_image_edge)
                answer = run_task(worker, model_image, args)
                logger.debug("帧 %d 结果: %s", frame_index, answer[:200])
                last_answer = answer
            elif args.reuse_last:
                answer = last_answer
            else:
                answer = ""

            annotated = draw_annotations(original_image, answer) if answer else original_image
            writer.write(_image_to_frame(annotated))
            records.append(make_frame_record(frame_index, timestamp_sec, answer, inferred))

            processed += 1
            frame_index += 1
    finally:
        capture.release()
        writer.release()

    summary = {
        "model": args.model,
        "video": str(video_path),
        "output_video": str(output_video_path),
        "fps": fps,
        "width": width,
        "height": height,
        "frame_count": frame_count,
        "processed_frames": processed,
        "every_n_frames": max(1, args.every_n_frames),
        "reuse_last": args.reuse_last,
        "frames": records,
    }
    output_json_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    summary = annotate_video(args)
    logger.info("标注视频: %s", summary['output_video'])
    logger.info("处理帧数: %d", summary['processed_frames'])
    logger.info("JSON 输出: %s", args.output_json)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
