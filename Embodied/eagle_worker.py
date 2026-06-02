# Copyright (c) 2026, NVIDIA CORPORATION.  All rights reserved.
#
# NVIDIA CORPORATION and its licensors retain all intellectual property
# and proprietary rights in and to this software, related documentation
# and any modifications thereto.  Any use, reproduction, disclosure or
# distribution of this software and related documentation without an express
# license agreement from NVIDIA CORPORATION is strictly prohibited.

"""
eagle_worker.py - A unified worker supporting both LocateAnything and Eagle2 models.

Supported models:
  - nvidia/LocateAnything-3B  (grounding + detection with PBD)
  - nvidia/Eagle2-9B          (general VLM + grounding)
  - nvidia/Eagle2.5-8B        (long-context VLM + grounding)
  - nvidia/Eagle2-1B / 2B     (lightweight VLM)
"""
import re
from typing import Optional

import torch
from PIL import Image
from transformers import AutoModel, AutoTokenizer, AutoProcessor


# ---------------------------------------------------------------------------
# Model family detection
# ---------------------------------------------------------------------------

_LOCATEANYTHING_TYPES = {"locateanything"}
_EAGLE2_TYPES = {"eagle_2_5_vl", "eagle2", "eagle2_vl"}


def _detect_model_family(config) -> str:
    """Return 'locateanything' or 'eagle2' based on the model config."""
    model_type = getattr(config, "model_type", "")
    if model_type in _LOCATEANYTHING_TYPES:
        return "locateanything"
    if model_type in _EAGLE2_TYPES:
        return "eagle2"
    # Fallback: check auto_map for clues
    auto_map = getattr(config, "auto_map", {})
    for v in auto_map.values():
        if "locateanything" in v.lower():
            return "locateanything"
        if "eagle" in v.lower():
            return "eagle2"
    return "eagle2"


# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------

class EagleWorker:
    """Unified worker that loads any Eagle-family model once and serves queries."""

    def __init__(self, model_path: str, device: str = "cuda", dtype=torch.bfloat16):
        self.device = device
        self.dtype = dtype
        self.model_path = model_path

        self.tokenizer = AutoTokenizer.from_pretrained(
            model_path, trust_remote_code=True
        )
        self.processor = AutoProcessor.from_pretrained(
            model_path, trust_remote_code=True, use_fast=True
        )
        self.model = AutoModel.from_pretrained(
            model_path,
            torch_dtype=dtype,
            trust_remote_code=True,
            attn_implementation="flash_attention_2",
        ).to(device).eval()

        self.family = _detect_model_family(self.model.config)

    # ------------------------------------------------------------------
    # Core predict
    # ------------------------------------------------------------------

    @torch.no_grad()
    def predict(
        self,
        image: Image.Image,
        question: str,
        generation_mode: str = "hybrid",
        max_new_tokens: int = 2048,
        temperature: float = 0.7,
        verbose: bool = True,
    ) -> dict:
        """Run a single perception query.

        Args:
            image: PIL Image (RGB).
            question: The task prompt.
            generation_mode: "fast" | "slow" | "hybrid" (LocateAnything only).
            max_new_tokens: Maximum tokens to generate.
            temperature: Sampling temperature (0 = greedy).
            verbose: If True, return timing statistics (LocateAnything only).

        Returns:
            dict with keys: "answer", "stats" (optional), "history" (optional).
        """
        messages = [
            {"role": "user", "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": question},
            ]}
        ]

        if self.family == "locateanything":
            return self._predict_locateanything(
                messages, generation_mode, max_new_tokens, temperature, verbose
            )
        else:
            return self._predict_eagle2(messages, max_new_tokens, temperature)

    def _predict_locateanything(
        self, messages, generation_mode, max_new_tokens, temperature, verbose
    ) -> dict:
        """Inference path for LocateAnything models (PBD/MTP/Hybrid)."""
        text = self.processor.py_apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        images, videos = self.processor.process_vision_info(messages)
        inputs = self.processor(
            text=[text], images=images, videos=videos, return_tensors="pt"
        ).to(self.device)

        pixel_values = inputs["pixel_values"].to(self.dtype)
        input_ids = inputs["input_ids"]
        image_grid_hws = inputs.get("image_grid_hws", None)

        response = self.model.generate(
            pixel_values=pixel_values,
            input_ids=input_ids,
            attention_mask=inputs["attention_mask"],
            image_grid_hws=image_grid_hws,
            tokenizer=self.tokenizer,
            max_new_tokens=max_new_tokens,
            use_cache=True,
            generation_mode=generation_mode,
            temperature=temperature,
            do_sample=True,
            top_p=0.9,
            repetition_penalty=1.1,
            verbose=verbose,
        )

        result = {"answer": response[0] if isinstance(response, tuple) else response}
        if isinstance(response, tuple) and len(response) >= 3:
            result["history"] = response[1]
            result["stats"] = response[2]
        return result

    def _predict_eagle2(self, messages, max_new_tokens, temperature) -> dict:
        """Inference path for Eagle2 / Eagle2.5 models (standard generate)."""
        text = self.processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        images, videos = self.processor.process_vision_info(messages)
        inputs = self.processor(
            text=[text], images=images, videos=videos, return_tensors="pt"
        ).to(self.device)

        gen_kwargs = dict(
            max_new_tokens=max_new_tokens,
            do_sample=temperature > 0,
        )
        if temperature > 0:
            gen_kwargs["temperature"] = temperature
            gen_kwargs["top_p"] = 0.95

        generated_ids = self.model.generate(**inputs, **gen_kwargs)

        # Trim the input tokens from the output
        input_len = inputs["input_ids"].shape[1]
        output_ids = generated_ids[:, input_len:]
        answer = self.processor.batch_decode(
            output_ids, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0].strip()

        return {"answer": answer}

    # ------------------------------------------------------------------
    # Grounding / Detection tasks (prompt-engineered for all models)
    # ------------------------------------------------------------------

    def detect(self, image: Image.Image, categories: list[str], **kwargs) -> dict:
        """Object detection / document layout analysis."""
        cats = "</c>".join(categories)
        prompt = f"Locate all the instances that matches the following description: {cats}."
        return self.predict(image, prompt, **kwargs)

    def ground_single(self, image: Image.Image, phrase: str, **kwargs) -> dict:
        """Phrase grounding — single instance."""
        prompt = f"Locate a single instance that matches the following description: {phrase}."
        return self.predict(image, prompt, **kwargs)

    def ground_multi(self, image: Image.Image, phrase: str, **kwargs) -> dict:
        """Phrase grounding — multiple instances."""
        prompt = f"Locate all the instances that match the following description: {phrase}."
        return self.predict(image, prompt, **kwargs)

    def ground_text(self, image: Image.Image, phrase: str, **kwargs) -> dict:
        """Text grounding."""
        prompt = f"Please locate the text referred as {phrase}."
        return self.predict(image, prompt, **kwargs)

    def detect_text(self, image: Image.Image, **kwargs) -> dict:
        """Scene text detection."""
        prompt = "Detect all the text in box format."
        return self.predict(image, prompt, **kwargs)

    def ground_gui(
        self, image: Image.Image, phrase: str, output_type: str = "box", **kwargs
    ) -> dict:
        """GUI grounding (box or point)."""
        if output_type == "point":
            prompt = f"Point to: {phrase}."
        else:
            prompt = f"Locate the region that matches the following description: {phrase}."
        return self.predict(image, prompt, **kwargs)

    def point(self, image: Image.Image, phrase: str, **kwargs) -> dict:
        """Pointing."""
        prompt = f"Point to: {phrase}."
        return self.predict(image, prompt, **kwargs)

    # ------------------------------------------------------------------
    # General VQA / Chat
    # ------------------------------------------------------------------

    def chat(self, image: Image.Image, question: str, **kwargs) -> dict:
        """General visual question answering / image understanding."""
        return self.predict(image, question, **kwargs)

    # ------------------------------------------------------------------
    # Output parsing utilities
    # ------------------------------------------------------------------

    @staticmethod
    def parse_boxes(answer: str, image_width: int, image_height: int) -> list[dict]:
        """Parse model output into pixel-coordinate bounding boxes.

        Coordinates in model output are normalized integers in [0, 1000].
        """
        boxes = []
        for m in re.finditer(r"<box><(\d+)><(\d+)><(\d+)><(\d+)></box>", answer):
            x1, y1, x2, y2 = [int(g) for g in m.groups()]
            boxes.append({
                "x1": x1 / 1000 * image_width,
                "y1": y1 / 1000 * image_height,
                "x2": x2 / 1000 * image_width,
                "y2": y2 / 1000 * image_height,
            })
        return boxes

    @staticmethod
    def parse_points(answer: str, image_width: int, image_height: int) -> list[dict]:
        """Parse model output into pixel-coordinate points."""
        points = []
        for m in re.finditer(r"<box><(\d+)><(\d+)></box>", answer):
            x, y = int(m.group(1)), int(m.group(2))
            points.append({
                "x": x / 1000 * image_width,
                "y": y / 1000 * image_height,
            })
        return points


# --------------- Usage Example ---------------
if __name__ == "__main__":
    import sys

    model_path = sys.argv[1] if len(sys.argv) > 1 else "nvidia/Eagle2-9B"
    worker = EagleWorker(model_path)
    print(f"Loaded model: {model_path} (family={worker.family})")

    img = Image.open("assets/images/teaser.jpg").convert("RGB")

    if worker.family == "locateanything":
        # LocateAnything-specific tasks
        print("Detection:", worker.detect(img, ["person", "car"])["answer"])
        print("Grounding:", worker.ground_multi(img, "people wearing red shirts")["answer"])
    else:
        # Eagle2 general VQA
        print("Chat:", worker.chat(img, "Describe this image in detail.")["answer"])
