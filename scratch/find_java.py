import os
import glob

possible_paths = [
    r"C:\Program Files\Java\*",
    r"C:\Program Files\Android\Android Studio\jbr",
    r"C:\Program Files\Android\Android Studio\jre",
    r"C:\Program Files\Eclipse Adoptium\*",
    r"C:\Program Files\Microsoft\*",
    r"C:\Users\*\AppData\Local\Android\Sdk",
]

found = []
for p in possible_paths:
    matches = glob.glob(p)
    for m in matches:
        java_exe = os.path.join(m, "bin", "java.exe")
        if os.path.exists(java_exe):
            found.append(m)

print("Found JDK/Java paths:", found)
