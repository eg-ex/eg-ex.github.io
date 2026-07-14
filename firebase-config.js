

const firebaseConfig = {
    apiKey: "AIzaSyA21JnXTlM6qWq1wKz49Gbux2inFCiY25g",
    authDomain: "elgohary-56840.firebaseapp.com",
    databaseURL: "https://selahelazhary-67792-default-rtdb.firebaseio.com",
    projectId: "elgohary-56840",
    storageBucket: "elgohary-56840.firebasestorage.app",
    messagingSenderId: "41672086437",
    appId: "1:41672086437:web:113a39a9bb3cd690b28e4c",
    measurementId: "G-40K791PR05"
};

// تهيئة Firebase وإتاحة الكائنات لباقي السكربتات
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
