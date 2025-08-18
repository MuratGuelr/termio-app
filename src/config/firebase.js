import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCqMRYutVVG2uA8vus_qPOHmJ4lcj88zOc",
  authDomain: "termino-88e3f.firebaseapp.com",
  projectId: "termino-88e3f",
  storageBucket: "termino-88e3f.firebasestorage.app",
  messagingSenderId: "478107821303",
  appId: "1:478107821303:web:52a94ffc65454eef551ff2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;
