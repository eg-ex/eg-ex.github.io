

const firebaseConfig = {
    apiKey: "AIzaSyDo2v1boaj3i5C8SC1AZzEUFd3OqvXfiqs",
    authDomain: "selahelazhary-67792.firebaseapp.com",
    databaseURL: "https://selahelazhary-67792-default-rtdb.firebaseio.com",
    projectId: "selahelazhary-67792",
    storageBucket: "selahelazhary-67792",
    messagingSenderId: "235914603020",
    appId: "1:235914603020:web:e47c2edb9ab4534f3e9c29",
    measurementId: "G-ZW3E2Z04QF"
};

// تهيئة Firebase وإتاحة الكائنات لباقي السكربتات
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
