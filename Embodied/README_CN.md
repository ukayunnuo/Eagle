# LocateAnything

> **快速、高质量的视觉语言定位模型 — 基于并行框解码（Parallel Box Decoding）**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-green.svg)](../LICENSE)
[![Model License](https://img.shields.io/badge/Model-NVIDIA_License-blue.svg)](LICENSE_MODEL)

[📄 论文](https://arxiv.org/abs/2605.27365) · [🤗 模型权重](https://huggingface.co/nvidia/LocateAnything-3B) · [🌐 项目主页](https://nvlabs.github.io/EAGLE/)

---

## 📖 项目简介

**LocateAnything** 是一个基于视觉语言模型（VLM）的通用视觉定位系统，能够对图片和视频中的目标进行**检测、定位、文本识别和 GUI 元素定位**。

### 核心特性

| 特性 | 说明 |
|------|------|
| **并行框解码（PBD）** | 单次前向传播同时预测所有边界框/点，无需逐个自回归生成 |
| **高吞吐** | 12.7 BPS 吞吐量，是 Qwen3-VL 的 **10 倍**，Rex-Omni 的 **2.5 倍** |
| **混合推理** | 支持 fast（MTP 单步）、slow（NTP 自回归）、hybrid（自动切换）三种模式 |
| **大规模训练** | 基于 1.38 亿训练样本、7.85 亿个边界框、1200 万张图片 |
| **6 大任务** | 目标检测、短语定位、多目标定位、文本检测、点定位、GUI 元素定位 |

### 模型架构

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Moon-ViT    │────▶│  MLP Projector   │────▶│   Qwen2.5    │
│ 视觉编码器   │     │    特征映射       │     │  语言解码器   │
└──────────────┘     └──────────────────┘     └──────────────┘
   图像输入                                        文本 + 坐标输出
```

### 基准测试结果

| 数据集 | 指标 | LocateAnything-3B |
|--------|------|-------------------|
| LVIS | AP | **50.7** |
| COCO | AP | **54.7** |
| ScreenSpot-Pro | Acc | **60.3** |
| Dense200 | mIoU | SOTA |
| RefCOCOg | Acc | SOTA |

---

## 🚀 快速开始

### 环境要求

- Python >= 3.8
- PyTorch >= 2.0
- CUDA（推荐，CPU 亦可运行但速度较慢）
- GPU 显存建议 >= 8GB

### 安装

```bash
# 克隆仓库
git clone https://github.com/NVlabs/Eagle.git
cd Eagle/Embodied

# 创建虚拟环境（推荐）
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows
.venv\Scripts\activate

# 安装依赖
pip install -e .
```

> **Windows 用户注意：** `deepspeed`、`liger_kernel`、`triton` 三个包仅用于分布式训练，在 Windows 上可能因缺少 CUDA 编译环境而安装失败。可修改 `pyproject.toml` 添加平台标记跳过：
> ```
> "deepspeed==0.15.4; platform_system != 'Windows'"
> "liger_kernel==0.3.1; platform_system != 'Windows'"
> "triton>=3.1.0; platform_system != 'Windows'"
> ```
> 推理功能不受影响。

### 命令行推理

```python
from locateanything_worker import LocateAnythingWorker

worker = LocateAnythingWorker("nvidia/LocateAnything-3B")

# 目标检测
result = worker.detect("image.jpg", categories=["person", "car"])

# 短语定位
result = worker.ground_single("image.jpg", phrase="一只黑色的猫")

# 文本检测（OCR）
result = worker.detect_text("image.jpg")

# GUI 元素定位
result = worker.ground_gui("screenshot.png", phrase="登录按钮")

# 点定位
result = worker.point("image.jpg", phrase="树顶")
```

### 输出格式

模型输出使用 `<ref>` 和 `<box>` 标签，坐标为 `[0, 1000]` 范围的归一化整数：

```
<ref>person</ref><box><120><340><560><780></box>
```

实际坐标 = 模型输出值 / 1000 × 图像尺寸。

---

## 🖥️ Web UI 使用

项目提供了基于 Streamlit 的本地 Web 界面，支持图片/视频标注和批量处理。

### 启动

```bash
python -m scripts.web_ui --model nvidia/LocateAnything-3B
```

### 带参数启动

```bash
python -m scripts.web_ui \
  --model nvidia/LocateAnything-3B \
  --device cuda \
  --dtype bfloat16 \
  --max-image-edge 768
```

启动后在浏览器打开 `http://localhost:7860`。

### 功能说明

| 标签页 | 功能 | 说明 |
|--------|------|------|
| 🖼️ 图片标注 | 单张图片推理 | 上传图片 → 选择任务 → 查看结果 → 下载 |
| 🎬 视频标注 | 逐帧视频推理 | 上传视频 → 配置采样间隔 → 导出标注视频 |
| 📁 批量标注 | 文件夹批量处理 | 输入本地路径 → 自动处理所有图片/视频 |

### 参数建议

| 参数 | 图片推荐 | 视频推荐 | 说明 |
|------|----------|----------|------|
| `max_image_edge` | 768 | 384 | 越大越精细，显存占用越高 |
| `max_new_tokens` | 128 | 64 | 目标多时适当增大 |
| `every_n_frames` | — | 10 | 每 N 帧推理一次 |
| `max_frames` | — | 0（全部） | 限制处理帧数以节省时间 |

### 输出位置

```
logs/webui/
├── image/          # 单张图片标注结果
├── video/          # 视频标注结果
└── batch/          # 批量标注结果
    └── <时间戳>/
        ├── image/
        ├── video/
        └── batch_summary.json
```

---

## 🏋️ 训练

### 数据准备

训练数据使用 ShareGPT 风格的 JSONL 格式：

```json
{
  "conversations": [
    {"from": "human", "value": "<image>\n请检测图中的 <ref>person</ref>"},
    {"from": "gpt", "value": "<ref>person</ref><box><120><340><560><780></box>"}
  ],
  "image": "path/to/image.jpg"
}
```

数据配方（Recipe）使用 JSON 文件定义：

```json
{
  "dataset_name": {
    "annotation": "path/to/annotations.jsonl",
    "root": "path/to/images/",
    "repeat_time": 1.0,
    "data_augment": false
  }
}
```

### 单机训练（8× GPU）

```bash
torchrun --nproc_per_node=8 eaglevl/train/locany_finetune_magi_stream.py \
  --model_name_or_path nvidia/LocateAnything-3B \
  --meta_path "./locany_recipe/your_recipe.json" \
  --output_dir work_dirs/my_sft \
  --attn_implementation magi \
  --deepspeed "deepspeed_configs/zero_stage2_config.json"
```

### 注意力实现选择

| 实现 | 适用 GPU | 最大序列长度 | 说明 |
|------|----------|-------------|------|
| `magi` | Hopper / Blackwell | 32K+ | 推荐，性能最优 |
| `sdpa` | 其他 GPU（A100/L40 等） | ~4K | 通用兼容 |

> 详细训练指南参见 [document/TRAINING.md](document/TRAINING.md)

---

## 📊 评测

### 安装评测依赖

```bash
# 安装 fastevaluate（C++ COCO AP 评估器）
git clone https://github.com/Mountchicken/Rex-Omni.git
cd Rex-Omni/fastevaluate
pip install -e .
```

### 下载评测数据

```bash
# 从 HuggingFace 下载
huggingface-cli download Mountchicken/Rex-Omni-EvalData --local-dir ./EvalData
huggingface-cli download likaixin/ScreenSpot-Pro --local-dir ./ScreenSpot-Pro
```

### 运行评测

```bash
# COCO 评测
bash evaluation/scripts/eval_coco.sh \
  --model_path nvidia/LocateAnything-3B \
  --test_jsonl <jsonl> \
  --image_root <root> \
  --output_dir <dir>

# LVIS 评测
bash evaluation/scripts/eval_lvis.sh \
  --model_path nvidia/LocateAnything-3B \
  --test_jsonl <jsonl> \
  --image_root <root> \
  --output_dir <dir>

# 定位评测（Dense200, DocLayNet, HumanRef, RefCOCOg, VisDrone 等）
bash evaluation/scripts/eval_grounding.sh \
  --dataset Dense200 \
  --eval_type box_eval \
  --model_path nvidia/LocateAnything-3B \
  --image_root <root> \
  --output_base <base>

# ScreenSpot-Pro 评测
bash evaluation/scripts/eval_sspro.sh \
  --model_path nvidia/LocateAnything-3B \
  --test_jsonl <jsonl> \
  --image_root <root> \
  --output_dir <dir>
```

> 详细评测指南参见 [evaluation/README.md](evaluation/README.md)

---

## 📁 项目结构

```
Embodied/
├── eaglevl/                     # 核心 Python 包
│   ├── model/
│   │   ├── locany/              # LocateAnything 模型定义
│   │   └── moon_vit/            # Moon-ViT 视觉编码器
│   ├── train/                   # 训练入口、数据集、参数
│   ├── patch/                   # 性能优化补丁（融合算子、流式 Packing）
│   ├── sp_utils/                # 序列并行（Ring/Ulysses Attention）
│   └── utils/                   # 推理时使用的工具函数
├── scripts/
│   ├── web_ui.py                # Streamlit Web UI
│   ├── infer_example.py         # 单图推理脚本
│   └── annotate_video.py        # 视频标注脚本
├── evaluation/                  # 评测脚本和指标计算
├── document/                    # 详细文档
│   ├── TRAINING.md              # 训练指南
│   ├── DATA_PREPARATION.md      # 数据准备
│   ├── STREAMING_PACKING.md     # 流式 Packing 算法
│   └── RESULTS.md               # 详细结果
├── deepspeed_configs/           # DeepSpeed 配置
├── tests/                       # 单元测试
├── locateanything_worker.py     # 推理 Worker 封装
├── pyproject.toml               # 包元数据与依赖
└── README_CN.md                 # 本文档
```

---

## 🔧 运行测试

```bash
python -m pytest tests/ -v
```

---

## 📚 文档索引

| 文档 | 内容 |
|------|------|
| [TRAINING.md](document/TRAINING.md) | 完整训练指南：参数、多节点、流式 Packing、断点续训 |
| [DATA_PREPARATION.md](document/DATA_PREPARATION.md) | 数据格式、Recipe JSON、任务标注约定 |
| [STREAMING_PACKING.md](document/STREAMING_PACKING.md) | 在线 Packing 算法详解 |
| [evaluation/README.md](evaluation/README.md) | 评测环境搭建和数据集下载 |

---

## 📜 引用

如果本项目对您的研究有帮助，请引用：

```bibtex
@article{wang2026locateanything,
  title={LocateAnything: Fast and High-Quality Vision-Language Grounding with Parallel Box Decoding},
  author={Wang, Yunnan and others},
  journal={arXiv preprint arXiv:2605.27365},
  year={2026}
}
```

---

## 📄 许可证

- **代码**：[Apache License 2.0](../LICENSE)
- **模型权重**：[NVIDIA License](LICENSE_MODEL)

---

## 🙏 致谢

- [Rex-Omni](https://github.com/Mountchicken/Rex-Omni) — 评测框架
- [Qwen2.5](https://github.com/QwenLM/Qwen2.5) — 语言模型基座
- [timm](https://github.com/huggingface/pytorch-image-models) — 视觉模型工具库
- [DeepSpeed](https://github.com/microsoft/DeepSpeed) — 分布式训练框架
