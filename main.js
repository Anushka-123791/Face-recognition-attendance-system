// AttendanceTracker class to handle camera and attendance stuff
class AttendanceTracker {
  constructor() {
    // linking HTML elements
    this.videoElement = document.getElementById('videoElement');
    this.captureCanvas = document.getElementById('captureCanvas');
    this.captureOverlay = document.getElementById('captureOverlay');
    this.startCameraButton = document.getElementById('startCamera');
    this.stopCameraButton = document.getElementById('stopCamera');
    this.captureButton = document.getElementById('captureAttendance');
    this.statusIndicator = document.getElementById('statusIndicator');
    this.statusText = document.getElementById('statusText');
    this.userIdInput = document.getElementById('userId');
    this.userNameInput = document.getElementById('userName');
    this.attendanceList = document.getElementById('attendanceList');

    // camera stream and state
    this.stream = null;
    this.isCapturing = false;
    this.attendanceRecords = [];

    // setup things
    this.initializeEventListeners();
    this.loadAttendanceRecords();
  }

  // buttons ke liye event listeners
  initializeEventListeners() {
    this.startCameraButton.addEventListener('click', () => this.startCamera());
    this.stopCameraButton.addEventListener('click', () => this.stopCamera());
    this.captureButton.addEventListener('click', () => this.captureAttendance());

    // jab user info fill kare
    [this.userIdInput, this.userNameInput].forEach(input => {
      input.addEventListener('input', () => this.validateUserInfo());
    });
  }

  // camera start karne ka function
  async startCamera() {
    try {
      this.updateStatus('requesting', 'Requesting camera access...');
      const constraints = {
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;

      this.videoElement.addEventListener('loadedmetadata', () => {
        this.setupCanvas();
        this.updateStatus('ready', 'Camera ready - Fill in your details to mark attendance');
        this.startCameraButton.disabled = true;
        this.stopCameraButton.disabled = false;
        this.validateUserInfo();
      });
    } catch (err) {
      console.error('Camera error:', err);
      this.updateStatus('error', 'Camera access denied or not available');
      this.handleCameraError(err);
    }
  }

  // stop camera
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.videoElement.srcObject = null;
    this.updateStatus('idle', 'Camera stopped');
    this.startCameraButton.disabled = false;
    this.stopCameraButton.disabled = true;
    this.captureButton.disabled = true;
  }

  // canvas size ko video ke hisab se set karo
  setupCanvas() {
    this.captureCanvas.width = this.videoElement.videoWidth;
    this.captureCanvas.height = this.videoElement.videoHeight;
  }

  // check if user id and name filled
  validateUserInfo() {
    let id = this.userIdInput.value.trim();
    let name = this.userNameInput.value.trim();
    if (id && name && this.stream && !this.isCapturing) {
      this.captureButton.disabled = false;
    } else {
      this.captureButton.disabled = true;
    }
  }

  // jab capture button dabaye tab ye chalega
  async captureAttendance() {
    if (this.isCapturing) return;

    this.isCapturing = true;
    this.captureButton.disabled = true;

    try {
      this.showCaptureEffect();
      this.updateStatus('processing', 'Capturing face... Please wait...');
      const imgData = this.captureFrame();

      await this.simulateFaceRecognition(); // temporary recognition
      const attendanceData = await this.sendAttendanceData(imgData);

      this.updateStatus('success', 'Attendance marked successfully!');
      this.addAttendanceRecord(attendanceData);
      setTimeout(() => this.resetForm(), 2000);
    } catch (err) {
      console.error('Capture failed:', err);
      this.updateStatus('error', err.message || 'Failed to mark attendance.');
    } finally {
      this.isCapturing = false;
      setTimeout(() => this.validateUserInfo(), 2000);
    }
  }

  // frame capture from video
  captureFrame() {
    let ctx = this.captureCanvas.getContext('2d');
    ctx.drawImage(this.videoElement, 0, 0, this.captureCanvas.width, this.captureCanvas.height);
    return this.captureCanvas.toDataURL('image/jpeg', 0.8);
  }

  // flash animation
  showCaptureEffect() {
    this.captureOverlay.classList.add('capture-flash');
    setTimeout(() => {
      this.captureOverlay.classList.remove('capture-flash');
    }, 500);
  }

  // fake face recognition for now
  simulateFaceRecognition() {
    return new Promise((res, rej) => {
      let time = 1000 + Math.random() * 1000;
      setTimeout(() => {
        if (Math.random() < 0.05) {
          rej(new Error('Face not recognized clearly'));
        } else {
          res();
        }
      }, time);
    });
  }

  // send data to backend
  async sendAttendanceData(imageData) {
    const payload = {
      userId: this.userIdInput.value.trim(),
      userName: this.userNameInput.value.trim(),
      confidence: (0.95 + Math.random() * 0.05).toFixed(2),
      imageData: imageData
    };

    try {
      const res = await fetch('/api/mark_attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (result.status === 'success') {
        return {
          userId: payload.userId,
          userName: payload.userName,
          confidence: parseFloat(payload.confidence),
          timestamp: new Date().toISOString()
        };
      } else if (result.status === 'exists') {
        throw new Error('Attendance already marked today');
      } else if (result.status === 'face_mismatch') {
        throw new Error(result.message || 'Face already linked to another ID');
      } else {
        throw new Error(result.message || 'Some backend error');
      }
    } catch (err) {
      throw new Error(err.message || 'Failed to connect to server');
    }
  }

  // fetch attendance list
  async loadAttendanceRecords() {
    try {
      const res = await fetch('/api/attendance_list');
      const data = await res.json();
      if (data.status === 'success') {
        this.attendanceRecords = data.data.map(d => ({
          userId: d.userId,
          userName: d.userName,
          confidence: parseFloat(d.confidence),
          timestamp: `${d.date}T${d.time}`
        }));
        this.renderAttendanceList();
      }
    } catch (err) {
      console.error('Error getting records:', err);
    }
  }

  // add new record
  addAttendanceRecord(record) {
    this.attendanceRecords.unshift(record);
    this.renderAttendanceList();
  }

  // show records on screen
  renderAttendanceList() {
    if (this.attendanceRecords.length === 0) {
      this.attendanceList.innerHTML = '<p class="no-records">No attendance records yet</p>';
      return;
    }

    let html = this.attendanceRecords.slice(0, 10).map(rec => {
      let d = new Date(rec.timestamp);
      let time = d.toLocaleTimeString();
      let date = d.toLocaleDateString();

      return `
        <div class="attendance-record">
          <div class="record-info">
            <div class="record-name">${rec.userName}</div>
            <div class="record-id">ID: ${rec.userId}</div>
          </div>
          <div class="record-details">
            <div class="record-time">${time}</div>
            <div class="record-date">${date}</div>
            <div class="record-confidence">Confidence: ${(rec.confidence * 100).toFixed(1)}%</div>
          </div>
          <div class="record-status success">✓</div>
        </div>
      `;
    }).join('');

    this.attendanceList.innerHTML = html;
  }

  // status box update
  updateStatus(type, message) {
    this.statusIndicator.className = `status-indicator ${type}`;
    this.statusText.textContent = message;
  }

  // reset input fields
  resetForm() {
    this.userIdInput.value = '';
    this.userNameInput.value = '';
    this.updateStatus('ready', 'Ready for next attendance');
  }

  // camera errors handle
  handleCameraError(err) {
    let msg = 'Camera error. ';
    if (err.name === 'NotAllowedError') {
      msg += 'Please allow access.';
    } else if (err.name === 'NotFoundError') {
      msg += 'No camera found.';
    } else {
      msg += 'Try again.';
    }
    this.updateStatus('error', msg);
  }
}

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  window.attendanceTracker = new AttendanceTracker();
});

// Just a log when tab changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden && window.attendanceTracker) {
    console.log('Tab hidden, camera still running.');
  }
});
