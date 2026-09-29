import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAnalytics, isSupported, logEvent } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBDrVRJhpBDbFYvCMI7np3BqJ1K7tLVank',
  authDomain: 'nidharna-b4e31.firebaseapp.com',
  projectId: 'nidharna-b4e31',
  storageBucket: 'nidharna-b4e31.firebasestorage.app',
  messagingSenderId: '847198633577',
  appId: '1:847198633577:web:d943f90976c77f9bdf6cf8',
  measurementId: 'G-8QS04DS4LQ'
};

const app = initializeApp(firebaseConfig);
let analytics = null;
window.castleFirebaseStatus = 'unsupported';
try {
  if (await isSupported()) {
    analytics = getAnalytics(app);
    window.castleFirebaseStatus = 'ready';
  }
} catch (_) {
  analytics = null;
  window.castleFirebaseStatus = 'error';
}

window.castleTrack = (name, details = {}) => {
  if (analytics) {
    try { logEvent(analytics, name, details); } catch (_) { /* Analytics must not interrupt gameplay. */ }
  }
};