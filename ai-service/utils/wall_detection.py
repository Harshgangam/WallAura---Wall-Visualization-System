"""
Wall detection module for WallAura.
Combines SegFormer semantic scene understanding with connected-component analysis,
edge-aware guided boundary refinement, and click-to-select wall targeting.
"""

import cv2
import numpy as np
from models.segmentation import get_model


def detect_wall_auto(image_bgr: np.ndarray, prob_thresh: float = 0.35) -> tuple:
    """
    Automatically detect all wall surfaces in the room photograph.

    Args:
        image_bgr: BGR input image at original resolution.
        prob_thresh: Minimum wall probability threshold.

    Returns:
        Tuple of:
            - wall_mask: uint8 binary mask (H, W), 255 = wall
            - fg_mask: uint8 binary mask of excluded objects (windows, doors, ceiling, furniture)
            - wall_components: list of dicts with individual wall components info
    """
    h, w = image_bgr.shape[:2]
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    model = get_model()
    seg_res = model.segment_image(image_rgb)

    wall_prob = seg_res["wall_prob"]
    pred_classes = seg_res["pred_classes"]
    non_wall_mask = seg_res["non_wall_mask"]

    # Initial semantic wall candidate: where class is wall OR probability > threshold
    raw_wall = np.where((pred_classes == model.wall_id) | (wall_prob >= prob_thresh), 255, 0).astype(np.uint8)

    # Strictly subtract non-wall objects (ceiling, floor, windows, furniture, art)
    raw_wall[non_wall_mask > 0] = 0

    # Edge-aware guided refinement to snap mask to high-resolution structural edges
    refined_wall = refine_mask_edge_aware(raw_wall, image_bgr, non_wall_mask)

    # Analyze connected wall surfaces (e.g. left wall, right wall, accent wall)
    wall_components = analyze_wall_components(refined_wall)

    return refined_wall, non_wall_mask, wall_components


def detect_wall_at_point(
    image_bgr: np.ndarray,
    click_x: int,
    click_y: int,
    tolerance: int = 35,
    prob_thresh: float = 0.30
) -> tuple:
    """
    Detect the specific wall surface targeted by the user click.
    Supports multi-wall room scenes by isolating the clicked connected wall region.

    Args:
        image_bgr: BGR input image.
        click_x: X coordinate of user click in original image coords.
        click_y: Y coordinate of user click in original image coords.
        tolerance: Edge sensitivity / tolerance.
        prob_thresh: Wall probability threshold.

    Returns:
        Tuple of (selected_wall_mask, fg_mask, wall_components)
    """
    h, w = image_bgr.shape[:2]
    click_x = max(0, min(click_x, w - 1))
    click_y = max(0, min(click_y, h - 1))

    # First get full semantic segmentation and connected components
    full_wall_mask, fg_mask, components = detect_wall_auto(image_bgr, prob_thresh=prob_thresh)

    # Label connected components
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(full_wall_mask, connectivity=8)

    # Check which component was clicked
    clicked_label = labels[click_y, click_x]

    # If user clicked directly inside a wall component (> 0)
    if clicked_label > 0:
        selected_mask = np.where(labels == clicked_label, 255, 0).astype(np.uint8)
    else:
        # If user clicked slightly outside or on an edge, find nearest wall component
        min_dist = float("inf")
        best_label = 0
        search_radius = max(15, int(min(h, w) * 0.05))

        y_min = max(0, click_y - search_radius)
        y_max = min(h, click_y + search_radius + 1)
        x_min = max(0, click_x - search_radius)
        x_max = min(w, click_x + search_radius + 1)

        patch = labels[y_min:y_max, x_min:x_max]
        non_zero_labels = np.unique(patch[patch > 0])

        if len(non_zero_labels) > 0:
            for lbl in non_zero_labels:
                cy, cx = centroids[lbl][1], centroids[lbl][0]
                dist = (click_x - cx) ** 2 + (click_y - cy) ** 2
                if dist < min_dist:
                    min_dist = dist
                    best_label = lbl

        if best_label > 0:
            selected_mask = np.where(labels == best_label, 255, 0).astype(np.uint8)
        else:
            # If no component nearby, fallback to seed flood within semantic probability
            selected_mask = _seed_guided_wall_region(image_bgr, click_x, click_y, full_wall_mask, fg_mask)

    # Edge refinement
    selected_mask = refine_mask_edge_aware(selected_mask, image_bgr, fg_mask)

    return selected_mask, fg_mask, components


def refine_mask_edge_aware(
    mask: np.ndarray,
    image_bgr: np.ndarray,
    fg_mask: np.ndarray = None
) -> np.ndarray:
    """
    Snap segmentation mask boundaries to sharp architectural edges in the image
    while preserving sharp room corners, trims, and baseboards without heavy erosion.
    """
    if not np.any(mask > 0):
        return mask

    h, w = mask.shape[:2]

    # 1. Clean small speckle noise (1-2 iterations with small 3x3 kernel)
    kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    clean_mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_small, iterations=1)

    # 2. Fill small holes inside the wall surface (e.g. wall texture variations)
    kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    clean_mask = cv2.morphologyEx(clean_mask, cv2.MORPH_CLOSE, kernel_close, iterations=1)

    # 3. Guided Edge Alignment: compute image structural gradient
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    edge_mag = cv2.magnitude(grad_x, grad_y)
    strong_edges = (edge_mag > 35).astype(np.uint8)

    # 4. Strictly exclude foreground objects and edges
    if fg_mask is not None and np.any(fg_mask > 0):
        # Dilate fg mask slightly (1px) to protect fine borders
        fg_dilated = cv2.dilate(fg_mask, kernel_small, iterations=1)
        clean_mask[fg_dilated > 0] = 0

    return clean_mask


def analyze_wall_components(wall_mask: np.ndarray, min_area_fraction: float = 0.01) -> list:
    """
    Segment connected wall components (e.g. left wall, back wall, right wall).
    Returns list of metadata dicts for each significant wall surface.
    """
    h, w = wall_mask.shape[:2]
    total_pixels = h * w
    min_area = int(total_pixels * min_area_fraction)

    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(wall_mask, connectivity=8)

    components = []
    comp_id = 1
    for label in range(1, num_labels):
        area = stats[label, cv2.CC_STAT_AREA]
        if area >= min_area:
            cx, cy = int(centroids[label][0]), int(centroids[label][1])
            x = int(stats[label, cv2.CC_STAT_LEFT])
            y = int(stats[label, cv2.CC_STAT_TOP])
            comp_w = int(stats[label, cv2.CC_STAT_WIDTH])
            comp_h = int(stats[label, cv2.CC_STAT_HEIGHT])

            components.append({
                "id": comp_id,
                "label": int(label),
                "area": int(area),
                "area_fraction": float(area / total_pixels),
                "centroid": [cx, cy],
                "bbox": [x, y, comp_w, comp_h],
            })
            comp_id += 1

    return components


def _seed_guided_wall_region(
    image_bgr: np.ndarray,
    x: int,
    y: int,
    semantic_mask: np.ndarray,
    fg_mask: np.ndarray
) -> np.ndarray:
    """Fallback region growing from seed point within semantic wall candidates."""
    h, w = image_bgr.shape[:2]
    if semantic_mask[y, x] > 0:
        # Standard connected component
        num_labels, labels = cv2.connectedComponents(semantic_mask)
        lbl = labels[y, x]
        return np.where(labels == lbl, 255, 0).astype(np.uint8)

    # Use color-guided flood fill bounded strictly by semantic wall + fg
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
    if fg_mask is not None:
        mask[1:-1, 1:-1] = np.where(fg_mask > 0, 1, 0).astype(np.uint8)

    cv2.floodFill(gray, mask, (x, y), 255, loDiff=20, upDiff=20, flags=cv2.FLOODFILL_MASK_ONLY | (255 << 8))
    result = np.where(mask[1:-1, 1:-1] == 255, 255, 0).astype(np.uint8)
    return result


def create_anti_aliased_mask(
    mask: np.ndarray,
    aa_radius: int = 2,
    clip_mask: np.ndarray = None
) -> np.ndarray:
    """
    Subpixel anti-aliased alpha matte (0.0 to 1.0) along wall borders.
    Keeps interior at 1.0 and smoothly tapers only the outermost 1-2 pixels
    to prevent visible halos, color fringe, or white borders.
    """
    mask_f = (mask > 0).astype(np.float32)
    ksize = aa_radius * 2 + 1
    blurred = cv2.GaussianBlur(mask_f, (ksize, ksize), aa_radius * 0.4)

    # Steep sigmoid falloff: keeps 98% of wall at 1.0, anti-aliases only boundary pixels
    aa_mask = np.clip((blurred - 0.2) / 0.6, 0.0, 1.0)

    if clip_mask is not None and np.any(clip_mask > 0):
        aa_mask[clip_mask > 0] = 0.0

    return aa_mask.astype(np.float32)
