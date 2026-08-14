import os
import shutil

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
public_img_dir = os.path.join(root_dir, "frontend", "public", "images")
os.makedirs(public_img_dir, exist_ok=True)

for name in ["chung.png", "farmer.png"]:
    src = os.path.join(root_dir, name)
    dst = os.path.join(public_img_dir, name)
    if os.path.exists(src):
        shutil.copy(src, dst)
        print(f"Copied {src} -> {dst}")
    else:
        print(f"Source file not found: {src}")
