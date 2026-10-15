"""
Color overlay and physically-based relighting engine for WallAura.
Applies paint colors to wall regions with:
- True pigment color fidelity (zero pastel washout or muddy gray blending)
- Relative illumination scaling and bilateral texture decomposition
- Surface-normal estimation from image gradients
- Sheen-aware BRDF rendering (Matte, Eggshell, Satin, Semi-Gloss, High Gloss)
- Directional Solar / Time-of-Day lighting simulation
- Clean subpixel anti-aliased edge compositing
"""

import cv2
import numpy as np
from utils.wall_detection import create_anti_aliased_mask


# Sheen parameter definitions (Diffuse vs Specular BRDF parameters)
SHEEN_CONFIGS = {
    "matte": {
        "specular_weight": 0.01,
        "specular_exponent": 4,
        "roughness": 0.9,
    },
    "eggshell": {
        "specular_weight": 0.07,
        "specular_exponent": 16,
        "roughness": 0.7,
    },
    "satin": {
        "specular_weight": 0.16,
        "specular_exponent": 32,
        "roughness": 0.5,
    },
    "semi-gloss": {
        "specular_weight": 0.28,
        "specular_exponent": 64,
        "roughness": 0.3,
    },
    "gloss": {
        "specular_weight": 0.46,
        "specular_exponent": 128,
        "roughness": 0.15,
    },
}

# Solar / Time-of-Day directional light presets
TIME_OF_DAY_PRESETS = {
    "natural": {
        "direction": (0.0, 0.0, 1.0),
        "color_bgr": (255, 255, 255),
        "strength": 0.0,
    },
    "morning": {
        "direction": (-0.6, 0.3, 0.7),
        "color_bgr": (210, 235, 255),  # Soft warm morning light
        "strength": 0.35,
    },
    "midday": {
        "direction": (0.0, 0.8, 0.6),
        "color_bgr": (250, 255, 255),  # Clean neutral daylight
        "strength": 0.25,
    },
    "golden_hour": {
        "direction": (0.7, 0.2, 0.7),
        "color_bgr": (160, 210, 255),  # Rich warm amber golden light
        "strength": 0.45,
    },
    "evening_lamp": {
        "direction": (0.2, -0.4, 0.9),
        "color_bgr": (180, 225, 255),  # Warm incandescent lamp
        "strength": 0.30,
    },
}


def apply_color_to_wall(
    image_bgr: np.ndarray,
    mask: np.ndarray,
    color_hex: str,
    intensity: float = 1.0,
    preserve_texture: bool = True,
    foreground_mask: np.ndarray = None,
    sheen: str = "eggshell",
    time_of_day: str = "natural",
    light_strength: float = 0.3,
) -> np.ndarray:
    """
    Apply paint color to the wall mask with physically based sheen and illumination.

    Args:
        image_bgr: Original image (H, W, 3), uint8.
        mask: Binary wall mask (H, W), uint8, 255 = wall.
        color_hex: Hex code string (e.g. "#4A90D9").
        intensity: Paint color opacity (0.0 to 1.0).
        preserve_texture: Retain micro-texture and shadows.
        foreground_mask: Excluded objects mask for clean edge clipping.
        sheen: Paint finish ('matte', 'eggshell', 'satin', 'semi-gloss', 'gloss').
        time_of_day: Solar preset ('natural', 'morning', 'midday', 'golden_hour', 'evening_lamp').
        light_strength: Intensity of directional relighting (0.0 to 1.0).

    Returns:
        Result image (H, W, 3), uint8.
    """
    if not np.any(mask > 0):
        return image_bgr.copy()

    # Parse target hex color to BGR
    color_hex = color_hex.lstrip("#")
    if len(color_hex) != 6:
        color_hex = "4A90D9"
    r = int(color_hex[0:2], 16)
    g = int(color_hex[2:4], 16)
    b = int(color_hex[4:6], 16)
    target_bgr = np.array([b, g, r], dtype=np.float32)

    sheen_cfg = SHEEN_CONFIGS.get(sheen.lower(), SHEEN_CONFIGS["eggshell"])
    tod_cfg = TIME_OF_DAY_PRESETS.get(time_of_day.lower(), TIME_OF_DAY_PRESETS["natural"])

    if preserve_texture:
        result = _physically_based_render(
            image_bgr,
            mask,
            target_bgr,
            intensity,
            foreground_mask,
            sheen_cfg,
            tod_cfg,
            light_strength
        )
    else:
        result = _simple_blend(image_bgr, mask, target_bgr, intensity, foreground_mask)

    return result


def _physically_based_render(
    image_bgr: np.ndarray,
    mask: np.ndarray,
    target_bgr: np.ndarray,
    intensity: float,
    foreground_mask: np.ndarray,
    sheen_cfg: dict,
    tod_cfg: dict,
    light_strength: float
) -> np.ndarray:
    """
    Full physically-based wall recoloring and relighting pipeline.
    Maintains exact pigment chromaticity while retaining natural room illumination.
    """
    wall_idx = mask > 0

    # 1. Grayscale illumination decomposition
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)

    # Bilateral filtering isolates low-frequency lighting gradients from high-frequency plaster texture
    smooth = cv2.bilateralFilter(gray, d=9, sigmaColor=35, sigmaSpace=35)
    detail = gray / (smooth + 1e-4)

    mean_l = float(np.mean(smooth[wall_idx])) if np.any(wall_idx) else 128.0
    if mean_l < 1e-4:
        mean_l = 128.0

    # 2. Normalized relative illumination factor
    # Power curve gamma of 0.72 balances shadow depth with highlight retention without blowout
    rel_light = np.power(smooth / mean_l, 0.72)

    # 3. Base painted color in BGR (accurate pigment scaling)
    painted = np.zeros_like(image_bgr, dtype=np.float32)
    for c in range(3):
        painted[:, :, c] = target_bgr[c] * rel_light * detail

    # 4. Surface normal estimation for sheen BRDF and directional sunlight
    sobel_x = cv2.Sobel(smooth, cv2.CV_32F, 1, 0, ksize=3) * 0.025
    sobel_y = cv2.Sobel(smooth, cv2.CV_32F, 0, 1, ksize=3) * 0.025
    norm = np.sqrt(sobel_x**2 + sobel_y**2 + 1.0)
    nx = -sobel_x / norm
    ny = -sobel_y / norm
    nz = 1.0 / norm

    # 5. Sheen & Directional Solar Lighting
    sun_strength = float(tod_cfg.get("strength", 0.0)) * float(light_strength)
    ks = float(sheen_cfg["specular_weight"])
    exp = float(sheen_cfg["specular_exponent"])
    roughness = float(sheen_cfg.get("roughness", 0.7))

    if sun_strength > 0.01:
        # Directional light source (e.g. morning sun, midday, golden hour, evening lamp)
        dir_vec = tod_cfg["direction"]
        lx, ly, lz = float(dir_vec[0]), float(dir_vec[1]), float(dir_vec[2])
        l_mag = np.sqrt(lx**2 + ly**2 + lz**2) + 1e-5
        lx, ly, lz = lx / l_mag, ly / l_mag, lz / l_mag

        # Blinn-Phong half vector (camera view vector is (0, 0, 1))
        hx, hy, hz = lx, ly, lz + 1.0
        h_mag = np.sqrt(hx**2 + hy**2 + hz**2) + 1e-5
        hx, hy, hz = hx / h_mag, hy / h_mag, hz / h_mag

        # Specular reflection is proportional to light source intensity
        n_dot_h = np.maximum(0.0, nx * hx + ny * hy + nz * hz)
        specular = ks * np.power(n_dot_h, exp) * (sun_strength * 220.0)

        # Directional diffuse shading
        n_dot_l = np.maximum(0.15, nx * lx + ny * ly + nz * lz)
        light_bgr = np.array(tod_cfg.get("color_bgr", [255, 255, 255]), dtype=np.float32) / 255.0

        for c in range(3):
            solar_diffuse = (1.0 - sun_strength * 0.45) + (sun_strength * 0.45) * n_dot_l * light_bgr[c]
            painted[:, :, c] = painted[:, :, c] * solar_diffuse + specular * light_bgr[c]
    else:
        # Natural ambient room light:
        # Micro-contrast adjustment according to paint sheen finish (matte vs eggshell vs satin vs gloss)
        # Glossier finish sharpens texture micro-contrast; matte softens it.
        contrast_boost = (1.0 - roughness) * 0.35
        detail_adjusted = 1.0 + (detail - 1.0) * (1.0 + contrast_boost)
        for c in range(3):
            painted[:, :, c] = target_bgr[c] * rel_light * detail_adjusted

    # 6. Subpixel anti-aliased edge blending with zero halos or bleeding
    alpha = create_anti_aliased_mask(mask, aa_radius=2, clip_mask=foreground_mask)
    effective_alpha = alpha * np.clip(intensity, 0.0, 1.0)
    alpha_3ch = np.stack([effective_alpha] * 3, axis=-1)

    result = (
        painted * alpha_3ch +
        image_bgr.astype(np.float32) * (1.0 - alpha_3ch)
    )

    return np.clip(result, 0.0, 255.0).astype(np.uint8)


def _simple_blend(
    image_bgr: np.ndarray,
    mask: np.ndarray,
    target_bgr: np.ndarray,
    intensity: float,
    foreground_mask: np.ndarray = None
) -> np.ndarray:
    """Fast fallback alpha blend."""
    overlay = np.full_like(image_bgr, target_bgr, dtype=np.uint8)
    alpha = create_anti_aliased_mask(mask, aa_radius=2, clip_mask=foreground_mask)
    effective_alpha = alpha * np.clip(intensity, 0.0, 1.0)
    alpha_3ch = np.stack([effective_alpha] * 3, axis=-1)

    result = (
        overlay.astype(np.float32) * alpha_3ch +
        image_bgr.astype(np.float32) * (1.0 - alpha_3ch)
    ).astype(np.uint8)
    return result


def get_dominant_colors(image_bgr: np.ndarray, mask: np.ndarray, n_colors: int = 5) -> list:
    """Extract dominant room colors using K-Means for harmonization."""
    from sklearn.cluster import KMeans

    pixels = image_bgr[mask > 0]
    if len(pixels) < n_colors:
        return ["#D8D3C8", "#9E9A92", "#5C5852"]

    if len(pixels) > 8000:
        idx = np.random.choice(len(pixels), 8000, replace=False)
        pixels = pixels[idx]

    kmeans = KMeans(n_clusters=n_colors, random_state=42, n_init=5)
    kmeans.fit(pixels)

    colors = []
    for center in kmeans.cluster_centers_:
        b, g, r = int(center[0]), int(center[1]), int(center[2])
        colors.append(f"#{r:02x}{g:02x}{b:02x}".upper())
    return colors


def get_color_recommendations(dominant_colors: list) -> list:
    """Generate harmonic complementary and analogous palette recommendations."""
    import colorsys

    if not dominant_colors:
        return ["#E7DFD5", "#C2CBD1", "#4A5568", "#9B8A7E", "#718096"]

    primary_hex = dominant_colors[0].lstrip("#")
    r = int(primary_hex[0:2], 16) / 255.0
    g = int(primary_hex[2:4], 16) / 255.0
    b = int(primary_hex[4:6], 16) / 255.0

    h, l, s = colorsys.rgb_to_hls(r, g, b)
    rec_s = max(s, 0.35)

    recs = []
    # 1. Soft neutral contrast
    cr1, cg1, cb1 = colorsys.hls_to_rgb(h, min(0.85, l + 0.3), max(0.15, s * 0.5))
    recs.append(f"#{int(cr1*255):02x}{int(cg1*255):02x}{int(cb1*255):02x}".upper())

    # 2. Complementary accent
    comp_h = (h + 0.5) % 1.0
    cr2, cg2, cb2 = colorsys.hls_to_rgb(comp_h, 0.65, rec_s)
    recs.append(f"#{int(cr2*255):02x}{int(cg2*255):02x}{int(cb2*255):02x}".upper())

    # 3. Analogous warm tone
    an1_h = (h + 0.08) % 1.0
    cr3, cg3, cb3 = colorsys.hls_to_rgb(an1_h, 0.70, rec_s)
    recs.append(f"#{int(cr3*255):02x}{int(cg3*255):02x}{int(cb3*255):02x}".upper())

    # 4. Analogous cool tone
    an2_h = (h - 0.08) % 1.0
    cr4, cg4, cb4 = colorsys.hls_to_rgb(an2_h, 0.72, rec_s)
    recs.append(f"#{int(cr4*255):02x}{int(cg4*255):02x}{int(cb4*255):02x}".upper())

    # 5. Moody architectural dark
    cr5, cg5, cb5 = colorsys.hls_to_rgb(comp_h, 0.25, 0.25)
    recs.append(f"#{int(cr5*255):02x}{int(cg5*255):02x}{int(cb5*255):02x}".upper())

    return recs
