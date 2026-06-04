import argparse
import io
import json
import os
import threading
import uuid
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

from PIL import Image
import streamlit as st
import torch

from eagle_worker import EagleWorker
from scripts.annotate_video import annotate_video
from scripts.infer_example import _comma_list, _torch_dtype, draw_annotations, prepare_image, run_task

_WORKER_CACHE: dict[tuple[str, str, str], EagleWorker] = {}
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


def _today_dir() -> str:
    return datetime.now().strftime("%Y%m%d")


def _gen_uuid() -> str:
    return str(uuid.uuid4())


def _ensure_output_dir(kind: str) -> Path:
    output_dir = Path("output") / _today_dir()
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def _get_worker(model: str, device: str, dtype: str) -> EagleWorker:
    key = (model, device, dtype)
    with _WORKER_CACHE_LOCK:
        worker = _WORKER_CACHE.get(key)
        if worker is None:
            os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
            worker = EagleWorker(model, device=device, dtype=_torch_dtype(dtype))
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
    question: str = "请详细描述这张图片。",
) -> SimpleNamespace:
    categories = _comma_list(categories_text) if categories_text else []
    if not categories:
        categories = ["person"]
    return SimpleNamespace(
        task=task,
        categories=categories,
        phrase=phrase or "person",
        question=question or "请详细描述这张图片。",
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
    worker: EagleWorker | None = None,
    output_dir: Path | None = None,
    question: str = "请详细描述这张图片。",
):
    if image is None:
        raise ValueError("请先上传图片。")

    if worker is None:
        worker = _get_worker(model, device, dtype)
    task_args = _build_task_args(task, categories_text, phrase, generation_mode, max_new_tokens, temperature, question)
    original_image = image.convert("RGB")
    model_image = prepare_image(original_image, int(max_image_edge))
    answer = run_task(worker, model_image, task_args)
    annotated = draw_annotations(original_image, answer)

    if output_dir is None:
        output_dir = _ensure_output_dir("image")
    output_dir.mkdir(parents=True, exist_ok=True)
    tag = _gen_uuid()
    output_image = output_dir / f"{tag}.jpg"
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
    worker: EagleWorker | None = None,
    output_dir: Path | None = None,
    question: str = "请详细描述这张图片。",
):
    if video_input is None:
        raise ValueError("请先上传视频。")

    video_path = _resolve_video_input_path(video_input)
    if worker is None:
        worker = _get_worker(model, device, dtype)
    task_args = _build_task_args(task, categories_text, phrase, generation_mode, max_new_tokens, temperature, question)

    if output_dir is None:
        output_dir = _ensure_output_dir("video")
    output_dir.mkdir(parents=True, exist_ok=True)
    tag = _gen_uuid()
    output_video = output_dir / f"{tag}.mp4"
    output_json = output_dir / f"{tag}.json"

    args = SimpleNamespace(
        video=video_path,
        model=model,
        task=task_args.task,
        categories=task_args.categories,
        phrase=task_args.phrase,
        question=task_args.question,
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
    question: str = "请详细描述这张图片。",
):
    files = _collect_batch_files(
        input_dir=input_dir,
        include_images=include_images,
        include_videos=include_videos,
        recursive=recursive,
        max_files=int(max_files),
    )
    worker = _get_worker(model, device, dtype)
    task_args = _build_task_args(task, categories_text, phrase, generation_mode, max_new_tokens, temperature, question)

    batch_root = _ensure_output_dir("batch")
    image_out_dir = batch_root
    video_out_dir = batch_root
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
                    question=task_args.question,
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
                    question=task_args.question,
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


def _inject_custom_css() -> None:
    """Inject dark-tech custom CSS theme."""
    st.markdown(
        """
        <style>
        /* ===== Global Dark Theme ===== */
        @import url('https://fonts.googleapis.com/css2?family=Fira+Sans:wght@300;400;500;600;700&family=Fira+Code:wght@400;500;600&display=swap');

        :root {
            --la-bg-primary: #0F172A;
            --la-bg-secondary: #1E293B;
            --la-bg-card: #1E293B;
            --la-bg-input: #0F172A;
            --la-border: #334155;
            --la-accent: #22C55E;
            --la-accent-dim: #16A34A;
            --la-text-primary: #F8FAFC;
            --la-text-secondary: #94A3B8;
            --la-text-muted: #64748B;
            --la-danger: #EF4444;
            --la-warning: #F59E0B;
            --la-info: #3B82F6;
        }

        /* Main background */
        .stApp {
            background: linear-gradient(180deg, #0B1120 0%, #0F172A 100%);
        }

        /* ===== Typography ===== */
        html, body, [class*="css"] {
            font-family: 'Fira Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        code, pre, .stCode, [data-testid="stCode"] {
            font-family: 'Fira Code', 'Cascadia Code', monospace !important;
        }

        /* ===== Header / Hero ===== */
        .la-hero {
            background: linear-gradient(135deg, #1E293B 0%, #0F172A 50%, #1a1a2e 100%);
            border: 1px solid #334155;
            border-radius: 16px;
            padding: 2rem 2.5rem;
            margin-bottom: 1.5rem;
            position: relative;
            overflow: hidden;
        }
        .la-hero::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -20%;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%);
            pointer-events: none;
        }
        .la-hero h1 {
            font-size: 2rem;
            font-weight: 700;
            color: #F8FAFC;
            margin: 0 0 0.25rem 0;
            letter-spacing: -0.02em;
        }
        .la-hero h1 span {
            background: linear-gradient(135deg, #22C55E, #4ADE80);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .la-hero p {
            color: #94A3B8;
            font-size: 0.95rem;
            margin: 0;
            line-height: 1.6;
        }

        /* ===== Metric Cards ===== */
        .la-metrics {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.75rem;
            margin-bottom: 1.5rem;
        }
        .la-metric-card {
            background: #1E293B;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 1rem 1.25rem;
            transition: border-color 0.2s ease;
        }
        .la-metric-card:hover {
            border-color: #22C55E;
        }
        .la-metric-label {
            font-size: 0.75rem;
            font-weight: 500;
            color: #64748B;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.25rem;
        }
        .la-metric-value {
            font-family: 'Fira Code', monospace;
            font-size: 1.1rem;
            font-weight: 600;
            color: #F8FAFC;
        }
        .la-metric-value.la-accent {
            color: #22C55E;
        }

        /* ===== Sidebar ===== */
        [data-testid="stSidebar"] {
            background: linear-gradient(180deg, #0B1120 0%, #0F172A 100%);
            border-right: 1px solid #1E293B;
        }
        [data-testid="stSidebar"] [data-testid="stMarkdown"] h3 {
            color: #F8FAFC;
            font-weight: 600;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid #334155;
            margin-bottom: 1rem;
        }

        /* ===== Tabs ===== */
        .stTabs [data-baseweb="tab-list"] {
            background: #1E293B;
            border-radius: 12px;
            padding: 6px;
            gap: 4px;
            border: 1px solid #334155;
        }
        .stTabs [data-baseweb="tab"] {
            border-radius: 8px;
            padding: 0.6rem 1.5rem;
            font-weight: 500;
            font-size: 0.9rem;
            color: #94A3B8;
            background: transparent;
            border: none;
            transition: all 0.2s ease;
        }
        .stTabs [aria-selected="true"] {
            background: #0F172A !important;
            color: #22C55E !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .stTabs [data-baseweb="tab-highlight"] {
            display: none;
        }
        .stTabs [data-baseweb="tab-border"] {
            display: none;
        }

        /* ===== Form Containers ===== */
        .stForm {
            background: #1E293B;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 1.5rem;
        }

        /* ===== Input Fields ===== */
        .stTextInput > div > div > input,
        .stTextArea > div > div > textarea {
            background: #0F172A;
            border: 1px solid #334155;
            border-radius: 8px;
            color: #F8FAFC;
            font-family: 'Fira Sans', sans-serif;
            transition: border-color 0.2s ease;
        }
        .stTextInput > div > div > input:focus,
        .stTextArea > div > div > textarea:focus {
            border-color: #22C55E;
            box-shadow: 0 0 0 2px rgba(34,197,94,0.15);
        }

        /* ===== Select Boxes ===== */
        .stSelectbox > div > div {
            background: #0F172A;
            border: 1px solid #334155;
            border-radius: 8px;
            color: #F8FAFC;
        }

        /* ===== Sliders ===== */
        .stSlider > div > div > div > div {
            background: #22C55E;
        }

        /* ===== Buttons ===== */
        .stButton > button {
            background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
            color: #FFFFFF;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.9rem;
            padding: 0.6rem 2rem;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(34,197,94,0.25);
        }
        .stButton > button:hover {
            box-shadow: 0 4px 16px rgba(34,197,94,0.35);
            transform: translateY(-1px);
        }
        .stButton > button:active {
            transform: translateY(0);
        }

        /* Form submit button */
        .stFormSubmitButton > button {
            background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
            color: #FFFFFF;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.95rem;
            padding: 0.7rem 2.5rem;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(34,197,94,0.25);
            width: 100%;
        }
        .stFormSubmitButton > button:hover {
            box-shadow: 0 4px 16px rgba(34,197,94,0.35);
            transform: translateY(-1px);
        }

        /* Download buttons */
        .stDownloadButton > button {
            background: #0F172A;
            color: #22C55E;
            border: 1px solid #22C55E;
            border-radius: 8px;
            font-weight: 500;
            padding: 0.5rem 1.5rem;
            transition: all 0.2s ease;
        }
        .stDownloadButton > button:hover {
            background: rgba(34,197,94,0.1);
            border-color: #4ADE80;
        }

        /* ===== File Uploader ===== */
        [data-testid="stFileUploader"] {
            border: 2px dashed #334155;
            border-radius: 12px;
            padding: 0.5rem;
            transition: border-color 0.2s ease;
        }
        [data-testid="stFileUploader"]:hover {
            border-color: #22C55E;
        }

        /* ===== Expander ===== */
        .streamlit-expanderHeader {
            background: #1E293B;
            border: 1px solid #334155;
            border-radius: 8px;
            font-weight: 500;
        }

        /* ===== Success / Error / Warning ===== */
        .stAlert {
            border-radius: 8px;
            border-left-width: 4px;
        }

        /* ===== Result Section ===== */
        .la-result-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 1.5rem 0 0.75rem 0;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid #334155;
        }
        .la-result-header h3 {
            font-size: 1rem;
            font-weight: 600;
            color: #F8FAFC;
            margin: 0;
        }
        .la-result-header .la-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #22C55E;
            box-shadow: 0 0 6px rgba(34,197,94,0.5);
        }

        /* ===== Divider ===== */
        hr {
            border-color: #1E293B !important;
            margin: 1.5rem 0 !important;
        }

        /* ===== Footer ===== */
        .la-footer {
            text-align: center;
            padding: 2rem 0 1rem 0;
            color: #475569;
            font-size: 0.8rem;
        }
        .la-footer a {
            color: #22C55E;
            text-decoration: none;
        }

        /* ===== Checkbox ===== */
        .stCheckbox > label > span:first-child {
            border-color: #334155;
        }

        /* ===== Number Input ===== */
        .stNumberInput > div > div > input {
            background: #0F172A;
            border: 1px solid #334155;
            border-radius: 8px;
            color: #F8FAFC;
        }

        /* ===== Spinner ===== */
        .stSpinner > div {
            border-top-color: #22C55E;
        }

        /* ===== Responsive ===== */
        @media (max-width: 768px) {
            .la-metrics {
                grid-template-columns: 1fr;
            }
            .la-hero {
                padding: 1.5rem;
            }
            .la-hero h1 {
                font-size: 1.5rem;
            }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def _render_streamlit(defaults: argparse.Namespace) -> None:
    st.set_page_config(
        page_title="LocateAnything · Visual Grounding",
        page_icon="🎯",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    _inject_custom_css()

    # ── Hero Header ──
    st.markdown(
        """
        <div class="la-hero">
            <h1>🎯 <span>LocateAnything</span></h1>
            <p>基于视觉语言模型的快速视觉定位与目标检测工具。支持图片/视频标注、目标检测、短语定位、文本检测与 GUI 元素定位。</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # ── Sidebar ──
    _MODEL_PRESETS = {
        "LocateAnything-3B（视觉定位）": "nvidia/LocateAnything-3B",
        "Eagle2-9B（通用 VLM + 定位）": "nvidia/Eagle2-9B",
        "Eagle2.5-8B（长上下文 VLM）": "nvidia/Eagle2.5-8B",
        "Eagle2-2B（轻量级）": "nvidia/Eagle2-2B",
        "Eagle2-1B（最轻量）": "nvidia/Eagle2-1B",
        "自定义路径": "",
    }
    _LOCATEANYTHING_MODELS = {"nvidia/LocateAnything-3B"}

    with st.sidebar:
        st.markdown("### ⚙️ 模型配置")
        preset_label = st.selectbox(
            "模型预设",
            options=list(_MODEL_PRESETS.keys()),
            index=0 if defaults.model in _MODEL_PRESETS.values() else len(_MODEL_PRESETS) - 1,
            help="选择预设模型或自定义路径",
        )
        preset_path = _MODEL_PRESETS[preset_label]
        if preset_path:
            model = preset_path
        else:
            model = st.text_input("模型路径", value=defaults.model, help="HuggingFace 模型 ID 或本地路径")
        device = st.selectbox("计算设备", options=["cuda", "cpu"], index=0 if defaults.device == "cuda" else 1, help="CUDA 需要 NVIDIA GPU 支持")
        dtype = st.selectbox("推理精度", options=["bfloat16", "float16", "float32"], index=["bfloat16", "float16", "float32"].index(defaults.dtype), help="bfloat16 推荐用于 Hopper/Blackwell GPU")

        st.markdown("---")
        st.markdown("### 📖 使用说明")
        st.markdown(
            """
            <div style="color: #94A3B8; font-size: 0.85rem; line-height: 1.7;">
                <b>1.</b> 选择任务类型与参数<br>
                <b>2.</b> 上传图片或视频<br>
                <b>3.</b> 点击开始标注<br>
                <b>4.</b> 查看结果并下载
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown("---")
        st.markdown(
            """
            <div style="color: #475569; font-size: 0.75rem; text-align: center;">
                Eagle Vision-Language Models v1.0<br>
                LocateAnything · Eagle2 · Eagle2.5
            </div>
            """,
            unsafe_allow_html=True,
        )

    # Determine if current model is LocateAnything (supports PBD)
    is_locateanything = model in _LOCATEANYTHING_MODELS

    # ── System Status Metrics ──
    device_color = "la-accent" if device == "cuda" else ""
    st.markdown(
        f"""
        <div class="la-metrics">
            <div class="la-metric-card">
                <div class="la-metric-label">模型</div>
                <div class="la-metric-value">{model.split('/')[-1]}</div>
            </div>
            <div class="la-metric-card">
                <div class="la-metric-label">设备</div>
                <div class="la-metric-value {device_color}">{device.upper()}</div>
            </div>
            <div class="la-metric-card">
                <div class="la-metric-label">精度</div>
                <div class="la-metric-value">{dtype}</div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # ── Tabs ──
    image_tab, video_tab, batch_tab = st.tabs(["🖼️ 图片标注", "🎬 视频标注", "📁 批量标注"])

    with image_tab:
        st.markdown("#### 📤 上传与配置")
        with st.form("image_form"):
            uploaded_image = st.file_uploader(
                "拖拽或点击上传图片",
                type=["jpg", "jpeg", "png", "bmp", "webp"],
                help="支持 JPG / PNG / BMP / WebP 格式",
            )
            _IMAGE_TASKS = (
                ["detect", "ground_multi", "detect_text", "point", "ground_gui", "chat"]
                if not is_locateanything
                else ["detect", "ground_multi", "detect_text", "point", "ground_gui"]
            )
            _IMAGE_TASK_HELP = {
                "detect": "目标检测",
                "ground_multi": "短语定位",
                "detect_text": "文本检测",
                "point": "点定位",
                "ground_gui": "GUI定位",
                "chat": "💬 图像对话（通用 VQA）",
            }
            img_col1, img_col2 = st.columns(2)
            with img_col1:
                image_task = st.selectbox(
                    "任务类型",
                    options=_IMAGE_TASKS,
                    index=1,
                    format_func=lambda t: f"{t} — {_IMAGE_TASK_HELP.get(t, '')}",
                )
                image_categories = st.text_input("检测类别（detect 用，逗号分隔）", value="person")
                image_phrase = st.text_input("描述短语", value="猫", help="用于 ground_multi / ground_text 等任务")
                image_question = st.text_input("💬 对话问题", value="请详细描述这张图片。", help="用于 chat 任务", key="image_question")
            with img_col2:
                if is_locateanything:
                    image_mode = st.selectbox("生成模式", options=["fast", "slow", "hybrid"], index=2, help="fast=单步解码, slow=自回归, hybrid=自动切换")
                else:
                    image_mode = "hybrid"
                image_tokens = st.slider("max_new_tokens", min_value=1, max_value=2048, value=128, step=1)
                image_edge = st.slider("max_image_edge", min_value=128, max_value=2048, value=int(defaults.max_image_edge), step=64)
                image_temp = st.slider("temperature", min_value=0.0, max_value=1.5, value=0.7, step=0.05)
            image_submit = st.form_submit_button("▶ 开始图片标注")

        if image_submit:
            if uploaded_image is None:
                st.error("请先上传图片。")
            else:
                image = Image.open(uploaded_image).convert("RGB")
                with st.spinner("⏳ 正在执行图片标注，请稍候..."):
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
                        question=image_question,
                    )

                st.session_state.image_result = {
                    "annotated": annotated,
                    "json_path": json_path,
                    "answer": answer,
                    "summary": summary,
                }
                st.rerun()

        if "image_result" in st.session_state:
            result = st.session_state.image_result
            annotated = result["annotated"]
            json_path = result["json_path"]
            answer = result["answer"]
            summary = result["summary"]

            st.markdown(
                '<div class="la-result-header"><div class="la-dot"></div><h3>标注结果</h3></div>',
                unsafe_allow_html=True,
            )
            st.image(annotated, caption="标注结果", use_container_width=True)

            res_col1, res_col2 = st.columns(2)
            with res_col1:
                st.markdown("##### 模型输出")
                st.code(answer, language=None)
            with res_col2:
                st.markdown("##### 执行信息")
                st.code(summary, language=None)

            dl_col1, dl_col2 = st.columns(2)
            image_buffer = io.BytesIO()
            annotated.save(image_buffer, format="JPEG")
            with dl_col1:
                st.download_button(
                    label="📥 下载标注图片",
                    data=image_buffer.getvalue(),
                    file_name=f"{Path(json_path).stem}_annotated.jpg",
                    mime="image/jpeg",
                    use_container_width=True,
                )
            with dl_col2:
                st.download_button(
                    label="📥 下载结果 JSON",
                    data=Path(json_path).read_bytes(),
                    file_name=Path(json_path).name,
                    mime="application/json",
                    use_container_width=True,
                )

    with video_tab:
        st.markdown("#### 📤 上传与配置")
        with st.form("video_form"):
            uploaded_video = st.file_uploader(
                "拖拽或点击上传视频",
                type=["mp4", "mov", "avi", "mkv"],
                help="支持 MP4 / MOV / AVI / MKV 格式",
            )
            _VIDEO_TASKS = (
                ["detect", "ground_multi", "detect_text", "point", "ground_gui", "chat"]
                if not is_locateanything
                else ["detect", "ground_multi", "detect_text", "point", "ground_gui"]
            )
            vid_col1, vid_col2 = st.columns(2)
            with vid_col1:
                video_task = st.selectbox("任务类型", options=_VIDEO_TASKS, index=1, key="video_task")
                video_categories = st.text_input("检测类别（detect 用，逗号分隔）", value="person", key="video_categories")
                video_phrase = st.text_input("描述短语", value="猫", key="video_phrase")
                video_question = st.text_input("💬 对话问题", value="请详细描述这张图片。", help="用于 chat 任务", key="video_question")
                if is_locateanything:
                    video_mode = st.selectbox("生成模式", options=["fast", "slow", "hybrid"], index=2, key="video_mode")
                else:
                    video_mode = "hybrid"
            with vid_col2:
                video_tokens = st.slider("max_new_tokens", min_value=1, max_value=512, value=64, step=1, key="video_tokens")
                video_edge = st.slider("max_image_edge", min_value=128, max_value=1280, value=384, step=64, key="video_edge")
                video_temp = st.slider("temperature", min_value=0.0, max_value=1.5, value=0.7, step=0.05, key="video_temp")
                every_n_frames = st.number_input("采样间隔帧数", min_value=1, value=10, step=1, help="每 N 帧推理一次")
                max_frames = st.number_input("最大处理帧数", min_value=0, value=0, step=1, help="0 = 处理全部帧")
                reuse_last = st.checkbox("未推理帧复用上一帧结果", value=True)
            video_submit = st.form_submit_button("▶ 开始视频标注")

        if video_submit:
            if uploaded_video is None:
                st.error("请先上传视频。")
            else:
                video_input_dir = _ensure_output_dir("video")
                input_path = video_input_dir / f"{_gen_uuid()}_input{Path(uploaded_video.name).suffix or '.mp4'}"
                input_path.write_bytes(uploaded_video.read())

                with st.spinner("⏳ 正在执行视频标注，这可能需要较长时间..."):
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
                        question=video_question,
                    )

                st.session_state.video_result = {
                    "output_video": output_video,
                    "output_json": output_json,
                    "summary": summary,
                }
                st.rerun()

        if "video_result" in st.session_state:
            result = st.session_state.video_result
            output_video = result["output_video"]
            output_json = result["output_json"]
            summary = result["summary"]

            st.markdown(
                '<div class="la-result-header"><div class="la-dot"></div><h3>标注结果</h3></div>',
                unsafe_allow_html=True,
            )
            st.video(output_video)

            st.markdown("##### 执行信息")
            st.code(summary, language=None)

            dl_col1, dl_col2 = st.columns(2)
            with dl_col1:
                st.download_button(
                    label="📥 下载标注视频",
                    data=Path(output_video).read_bytes(),
                    file_name=Path(output_video).name,
                    mime="video/mp4",
                    use_container_width=True,
                )
            with dl_col2:
                st.download_button(
                    label="📥 下载结果 JSON",
                    data=Path(output_json).read_bytes(),
                    file_name=Path(output_json).name,
                    mime="application/json",
                    use_container_width=True,
                )

    with batch_tab:
        st.markdown("#### 📂 文件夹批量处理")
        with st.form("batch_form"):
            _BATCH_TASKS = (
                ["detect", "ground_multi", "detect_text", "point", "ground_gui", "chat"]
                if not is_locateanything
                else ["detect", "ground_multi", "detect_text", "point", "ground_gui"]
            )
            batch_col1, batch_col2 = st.columns(2)
            with batch_col1:
                st.markdown("##### 输入设置")
                input_dir = st.text_input("本地文件夹路径", value="", help="输入包含图片/视频的文件夹绝对路径")
                include_images = st.checkbox("处理图片", value=True)
                include_videos = st.checkbox("处理视频", value=False)
                recursive = st.checkbox("递归子目录", value=True)
                max_files = st.number_input("最多处理文件数", min_value=0, value=0, step=1, help="0 = 不限制")
            with batch_col2:
                st.markdown("##### 推理参数")
                batch_task = st.selectbox("任务类型", options=_BATCH_TASKS, index=1, key="batch_task")
                batch_categories = st.text_input("检测类别（detect 用，逗号分隔）", value="person", key="batch_categories")
                batch_phrase = st.text_input("描述短语", value="猫", key="batch_phrase")
                batch_question = st.text_input("💬 对话问题", value="请详细描述这张图片。", help="用于 chat 任务", key="batch_question")
                if is_locateanything:
                    batch_mode = st.selectbox("生成模式", options=["fast", "slow", "hybrid"], index=2, key="batch_mode")
                else:
                    batch_mode = "hybrid"
                batch_tokens = st.slider("max_new_tokens", min_value=1, max_value=512, value=64, step=1, key="batch_tokens")
                batch_edge = st.slider("max_image_edge", min_value=128, max_value=2048, value=768, step=64, key="batch_edge")
                batch_temp = st.slider("temperature", min_value=0.0, max_value=1.5, value=0.7, step=0.05, key="batch_temp")
                batch_every_n = st.number_input("采样间隔帧数（视频）", min_value=1, value=10, step=1, key="batch_every_n")
                batch_max_frames = st.number_input("最大处理帧数（视频）", min_value=0, value=0, step=1, key="batch_max_frames", help="0 = 处理全部帧")
                batch_reuse_last = st.checkbox("未推理帧复用上一帧结果（视频）", value=True, key="batch_reuse_last")
            batch_submit = st.form_submit_button("▶ 开始批量标注")

        if batch_submit:
            if not input_dir.strip():
                st.error("请先输入本地文件夹路径。")
            else:
                with st.spinner("⏳ 正在批量标注，这可能需要较长时间..."):
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
                            question=batch_question,
                        )
                    except Exception as exc:
                        st.error(str(exc))
                    else:
                        st.session_state.batch_result = {
                            "summary_json": summary_json,
                            "summary_text": summary_text,
                        }
                        st.rerun()

        if "batch_result" in st.session_state:
            result = st.session_state.batch_result
            summary_json = result["summary_json"]
            summary_text = result["summary_text"]

            st.markdown(
                '<div class="la-result-header"><div class="la-dot"></div><h3>批量标注完成</h3></div>',
                unsafe_allow_html=True,
            )
            st.markdown("##### 执行信息")
            st.code(summary_text, language=None)
            st.download_button(
                label="📥 下载批处理汇总 JSON",
                data=Path(summary_json).read_bytes(),
                file_name=Path(summary_json).name,
                mime="application/json",
                use_container_width=True,
            )

    # ── Footer ──
    st.markdown(
        """
        <div class="la-footer">
            Eagle Vision-Language Models · LocateAnything · Eagle2 · Eagle2.5<br>
            Parallel Box Decoding · SigLIP + ConvNeXt · Moon-ViT + Qwen2
        </div>
        """,
        unsafe_allow_html=True,
    )


def main(argv: list[str] | None = None) -> int:
    defaults = parse_args(argv)
    _render_streamlit(defaults)
    return 0


if __name__ == "__main__":
    import subprocess
    import sys

    # When run via `python -m scripts.web_ui`, auto-launch Streamlit server
    # so the user doesn't need to remember `streamlit run` syntax.
    script_path = str(Path(__file__).resolve())
    # Collect user args (--model, --device, etc.) to forward after --
    user_args = sys.argv[1:]
    cmd = [
        sys.executable, "-m", "streamlit", "run", script_path,
        "--server.headless=false",
    ]
    if user_args:
        cmd += ["--"] + user_args
    raise SystemExit(subprocess.call(cmd))
