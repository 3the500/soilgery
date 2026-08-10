import sqlite3
import os

paths = [
    os.path.join(os.path.dirname(__file__), "..", "soilgery.db"),
    os.path.join(os.path.dirname(__file__), "..", "backend", "soilgery.db"),
]

for db_path in paths:
    abs_p = os.path.abspath(db_path)
    if os.path.exists(abs_p):
        print(f"Found DB at {abs_p}")
        conn = sqlite3.connect(abs_p)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(users)")
        cols = [info[1] for info in cursor.fetchall()]
        print("Existing columns:", cols)
        
        if "exp" not in cols:
            print("Adding 'exp' column...")
            cursor.execute("ALTER TABLE users ADD COLUMN exp INTEGER DEFAULT 0")
        if "level" not in cols:
            print("Adding 'level' column...")
            cursor.execute("ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1")
            
        conn.commit()
        conn.close()
        print(f"Successfully migrated {abs_p}!")
