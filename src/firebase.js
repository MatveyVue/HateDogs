import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCBF04Lm-m8XF6hzRELSNLj-UI2t8EL_jM',
  authDomain: 'hatedogs.firebaseapp.com',
  projectId: 'hatedogs',
  storageBucket: 'hatedogs.firebasestorage.app',
  messagingSenderId: '1068394956407',
  appId: '1:1068394956407:web:7187efd90f1ba8bc856872',
  measurementId: 'G-299Y1VSKWW'
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);