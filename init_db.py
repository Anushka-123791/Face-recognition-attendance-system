import sqlite3

# not using path libs, just simple file connect
conn = sqlite3.connect('database.db')
cur = conn.cursor()

# users table – face + ID
cur.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        name TEXT,
        face_encoding BLOB
    )
''')

# attendance table – one record per day
cur.execute('''
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        name TEXT,
        date TEXT,
        time TEXT,
        confidence TEXT
    )
''')

conn.commit()
conn.close()
