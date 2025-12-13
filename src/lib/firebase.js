import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Configuration using the provided DB URL. 
// Note: Missing API Key and other details which are required for full functionality.
const firebaseConfig = {
    apiKey: "AIzaSyDomIzxPZQYlNAq-0Bnif1ndxDghv5ZXrw",
    authDomain: "wonnec-a81fb.firebaseapp.com",
    databaseURL: "https://wonnec-a81fb-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "wonnec-a81fb",
    storageBucket: "wonnec-a81fb.firebasestorage.app",
    messagingSenderId: "689747008847",
    appId: "1:689747008847:web:8c965eeebf8ba5f188f93a",
    measurementId: "G-10XQYFFJ50"
}


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
