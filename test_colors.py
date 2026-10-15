import cv2, numpy as np, sys
sys.path.insert(0, 'ai-service')
from models.segmentation import get_model
from utils.wall_detection import detect_wall_auto
from utils.color_overlay import apply_color_to_wall

img = cv2.imread('room.jpg')
mask, fg, _ = detect_wall_auto(img)
print('Mask pixels:', int(np.sum(mask > 0)))

for color in ['#0055FF', '#FF5533', '#FFD700', '#2E5B88', '#111111', '#FFFFFF']:
    res = apply_color_to_wall(img, mask, color, intensity=0.85, preserve_texture=True, sheen='eggshell')
    c_clean = color.replace('#', '')
    cv2.imwrite(f'test_recolor_{c_clean}.png', res)
    diff = np.abs(res.astype(float) - img.astype(float))
    print(f'Color {color}: wall mean diff = {diff[mask > 0].mean():.2f}, non-wall diff = {diff[mask == 0].mean():.2f}')
