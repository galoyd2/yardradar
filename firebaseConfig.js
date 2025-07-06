import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBBQJdkawY2qNJ26EhlChRaHokOF8kjrqk",
  authDomain: "yardradar-bca54.firebaseapp.com",
  projectId: "yardradar-bca54",
  storageBucket: "yardradar-bca54.firebasestorage.app",
  messagingSenderId: "1077000204968",
  appId: "1:1077000204968:web:53ed0937f1112d711a889d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
