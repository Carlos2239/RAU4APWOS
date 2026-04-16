import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDWLd_tRW-cU0m0n-A0TxKuVekIMEVTwSM",
    authDomain: "digital-b1a06.firebaseapp.com",
    projectId: "digital-b1a06",
    storageBucket: "digital-b1a06.firebasestorage.app",
    messagingSenderId: "1063750129851",
    appId: "1:1063750129851:web:0986889bf055792856319e",
    measurementId: "G-KFSKLCCMH2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
