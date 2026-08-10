import os

target_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "src"))
keywords = ["메인", "스탯", "파기", "결실", "척도", "관리자", "테스트", "응시", "챗봇"]

found = []
for root, dirs, files in os.walk(target_dir):
    for f in files:
        if f.endswith(".jsx") or f.endswith(".js"):
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8", errors="ignore") as file:
                lines = file.readlines()
                for idx, line in enumerate(lines):
                    for kw in keywords:
                        if kw in line:
                            clean_line = line.strip()
                            found.append((f, idx + 1, kw, clean_line))

with open("scan_results.txt", "w", encoding="utf-8") as out:
    for item in found:
        out.write(f"[{item[0]}:{item[1]}] ({item[2]}) {item[3]}\n")

print(f"Scan complete. Found {len(found)} items. Saved to scan_results.txt.")
