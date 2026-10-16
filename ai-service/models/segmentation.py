"""
Segmentation model wrapper for WallAura.
Uses SegFormer (pretrained on ADE20K) for high-accuracy indoor semantic scene segmentation.
Explicitly identifies wall regions while excluding ceilings, floors, windows, doors,
paintings, mirrors, curtains, and furniture.
"""

import torch
import torch.nn.functional as F
import numpy as np
import cv2
from PIL import Image
from transformers import SegformerImageProcessor, SegformerForSemanticSegmentation


# ADE20K Class Definitions of Interest
# Class 0 is explicitly 'wall' in ADE20K
WALL_CLASS_ID = 0

# Non-wall architectural & furniture classes that must NEVER be painted
EXCLUDED_INDOOR_CLASSES = {
    3: "floor",
    5: "ceiling",
    7: "bed",
    8: "windowpane",
    10: "cabinet",
    14: "door",
    15: "table",
    18: "curtain",
    19: "chair",
    20: "car",
    21: "water",
    22: "painting",
    24: "mirror",
    25: "rug",
    28: "armchair",
    30: "desk",
    31: "wardrobe",
    32: "lamp",
    37: "shelf",
    41: "chandelier",
    43: "pillow",
    64: "clock",
    65: "flag",
    75: "screen",
    76: "blanket",
    77: "sculpture",
    80: "fireplace",
    83: "stove",
    90: "television",
    100: "poster",
    103: "cushion",
    115: "sconce",
    124: "radiator",
    126: "counter",
    142: "light",
}

# Outdoor classes that can falsely trigger on uniform indoor wall tones (e.g. sky, road, grass)
OUTDOOR_CLASSES = {1, 2, 4, 6, 9, 11, 13, 16, 17, 26, 29, 46, 59, 94}


class SegmentationModel:
    """
    SegFormer semantic segmentation model wrapper fine-tuned on ADE20K.
    Provides pixel-level semantic classification and wall probability maps.
    """

    def __init__(self, model_checkpoint: str = "nvidia/segformer-b0-finetuned-ade-512-512"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model_checkpoint = model_checkpoint
        print(f"[SegmentationModel] Loading SegFormer ({model_checkpoint}) on {self.device}...")

        self.processor = SegformerImageProcessor.from_pretrained(model_checkpoint)
        self.model = SegformerForSemanticSegmentation.from_pretrained(model_checkpoint)
        self.model.to(self.device)
        self.model.eval()

        # Verify class mapping
        self.id2label = self.model.config.id2label
        self.wall_id = None
        for cid, label in self.id2label.items():
            if label.strip().lower() == "wall":
                self.wall_id = int(cid)
                break
        if self.wall_id is None:
            self.wall_id = WALL_CLASS_ID

        print(f"[SegmentationModel] Ready. Wall Class ID: {self.wall_id} ('{self.id2label.get(self.wall_id)}')")

    @torch.no_grad()
    def segment_image(self, image_rgb: np.ndarray) -> dict:
        """
        Run semantic segmentation on an RGB image with strict memory bounds for low-RAM hosts.

        Args:
            image_rgb: RGB image numpy array (H, W, 3), uint8.

        Returns:
            dict containing:
                - 'wall_prob': float32 probability map (H, W) in range [0.0, 1.0]
                - 'wall_mask': binary uint8 mask (H, W) where 255 = wall
                - 'pred_classes': int32 class ID map (H, W)
                - 'non_wall_mask': binary uint8 mask (H, W) where 255 = excluded objects
        """
        import gc
        h, w = image_rgb.shape[:2]

        pil_img = Image.fromarray(image_rgb)

        # Standard 384x384 inference: perfectly divisible by 32, ultra-low memory (~5.5MB logits), 3x faster
        inputs = self.processor(images=pil_img, size={"height": 384, "width": 384}, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        outputs = self.model(**inputs)
        logits = outputs.logits  # Shape: [1, num_classes, 96, 96]

        # In indoor interior room photography, suppress outdoor false positives on plain walls
        for out_id in OUTDOOR_CLASSES:
            if out_id < logits.shape[1]:
                logits[:, out_id] -= 4.0

        # Memory optimization: compute softmax and argmax directly on compact feature map logits (only ~5.5 MB)
        probs_low = F.softmax(logits, dim=1)[0]
        wall_prob_low = probs_low[self.wall_id].cpu().numpy().astype(np.float32)
        pred_classes_low = logits.argmax(dim=1)[0].cpu().numpy().astype(np.int32)

        # Free PyTorch tensor memory immediately
        del inputs, outputs, logits, probs_low
        gc.collect()

        # Build non_wall mask at compact resolution (single-channel 2D, 1 byte per pixel)
        non_wall_low = np.zeros(pred_classes_low.shape, dtype=np.uint8)
        for cls_id in EXCLUDED_INDOOR_CLASSES:
            non_wall_low[pred_classes_low == cls_id] = 255

        # Resize single-channel 2D masks back to full image resolution (w, h) using OpenCV
        wall_prob = cv2.resize(wall_prob_low, (w, h), interpolation=cv2.INTER_LINEAR)
        non_wall_mask = cv2.resize(non_wall_low, (w, h), interpolation=cv2.INTER_NEAREST)
        pred_classes = cv2.resize(pred_classes_low, (w, h), interpolation=cv2.INTER_NEAREST)

        wall_mask = (pred_classes == self.wall_id).astype(np.uint8) * 255
        wall_mask[non_wall_mask > 0] = 0

        # On Linux, return free memory from heap back to OS kernel immediately
        try:
            import ctypes
            ctypes.CDLL("libc.so.6").malloc_trim(0)
        except Exception:
            pass

        return {
            "wall_prob": wall_prob,
            "wall_mask": wall_mask,
            "pred_classes": pred_classes,
            "non_wall_mask": non_wall_mask,
        }

    def get_wall_mask(self, image_rgb: np.ndarray, prob_thresh: float = 0.35) -> np.ndarray:
        """Convenience method returning binary wall mask."""
        res = self.segment_image(image_rgb)
        # Combine argmax classification with probability thresholding
        mask = np.where((res["pred_classes"] == self.wall_id) | (res["wall_prob"] >= prob_thresh), 255, 0).astype(np.uint8)
        # Ensure non-wall objects are strictly removed
        mask[res["non_wall_mask"] > 0] = 0
        return mask

    def get_foreground_mask(self, image_rgb: np.ndarray) -> np.ndarray:
        """Returns non-wall furniture, window, door, and ceiling mask."""
        res = self.segment_image(image_rgb)
        return res["non_wall_mask"]


# Singleton instance
_model_instance = None


def get_model() -> SegmentationModel:
    """Get or create singleton SegFormer segmentation model."""
    global _model_instance
    if _model_instance is None:
        _model_instance = SegmentationModel()
    return _model_instance
