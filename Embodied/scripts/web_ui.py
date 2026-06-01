import argparse
import io
import json
import os
import threading
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

from PIL import Image
import streamlit as st
import torch

from locateanything_worker import LocateAnythingWorker
from scripts.annotate_video import annotate_video
from scripts.infer_example import _comma_list, _torch_dtype, draw_annotations, prepare_image, run_task

_WORKER_CACHE: dict[tuple[str, str, str], LocateAnythingWorker] = {}
_WORKER_CACHE_LOCK = threading.Lock()
_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
_VIDEO_SUFFIXES = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Streamlit Web UI settings for LocateAnything.")
    parser.add_argument("--model", default="nvidia/LocateAnything-3B")
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--dtype", default="bfloat16", choices=["bfloat16", "float16", "float32"])
    parser.add_argument("--max-image-edge", type=int, default=768)
    return parser.parse_args(argv)


def _now_tag() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S_%f")


def _ensure_output_dir(kind: str) -> Path:
    output_dir = Path("logs") / "webui" / kind
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def _get_worker(model: str, device: str, dtype: str) -> LocateAnythingWorker:
    key = (model, device, dtype)
    with _WORKER_CACHE_LOCK:
        worker = _WORKER_CACHE.get(key)
        if worker is None:
            os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
            worker = LocateAnythingWorker(model, device=device, dtype=_torch_dtype(dtype))
            _WORKER_CACHE[key] = worker
        return worker


def _resolve_video_input_path(video_input) -> str:
    if isinstance(video_input, str):
        return video_input
    if isinstance(video_input, Path):
        return str(video_input)
    if isinstance(video_input, dict):
        for key in ("name", "path", "video"):
            value = video_input.get(key)
            if isinstance(value, str) and value:
                return value
    raise ValueError("无法解析上传视频路径，请重新上传视频文件。")


def _build_task_args(
    task: str,
    categories_text: str,
    phrase: str,
    generation_mode: str,
    max_new_tokens: int,
    temperature: float,
) -> SimpleNamespace:
    categories = _comma_list(categories_text) if categories_text else []
    if not categories:
        categories = ["person"]
    return SimpleNamespace(
        task=task,
        categories=categories,
        phrase=phrase or "person",
        generation_mode=generation_mode,
        max_new_tokens=int(max_new_tokens),
        temperature=float(temperature),
    )


def _collect_batch_files(
    input_dir: str,
    include_images: bool,
    include_videos: bool,
    recursive: bool,
    max_files: int,
) -> list[Path]:
    root = Path(input_dir).expanduser()
    if not root.exists() or not root.is_dir():
        raise ValueError(f"目录不存在或不是文件夹: {root}")
    if not include_images and not include_videos:
        raise ValueError("请至少选择一种文件类型（图片或视频）。")

    allowed_suffixes: set[str] = set()
    if include_images:
        allowed_suffixes.update(_IMAGE_SUFFIXES)
    if include_videos:
        allowed_suffixes.update(_VIDEO_SUFFIXES)

    iterator = root.rglob("*") if recursive else root.glob("*")
    files = sorted(
        (path for path in iterator if path.is_file() and path.suffix.lower() in allowed_suffixes),
        key=lambda p: str(p).lower(),
    )
    if max_files > 0:
        files = files[:max_files]
    if not files:
        raise ValueError("目录下没有匹配的图片或视频文件。")
    return files


def run_image_annotation(
    image,
    task: str,
    categories_text: str,
    phrase: str,
    generation_mode: str,
    max_new_tokens: int,
    max_image_edge: int,
    temperature: float,
    model: str,
    device: str,
    dtype: str,
    worker: LocateAnythingWorker | None = None,
    output_dir: Path | None = None,
):
    if image is None:
        raise ValueError("请先上传图片。")

    if worker is None:
        worker = _get_worker(model, device, dtype)
    task_args = _build_task_args(task, categories_text, phrase, generation_mode, max_new_tokens, temperature)
    original_image = image.convert("RGB")
    model_image = prepare_image(original_image, int(max_image_edge))
    answer = run_task(worker, model_image, task_args)
    annotated = draw_annotations(original_image, answer)

    if output_dir is None:
        output_dir = _ensure_output_dir("image")
    output_dir.mkdir(parents=True, exist_ok=True)
    tag = _now_tag()
    output_image = output_dir / f"{tag}_annotated.jpg"
    output_json = output_dir / f"{tag}.json"
    annotated.save(output_image)
    output_json.write_text(
        json.dumps(
            {
                "model": model,
                "device": device,
                "dtype": dtype,
                "task": task,
                "categories": task_args.categories,
                "phrase": task_args.phrase,
                "answer": answer,
                "output_image": str(output_image),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    summary = (
        f"标注完成。输出图片：{output_image}\n"
        f"输出 JSON：{output_json}\n"
        f"模型：{model} | 设备：{device} | dtype：{dtype}"
    )
    return annotated, str(output_json), answer, summary


def run_video_annotation(
    video_input,
    task: str,
    categories_text: str,
    phrase: str,
    generation_mode: str,
    max_new_tokens: int,
    max_image_edge: int,
    temperature: float,
    every_n_frames: int,
    max_frames: int,
    reuse_last: bool,
    model: str,
    device: str,
    dtype: str,
    worker: LocateAnythingWorker | None = None,
    output_dir: Path | None = None,
):
    if video_input is None:
        raise ValueError("请先上传视频。")

    video_path = _resolve_video_input_path(video_input)
    if worker is None:
        worker = _get_worker(model, device, dtype)
    task_args = _build_task_args(task, categories_text, phrase, generation_mode, max_new_tokens, temperature)

    if output_dir is None:
        output_dir = _ensure_output_dir("video")
    output_dir.mkdir(parents=True, exist_ok=True)
    tag = _now_tag()
    output_video = output_dir / f"{tag}_annotated.mp4"
    output_json = output_dir / f"{tag}.json"

    args = SimpleNamespace(
        video=video_path,
        model=model,
        task=task_args.task,
        categories=task_args.categories,
        phrase=task_args.phrase,
        device=device,
        dtype=dtype,
        generation_mode=task_args.generation_mode,
        max_new_tokens=task_args.max_new_tokens,
        max_image_edge=int(max_image_edge),
        temperature=task_args.temperature,
        every_n_frames=max(1, int(every_n_frames)),
        max_frames=max(0, int(max_frames)),
        output_video=str(output_video),
        output_json=str(output_json),
        reuse_last=bool(reuse_last),
    )
    summary = annotate_video(args, worker=worker)
    summary_text = (
        f"视频标注完成。处理帧数：{summary['processed_frames']} / 总帧数：{summary['frame_count']}\n"
        f"输出视频：{summary['output_video']}\n"
        f"输出 JSON：{output_json}"
    )
    return str(output_video), str(output_json), summary_text


def run_batch_annotation(
    input_dir: str,
    task: str,
    categories_text: str,
    phrase: str,
    generation_mode: str,
    max_new_tokens: int,
    max_image_edge: int,
    temperature: float,
    every_n_frames: int,
    max_frames: int,
    reuse_last: bool,
    include_images: bool,
    include_videos: bool,
    recursive: bool,
    max_files: int,
    model: str,
    device: str,
    dtype: str,
):
    files = _collect_batch_files(
        input_dir=input_dir,
        include_images=include_images,
        include_videos=include_videos,
        recursive=recursive,
        max_files=int(max_files),
    )
    worker = _get_worker(model, device, dtype)
    task_args = _build_task_args(task, categories_text, phrase, generation_mode, max_new_tokens, temperature)

    batch_root = _ensure_output_dir("batch") / _now_tag()
    image_out_dir = batch_root / "image"
    video_out_dir = batch_root / "video"
    image_out_dir.mkdir(parents=True, exist_ok=True)
    video_out_dir.mkdir(parents=True, exist_ok=True)

    records = []
    success_count = 0

    for file_path in files:
        suffix = file_path.suffix.lower()
        is_image = suffix in _IMAGE_SUFFIXES
        record = {
            "input": str(file_path),
            "kind": "image" if is_image else "video",
        }
        try:
            if is_image:
                with Image.open(file_path) as pil_image:
                    original = pil_image.convert("RGB")
                _, output_json, answer, _ = run_image_annotation(
                    image=original,
                    task=task_args.task,
                    categories_text=",".join(task_args.categories),
                    phrase=task_args.phrase,
                    generation_mode=task_args.generation_mode,
                    max_new_tokens=task_args.max_new_tokens,
                    max_image_edge=max_image_edge,
                    temperature=task_args.temperature,
                    model=model,
                    device=device,
                    dtype=dtype,
                    worker=worker,
                    output_dir=image_out_dir,
                )
                record.update(
                    {
                        "status": "ok",
                        "output_json": output_json,
                        "answer": answer,
                    }
                )
            else:
                output_video, output_json, _ = run_video_annotation(
                    video_input=str(file_path),
                    task=task_args.task,
                    categories_text=",".join(task_args.categories),
                    phrase=task_args.phrase,
                    generation_mode=task_args.generation_mode,
                    max_new_tokens=task_args.max_new_tokens,
                    max_image_edge=max_image_edge,
                    temperature=task_args.temperature,
                    every_n_frames=every_n_frames,
                    max_frames=max_frames,
                    reuse_last=reuse_last,
                    model=model,
                    device=device,
                    dtype=dtype,
                    worker=worker,
                    output_dir=video_out_dir,
                )
                record.update(
                    {
                        "status": "ok",
                        "output_json": output_json,
                        "output_video": output_video,
                    }
                )
            success_count += 1
        except Exception as exc:
            record.update({"status": "error", "error": str(exc)})
        records.append(record)

    summary = {
        "input_dir": str(Path(input_dir).expanduser()),
        "model": model,
        "device": device,
        "dtype": dtype,
        "task": task_args.task,
        "categories": task_args.categories,
        "phrase": task_args.phrase,
        "total_files": len(files),
        "success_files": success_count,
        "failed_files": len(files) - success_count,
        "batch_root": str(batch_root),
        "records": records,
    }
    summary_json = batch_root / "batch_summary.json"
    summary_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    summary_text = (
        f"批量标注完成。总文件：{summary['total_files']}，成功：{summary['success_files']}，失败：{summary['failed_files']}\n"
        f"输出目录：{batch_root}\n"
        f"汇总 JSON：{summary_json}"
    )
    return str(summary_json), summary_text


def _render_streamlit(defaults: argparse.Namespace) -> None:
    st.set_page_config(page_title="LocateAnything 标注 Web UI", layout="wide")
    st.title("LocateAnything 本地标注页面")
    st.caption("支持上传图片和视频，执行目标检测/短语定位，并导出标注结果。")

    with st.sidebar:
        st.subheader("模型设置")
        model = st.text_input("模型", value=defaults.model)
        device = st.selectbox("设备", options=["cuda", "cpu"], index=0 if defaults.device == "cuda" else 1)
        dtype = st.selectbox("精度(dtype)", options=["bfloat16", "float16", "float32"], index=["bfloat16", "float16", "float32"].index(defaults.dtype))

    image_tab, video_tab, batch_tab = st.tabs(["图片标注", "视频标注", "批量标注（文件夹）"])

    with image_tab:
        with st.form("image_form"):
            uploaded_image = st.file_uploader("上传图片", type=["jpg", "jpeg", "png", "bmp", "webp"])
            img_col1, img_col2 = st.columns(2)
            with img_col1:
                image_task = st.selectbox("任务", options=["detect", "ground_multi", "detect_text", "point", "ground_gui"], index=1)
                image_categories = st.text_input("检测类别（detect 用，逗号分隔）", value="person")
                image_phrase = st.text_input("描述短语", value="猫")
            with img_col2:
                image_mode = st.selectbox("生成模式", options=["fast", "slow", "hybrid"], index=2)
                image_tokens = st.slider("max_new_tokens", min_value=1, max_value=512, value=128, step=1)
                image_edge = st.slider("max_image_edge", min_value=128, max_value=2048, value=int(defaults.max_image_edge), step=64)
                image_temp = st.slider("temperature", min_value=0.0, max_value=1.5, value=0.7, step=0.05)
            image_submit = st.form_submit_button("开始图片标注")

        if image_submit:
            if uploaded_image is None:
                st.error("请先上传图片。")
            else:
                image = Image.open(uploaded_image).convert("RGB")
                with st.spinner("正在执行图片标注..."):
                    annotated, json_path, answer, summary = run_image_annotation(
                        image=image,
                        task=image_task,
                        categories_text=image_categories,
                        phrase=image_phrase,
                        generation_mode=image_mode,
                        max_new_tokens=image_tokens,
                        max_image_edge=image_edge,
                        temperature=image_temp,
                        model=model,
                        device=device,
                        dtype=dtype,
                    )
                st.image(annotated, caption="标注结果", use_container_width=True)
                st.text_area("模型原始输出", value=answer, height=120)
                st.text_area("执行信息", value=summary, height=90)

                image_buffer = io.BytesIO()
                annotated.save(image_buffer, format="JPEG")
                st.download_button(
                    label="下载标注图片",
                    data=image_buffer.getvalue(),
                    file_name=f"{Path(json_path).stem}_annotated.jpg",
                    mime="image/jpeg",
                )
                st.download_button(
                    label="下载结果 JSON",
                    data=Path(json_path).read_bytes(),
                    file_name=Path(json_path).name,
                    mime="application/json",
                )

    with video_tab:
        with st.form("video_form"):
            uploaded_video = st.file_uploader("上传视频", type=["mp4", "mov", "avi", "mkv"])
            vid_col1, vid_col2 = st.columns(2)
            with vid_col1:
                video_task = st.selectbox("任务", options=["detect", "ground_multi", "detect_text", "point", "ground_gui"], index=1, key="video_task")
                video_categories = st.text_input("检测类别（detect 用，逗号分隔）", value="person", key="video_categories")
                video_phrase = st.text_input("描述短语", value="猫", key="video_phrase")
                video_mode = st.selectbox("生成模式", options=["fast", "slow", "hybrid"], index=2, key="video_mode")
            with vid_col2:
                video_tokens = st.slider("max_new_tokens", min_value=1, max_value=512, value=64, step=1, key="video_tokens")
                video_edge = st.slider("max_image_edge", min_value=128, max_value=1280, value=384, step=64, key="video_edge")
                video_temp = st.slider("temperature", min_value=0.0, max_value=1.5, value=0.7, step=0.05, key="video_temp")
                every_n_frames = st.number_input("every_n_frames", min_value=1, value=10, step=1)
                max_frames = st.number_input("max_frames (0=全部)", min_value=0, value=0, step=1)
                reuse_last = st.checkbox("未推理帧复用上一帧结果", value=True)
            video_submit = st.form_submit_button("开始视频标注")

        if video_submit:
            if uploaded_video is None:
                st.error("请先上传视频。")
            else:
                video_input_dir = _ensure_output_dir("video")
                input_path = video_input_dir / f"{_now_tag()}_input{Path(uploaded_video.name).suffix or '.mp4'}"
                input_path.write_bytes(uploaded_video.read())

                with st.spinner("正在执行视频标注（可能耗时较长）..."):
                    output_video, output_json, summary = run_video_annotation(
                        video_input=str(input_path),
                        task=video_task,
                        categories_text=video_categories,
                        phrase=video_phrase,
                        generation_mode=video_mode,
                        max_new_tokens=video_tokens,
                        max_image_edge=video_edge,
                        temperature=video_temp,
                        every_n_frames=every_n_frames,
                        max_frames=max_frames,
                        reuse_last=reuse_last,
                        model=model,
                        device=device,
                        dtype=dtype,
                    )

                st.video(output_video)
                st.text_area("执行信息", value=summary, height=110)
                st.download_button(
                    label="下载标注视频",
                    data=Path(output_video).read_bytes(),
                    file_name=Path(output_video).name,
                    mime="video/mp4",
                )
                st.download_button(
                    label="下载结果 JSON",
                    data=Path(output_json).read_bytes(),
                    file_name=Path(output_json).name,
                    mime="application/json",
                )

    with batch_tab:
        with st.form("batch_form"):
            batch_col1, batch_col2 = st.columns(2)
            with batch_col1:
                input_dir = st.text_input("本地文件夹路径", value="")
                include_images = st.checkbox("处理图片", value=True)
                include_videos = st.checkbox("处理视频", value=False)
                recursive = st.checkbox("递归子目录", value=True)
                max_files = st.number_input("最多处理文件数（0=全部）", min_value=0, value=0, step=1)
            with batch_col2:
                batch_task = st.selectbox("任务", options=["detect", "ground_multi", "detect_text", "point", "ground_gui"], index=1, key="batch_task")
                batch_categories = st.text_input("检测类别（detect 用，逗号分隔）", value="person", key="batch_categories")
                batch_phrase = st.text_input("描述短语", value="猫", key="batch_phrase")
                batch_mode = st.selectbox("生成模式", options=["fast", "slow", "hybrid"], index=2, key="batch_mode")
                batch_tokens = st.slider("max_new_tokens", min_value=1, max_value=512, value=64, step=1, key="batch_tokens")
                batch_edge = st.slider("max_image_edge", min_value=128, max_value=2048, value=768, step=64, key="batch_edge")
                batch_temp = st.slider("temperature", min_value=0.0, max_value=1.5, value=0.7, step=0.05, key="batch_temp")
                batch_every_n = st.number_input("every_n_frames（视频）", min_value=1, value=10, step=1, key="batch_every_n")
                batch_max_frames = st.number_input("max_frames（视频，0=全部）", min_value=0, value=0, step=1, key="batch_max_frames")
                batch_reuse_last = st.checkbox("未推理帧复用上一帧结果（视频）", value=True, key="batch_reuse_last")
            batch_submit = st.form_submit_button("开始批量标注")

        if batch_submit:
            if not input_dir.strip():
                st.error("请先输入本地文件夹路径。")
            else:
                with st.spinner("正在批量标注（可能耗时较长）..."):
                    try:
                        summary_json, summary_text = run_batch_annotation(
                            input_dir=input_dir.strip(),
                            task=batch_task,
                            categories_text=batch_categories,
                            phrase=batch_phrase,
                            generation_mode=batch_mode,
                            max_new_tokens=batch_tokens,
                            max_image_edge=batch_edge,
                            temperature=batch_temp,
                            every_n_frames=batch_every_n,
                            max_frames=batch_max_frames,
                            reuse_last=batch_reuse_last,
                            include_images=include_images,
                            include_videos=include_videos,
                            recursive=recursive,
                            max_files=max_files,
                            model=model,
                            device=device,
                            dtype=dtype,
                        )
                    except Exception as exc:
                        st.error(str(exc))
                    else:
                        st.text_area("执行信息", value=summary_text, height=120)
                        st.download_button(
                            label="下载批处理汇总 JSON",
                            data=Path(summary_json).read_bytes(),
                            file_name=Path(summary_json).name,
                            mime="application/json",
                        )


def main(argv: list[str] | None = None) -> int:
    defaults = parse_args(argv)
    _render_streamlit(defaults)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
