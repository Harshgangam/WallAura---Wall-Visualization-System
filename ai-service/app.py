"""
WallAura AI Service – FastAPI Application
==========================================
Provides endpoints for SegFormer-based wall detection and physically based recoloring.

Endpoints:
  POST /api/detect-walls       – Detect walls in an uploaded image (with multi-wall components)
  POST /api/apply-color        – Apply color & sheen to a wall region using a mask
  POST /api/detect-and-apply   – Combined: detect wall at click point + apply color & sheen
  GET  /api/health             – Health check
"""

import io
import base64
import traceback
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2

from utils.preprocessing import (
    load_image_from_bytes,
    resize_for_processing,
    encode_image_to_bytes,
    encode_mask_to_bytes,
)
from utils.wall_detection import detect_wall_at_point, detect_wall_auto
from utils.color_overlay import (
    apply_color_to_wall,
    get_dominant_colors,
    get_color_recommendations,
)


from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Preload the SegFormer segmentation model on server start."""
    print("[WallAura] Preloading SegFormer AI model...")
    from models.segmentation import get_model
    get_model()
    print("[WallAura] SegFormer AI model ready!")
    yield


app = FastAPI(
    title="WallAura AI Service",
    description="SegFormer-powered wall detection and physically based paint visualization",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ────────────────────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "WallAura AI",
        "model": "nvidia/segformer-b0-finetuned-ade-512-512",
        "version": "2.0.0"
    }


# ── Root Welcome ────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "message": "Welcome to WallAura AI Service v2.0!",
        "docs_url": "/docs",
        "status": "Running"
    }


# ── Detect Walls ────────────────────────────────────────────────────────
@app.post("/api/detect-walls")
async def detect_walls(
    file: UploadFile = File(...),
    click_x: int = Form(-1),
    click_y: int = Form(-1),
    tolerance: int = Form(35),
):
    """
    Detect wall region in an uploaded image using SegFormer.

    If click_x and click_y are provided, isolates the specific connected wall at that point.
    Otherwise, detects all wall surfaces in the room.

    Returns the wall mask, foreground mask, and wall components info.
    """
    try:
        contents = await file.read()
        image_bgr = load_image_from_bytes(contents)

        if click_x >= 0 and click_y >= 0:
            mask, fg, components = detect_wall_at_point(image_bgr, click_x, click_y, tolerance)
        else:
            mask, fg, components = detect_wall_auto(image_bgr)

        # Encode masks to base64
        mask_bytes = encode_mask_to_bytes(mask)
        mask_b64 = base64.b64encode(mask_bytes).decode("utf-8")

        fg_bytes = encode_mask_to_bytes(fg)
        fg_b64 = base64.b64encode(fg_bytes).decode("utf-8")

        return JSONResponse({
            "success": True,
            "mask": mask_b64,
            "foregroundMask": fg_b64,
            "components": components,
            "width": image_bgr.shape[1],
            "height": image_bgr.shape[0],
        })

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


# ── Apply Color ─────────────────────────────────────────────────────────
@app.post("/api/apply-color")
async def apply_color(
    file: UploadFile = File(...),
    mask_b64: str = Form(...),
    color: str = Form(...),
    intensity: float = Form(1.0),
    fg_b64: str = Form(""),
    sheen: str = Form("eggshell"),
    time_of_day: str = Form("natural"),
    light_strength: float = Form(0.3),
):
    """
    Apply a paint color and sheen to the wall region defined by the mask.
    """
    try:
        contents = await file.read()
        image_bgr = load_image_from_bytes(contents)

        # Decode mask from base64
        mask_bytes = base64.b64decode(mask_b64)
        mask_arr = np.frombuffer(mask_bytes, np.uint8)
        mask_img = cv2.imdecode(mask_arr, cv2.IMREAD_GRAYSCALE)

        if mask_img is None:
            raise ValueError("Invalid mask data")

        # Resize mask if dimensions don't match
        h, w = image_bgr.shape[:2]
        mh, mw = mask_img.shape[:2]
        if (mh, mw) != (h, w):
            mask_img = cv2.resize(mask_img, (w, h), interpolation=cv2.INTER_NEAREST)

        # Decode foreground mask if provided
        fg_mask_img = None
        if fg_b64:
            try:
                fg_bytes = base64.b64decode(fg_b64)
                fg_arr = np.frombuffer(fg_bytes, np.uint8)
                fg_mask_img = cv2.imdecode(fg_arr, cv2.IMREAD_GRAYSCALE)
                if fg_mask_img is not None:
                    fh, fw = fg_mask_img.shape[:2]
                    if (fh, fw) != (h, w):
                        fg_mask_img = cv2.resize(fg_mask_img, (w, h), interpolation=cv2.INTER_NEAREST)
            except Exception:
                fg_mask_img = None

        # Apply physically based recoloring with sheen and lighting
        result = apply_color_to_wall(
            image_bgr,
            mask_img,
            color,
            intensity=intensity,
            preserve_texture=True,
            foreground_mask=fg_mask_img,
            sheen=sheen,
            time_of_day=time_of_day,
            light_strength=light_strength,
        )

        result_bytes = encode_image_to_bytes(result, "png")

        return StreamingResponse(
            io.BytesIO(result_bytes),
            media_type="image/png",
            headers={"Content-Disposition": "attachment; filename=wallaura_result.png"},
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


# ── Detect & Apply (Combined) ──────────────────────────────────────────
@app.post("/api/detect-and-apply")
async def detect_and_apply(
    file: UploadFile = File(...),
    color: str = Form(...),
    click_x: int = Form(-1),
    click_y: int = Form(-1),
    tolerance: int = Form(35),
    intensity: float = Form(1.0),
    sheen: str = Form("eggshell"),
    time_of_day: str = Form("natural"),
    light_strength: float = Form(0.3),
):
    """
    Combined endpoint: detect wall at click point (or all walls) and apply color + sheen.
    """
    try:
        contents = await file.read()
        image_bgr = load_image_from_bytes(contents)

        # Detect wall using SegFormer
        if click_x >= 0 and click_y >= 0:
            mask, fg_mask, components = detect_wall_at_point(image_bgr, click_x, click_y, tolerance)
        else:
            mask, fg_mask, components = detect_wall_auto(image_bgr)

        # Apply physically based recoloring
        result = apply_color_to_wall(
            image_bgr,
            mask,
            color,
            intensity=intensity,
            preserve_texture=True,
            foreground_mask=fg_mask,
            sheen=sheen,
            time_of_day=time_of_day,
            light_strength=light_strength,
        )

        # Encode both to base64
        mask_bytes = encode_mask_to_bytes(mask)
        mask_b64 = base64.b64encode(mask_bytes).decode("utf-8")

        result_bytes = encode_image_to_bytes(result, "png")
        result_b64 = base64.b64encode(result_bytes).decode("utf-8")

        fg_mask_bytes = encode_mask_to_bytes(fg_mask)
        fg_mask_b64 = base64.b64encode(fg_mask_bytes).decode("utf-8")

        # Extract dominant non-wall colors for palette recommendations
        try:
            non_wall_pixels_mask = cv2.bitwise_not(mask)
            dominant = get_dominant_colors(image_bgr, non_wall_pixels_mask, n_colors=5)
            recommended_colors = get_color_recommendations(dominant)
        except Exception:
            dominant = []
            recommended_colors = []

        return JSONResponse({
            "success": True,
            "mask": mask_b64,
            "result": result_b64,
            "foregroundMask": fg_mask_b64,
            "components": components,
            "dominantColors": dominant,
            "recommendedColors": recommended_colors,
            "width": image_bgr.shape[1],
            "height": image_bgr.shape[0],
        })

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


# ── Run with Uvicorn ────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
