"""
Image preprocessing utilities for WallAura AI service.
Handles image resizing, normalization, and format conversion.
"""

import cv2
import numpy as np
from PIL import Image
import io


MAX_PROCESSING_SIZE = 1024  # Max dimension for AI processing


def load_image_from_bytes(image_bytes: bytes, max_dim: int = 1280) -> np.ndarray:
    """Convert uploaded file bytes to OpenCV BGR image with memory-safe maximum dimensions."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image. Ensure the file is a valid JPG or PNG.")
    h, w = img.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img



def resize_for_processing(image: np.ndarray, max_size: int = MAX_PROCESSING_SIZE) -> tuple:
    """
    Resize image for AI processing while maintaining aspect ratio.
    Returns (resized_image, scale_factor).
    """
    h, w = image.shape[:2]
    if max(h, w) <= max_size:
        return image.copy(), 1.0

    scale = max_size / max(h, w)
    new_w = int(w * scale)
    new_h = int(h * scale)
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return resized, scale


def encode_image_to_bytes(image: np.ndarray, format: str = "png") -> bytes:
    """Encode OpenCV image to bytes for API response."""
    if format.lower() == "png":
        success, encoded = cv2.imencode(".png", image)
    elif format.lower() in ("jpg", "jpeg"):
        success, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 95])
    else:
        raise ValueError(f"Unsupported format: {format}")

    if not success:
        raise RuntimeError("Failed to encode image.")
    return encoded.tobytes()


def encode_mask_to_bytes(mask: np.ndarray) -> bytes:
    """Encode binary mask to PNG bytes."""
    # Ensure mask is 0 or 255
    mask_uint8 = (mask > 0).astype(np.uint8) * 255
    success, encoded = cv2.imencode(".png", mask_uint8)
    if not success:
        raise RuntimeError("Failed to encode mask.")
    return encoded.tobytes()


def hex_to_bgr(hex_color: str) -> tuple:
    """Convert hex color string to BGR tuple for OpenCV."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        raise ValueError(f"Invalid hex color: #{hex_color}")
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return (b, g, r)


def hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color string to RGB tuple."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        raise ValueError(f"Invalid hex color: #{hex_color}")
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return (r, g, b)
