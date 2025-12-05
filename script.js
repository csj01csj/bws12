// ---- 여기에 Firebase 설정 붙여넣기 ----
const firebaseConfig = {
  apiKey: "AIzaSyATPC-Rv1J31oikt0IAFZZw8nLLl0nAjTA",
  authDomain: "bw12-2e5ca.firebaseapp.com",
  databaseURL: "https://bw12-2e5ca-default-rtdb.firebaseio.com",
  projectId: "bw12-2e5ca",
  storageBucket: "bw12-2e5ca.firebasestorage.app",
  messagingSenderId: "9277025522",
  appId: "1:9277025522:web:6b5c9bb3a75610662df46b",
  measurementId: "G-YG9NBEGH2X"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ---- 화면 제어 ----
const loginDiv = document.getElementById("login");
const nickDiv = document.getElementById("nickname");
const chatDiv = document.getElementById("chat");
loginDiv.style.display = "block";

const CORRECT_PASSWORD = "1234";  // 원하는 비밀번호

function checkPassword() {
  const pw = document.getElementById("pw").value;
  if (pw === CORRECT_PASSWORD) {
    loginDiv.style.display = "none";
    nickDiv.style.display = "block";
  } else {
    alert("비밀번호가 틀렸습니다.");
  }
}

function saveNickname() {
  const nickname = document.getElementById("nick").value;
  if (!nickname) return alert("닉네임을 입력하세요.");

  localStorage.setItem("nickname", nickname);
  nickDiv.style.display = "none";
  chatDiv.style.display = "block";

  startChat();
}

// ---- 채팅 기능 ----
function startChat() {
  const messages = document.getElementById("messages");
  const chatRef = ref(db, "chatroom");

  onChildAdded(chatRef, function(data) {
    const msg = data.val();
    const div = document.createElement("div");
    div.className = "message";
    div.textContent = `${msg.name}: ${msg.text}`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  });
}

function sendMessage() {
  const text = document.getElementById("msg").value;
  if (!text) return;

  const nickname = localStorage.getItem("nickname");
  const chatRef = ref(db, "chatroom");

  push(chatRef, {
    name: nickname,
    text: text,
    time: Date.now()
  });

  document.getElementById("msg").value = "";
}
