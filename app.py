from flask import Flask, render_template, request, jsonify
import os
import sqlite3
import base64
import numpy as np
import face_recognition
from datetime import datetime, date
from face_recognition_util import encode_face, compare_faces

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/faces'

# Just make sure the folder exists
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

# DB connect helper
def get_db():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/mark_attendance', methods=['POST'])
def mark_attendance():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'message': 'no data'}), 400

        user_id = data.get('userId')
        user_name = data.get('userName')
        img_data = data.get('imageData')

        if not user_id or not user_name or not img_data or ',' not in img_data:
            return jsonify({'status': 'error', 'message': 'incomplete data'}), 400

        img_bytes = base64.b64decode(img_data.split(',')[1])
        img_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{user_id}.jpg")

        with open(img_path, 'wb') as f:
            f.write(img_bytes)

        image = face_recognition.load_image_file(img_path)
        encs = face_recognition.face_encodings(image)
        if not encs:
            return jsonify({'status': 'face_mismatch', 'message': 'no face found'}), 400

        current_face = encs[0]

        conn = get_db()
        cur = conn.cursor()

        # face match with existing users
        cur.execute("SELECT user_id, face_encoding FROM users")
        for row in cur.fetchall():
            saved_enc = np.frombuffer(row['face_encoding'], dtype=np.float64)
            if compare_faces([saved_enc], current_face)[0] and row['user_id'] != user_id:
                return jsonify({'status': 'face_mismatch', 'message': 'Face already linked'}), 403

        # already marked today?
        today = date.today().isoformat()
        cur.execute("SELECT 1 FROM attendance WHERE user_id=? AND date=?", (user_id, today))
        if cur.fetchone():
            return jsonify({'status': 'exists'}), 200

        # insert/update user and mark attendance
        cur.execute("REPLACE INTO users (user_id, name, face_encoding) VALUES (?, ?, ?)", (
            user_id, user_name, current_face.tobytes()
        ))
        cur.execute("INSERT INTO attendance (user_id, name, date, time, confidence) VALUES (?, ?, ?, ?, ?)", (
            user_id, user_name, today, datetime.now().strftime('%H:%M:%S'), data.get('confidence')
        ))
        conn.commit()
        conn.close()

        return jsonify({'status': 'success'}), 200

    except Exception as err:
        print(f"[ERROR] attendance error: {err}")
        return jsonify({'status': 'error', 'message': str(err)}), 500

@app.route('/api/attendance_list')
def recent_attendance():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT * FROM attendance ORDER BY date DESC, time DESC LIMIT 10")
        rows = cur.fetchall()

        data = [{
            'userId': r['user_id'],
            'userName': r['name'],
            'date': r['date'],
            'time': r['time'],
            'confidence': r['confidence']
        } for r in rows]

        return jsonify({'status': 'success', 'data': data})
    except Exception as err:
        print(f"[ERROR] fetching list: {err}")
        return jsonify({'status': 'error', 'message': str(err)}), 500

@app.errorhandler(404)
def not_found(e):
    return jsonify({'status': 'error', 'message': 'route not found'}), 404

if __name__ == '__main__':
    app.run(debug=True)
