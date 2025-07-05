import face_recognition

# Quick wrapper to encode face from file path
def encode_face(img_path):
    try:
        img = face_recognition.load_image_file(img_path)
        faces = face_recognition.face_encodings(img)
        return faces[0] if faces else None
    except Exception as e:
        print(f"[encode_face] error: {e}")
        return None

# Just compare one face with many
def compare_faces(known, target):
    return face_recognition.compare_faces(known, target)
