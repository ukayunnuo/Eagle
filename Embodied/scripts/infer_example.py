import argparse
import json
import logging
import os
import re
from pathlib import Path

import torch
from PIL import Image, ImageDraw

from eagle_worker import EagleWorker

logger = logging.getLogger(__name__)


def _comma_list(value: str) -> list[str]:
    items = [item.strip() for item in value.split(",")]
    return [item for item in items if item]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a LocateAnything example inference.")
    parser.add_argument("--model", default="nvidia/LocateAnything-3B")
    parser.add_argument("--image", default="assets/images/teaser.jpg")
    parser.add_argument("--task", default="detect", choices=["detect", "ground_multi", "detect_text", "point", "ground_gui", "chat"])
    parser.add_argument("--categories", type=_comma_list, default=["person"])
    parser.add_argument("--phrase", default="person")
    parser.add_argument("--question", default="Describe this image in detail.", help="通用图像对话问题（chat 任务用）")
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--dtype", default="bfloat16", choices=["bfloat16", "float16", "float32"])
    parser.add_argument("--generation-mode", default="hybrid", choices=["fast", "slow", "hybrid"])
    parser.add_argument("--max-new-tokens", type=int, default=256)
    parser.add_argument("--max-image-edge", type=int, default=768)
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--output-json", default="")
    parser.add_argument("--output-image", default="")
    return parser.parse_args(argv)


def _torch_dtype(name: str) -> torch.dtype:
    if name == "bfloat16":
        return torch.bfloat16
    if name == "float16":
        return torch.float16
    return torch.float32


def _predict_kwargs(args: argparse.Namespace) -> dict:
    return {
        "generation_mode": args.generation_mode,
        "max_new_tokens": args.max_new_tokens,
        "temperature": args.temperature,
    }


def prepare_image(image: Image.Image, max_edge: int) -> Image.Image:
    image = image.convert("RGB")
    if max_edge <= 0:
        return image

    width, height = image.size
    longest = max(width, height)
    if longest <= max_edge:
        return image

    scale = max_edge / longest
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def parse_box_annotations(answer: str, image_width: int, image_height: int) -> list[dict]:
    annotations = []
    pattern = re.compile(
        r"(?:<ref>(?P<label>.*?)</ref>)?<box><(?P<x1>\d+)><(?P<y1>\d+)><(?P<x2>\d+)><(?P<y2>\d+)></box>"
    )
    for match in pattern.finditer(answer):
        raw_x1 = int(match.group("x1")) / 1000 * image_width
        raw_y1 = int(match.group("y1")) / 1000 * image_height
        raw_x2 = int(match.group("x2")) / 1000 * image_width
        raw_y2 = int(match.group("y2")) / 1000 * image_height
        x1, x2 = sorted((max(0, min(image_width, raw_x1)), max(0, min(image_width, raw_x2))))
        y1, y2 = sorted((max(0, min(image_height, raw_y1)), max(0, min(image_height, raw_y2))))
        annotations.append(
            {
                "label": match.group("label") or "object",
                "box": (x1, y1, x2, y2),
            }
        )
    return annotations


def default_output_image_path(output_json: Path) -> Path:
    return output_json.with_name(f"{output_json.stem}_annotated.jpg")


def draw_annotations(image: Image.Image, answer: str) -> Image.Image:
    annotated = image.convert("RGB").copy()
    draw = ImageDraw.Draw(annotated)
    width, height = annotated.size
    line_width = max(2, round(min(width, height) / 200))

    for item in parse_box_annotations(answer, width, height):
        x1, y1, x2, y2 = item["box"]
        draw.rectangle((x1, y1, x2, y2), outline=(255, 32, 32), width=line_width)

        label = item["label"]
        try:
            text_box = draw.textbbox((x1, y1), label)
            text_height = text_box[3] - text_box[1]
            text_width = text_box[2] - text_box[0]
            label_y = max(0, y1 - text_height - 4)
            draw.rectangle(
                (x1, label_y, x1 + text_width + 6, label_y + text_height + 4),
                fill=(255, 32, 32),
            )
            draw.text((x1 + 3, label_y + 2), label, fill=(255, 255, 255))
        except UnicodeEncodeError:
            pass

    return annotated


def run_task(worker: EagleWorker, image: Image.Image, args: argparse.Namespace) -> str:
    kwargs = _predict_kwargs(args)
    if args.task == "detect":
        result = worker.detect(image, args.categories, **kwargs)
    elif args.task == "ground_multi":
        result = worker.ground_multi(image, args.phrase, **kwargs)
    elif args.task == "detect_text":
        result = worker.detect_text(image, **kwargs)
    elif args.task == "point":
        result = worker.point(image, args.phrase, **kwargs)
    elif args.task == "chat":
        result = worker.chat(image, args.question, **kwargs)
    else:
        result = worker.ground_gui(image, args.phrase, **kwargs)
    return result["answer"]


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

    image_path = Path(args.image)
    original_image = Image.open(image_path).convert("RGB")
    image = prepare_image(original_image, args.max_image_edge)
    logger.info("加载模型: %s", args.model)
    worker = EagleWorker(args.model, device=args.device, dtype=_torch_dtype(args.dtype))

    logger.info("执行推理: task=%s image=%s", args.task, image_path)
    answer = run_task(worker, image, args)
    print(answer)  # stdout 输出，便于 CLI 管道（如 grep / jq）

    output_image_path = None
    if args.output_image:
        output_image_path = Path(args.output_image)
    elif args.output_json:
        output_image_path = default_output_image_path(Path(args.output_json))

    if output_image_path:
        output_image_path.parent.mkdir(parents=True, exist_ok=True)
        draw_annotations(original_image, answer).save(output_image_path)

    if args.output_json:
        output_path = Path(args.output_json)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(
                {
                    "model": args.model,
                    "image": str(image_path),
                    "task": args.task,
                    "answer": answer,
                    "output_image": str(output_image_path) if output_image_path else "",
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
