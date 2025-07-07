// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Only import this on React Native (not web)
const firebaseConfig = {
  apiKey: "AIzaSyBBQJdkawY2qNJ26EhlChRaHokOF8kjrqk",
  authDomain: "yardradar-bca54.firebaseapp.com",
  projectId: "yardradar-bca54",
  storageBucket: "yardradar-bca54.appspot.com",
  messagingSenderId: "1077000204968",
  appId: "1:1077000204968:web:53ed0937f1112d711a889d"
};

// Initialize the core app
const app = initializeApp(firebaseConfig);

// ✅ Initialize Auth *immediately* with persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Other services
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
