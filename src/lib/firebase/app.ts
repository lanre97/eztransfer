// Import the functions you need from the SDKs you need
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCjgroTBWuKGwsHDTbk2ejNWKzUTll1w1U",
  authDomain: "eztransfer-22e94.firebaseapp.com",
  projectId: "eztransfer-22e94",
  storageBucket: "eztransfer-22e94.appspot.com",
  messagingSenderId: "901539446184",
  appId: "1:901539446184:web:9197b7dc7710cb9112719d",
  measurementId: "G-DQ0D8LP35L"
};

// Initialize Firebase
let app:FirebaseApp;

if(!getApps().length){
  app = initializeApp(firebaseConfig);
}else{
  app = getApps()[0];
}

export default app;