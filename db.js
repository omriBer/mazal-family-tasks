// db.js
// חיבור לאפליקציית Firebase שלך + פעולות CRUD ב-Firestore

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// 🔹 הגדרות מה-Firebase שלך
const firebaseConfig = {
  apiKey: "AIzaSyDdEhEqRRQDKUmTJ73c3LLKxP8s4q5WIec",
  authDomain: "mazal-family.firebaseapp.com",
  projectId: "mazal-family",
  storageBucket: "mazal-family.firebasestorage.app",
  messagingSenderId: "495595541465",
  appId: "1:495595541465:web:c33f365ad6f8552bd13fc8"
};

// 🔹 אתחול האפליקציה והחיבור למסד הנתונים
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ======================================================
// פונקציות לשליפה, הוספה, עדכון ומחיקה של נתונים
// ======================================================

// --- ילדים ---
export async function listKids() {
  const kidsCol = collection(db, "kids");
  const snap = await getDocs(kidsCol);
  let kids = [];
  snap.forEach(docSnap => {
    kids.push({ id: docSnap.id, ...docSnap.data() });
  });
  kids.sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
  return kids;
}

export async function addKid({ name, icon="💛", color="var(--yellow)" }) {
  const kidsCol = collection(db, "kids");
  const newKid = {
    name,
    icon,
    color,
    childHeadline: `היי ${name} 😊`,
    childSubline: "ברוך הבא למז״ל!",
    parentPraise: "כל הכבוד על ההתחלה 🌟",
    order: Date.now()
  };
  const res = await addDoc(kidsCol, newKid);
  return res.id;
}

export async function deleteKid(kidId) {
  await deleteDoc(doc(db, "kids", kidId));
}

// --- משימות ---
export async function listTasks(kidId) {
  const tasksCol = collection(db, "kids", kidId, "tasks");
  const snap = await getDocs(tasksCol);
  let tasks = [];
  snap.forEach(docSnap => {
    tasks.push({ id: docSnap.id, ...docSnap.data() });
  });
  return tasks;
}

export async function addTask(kidId, { title, meta="", icon="🆕" }) {
  const tasksCol = collection(db, "kids", kidId, "tasks");
  const newTask = {
    title,
    meta,
    icon,
    done: false,
    childNote: "",
    parentNote: ""
  };
  const res = await addDoc(tasksCol, newTask);
  return res.id;
}

export async function updateTask(kidId, taskId, patch) {
  const ref = doc(db, "kids", kidId, "tasks", taskId);
  await updateDoc(ref, patch);
}

export async function deleteTaskDoc(kidId, taskId) {
  const ref = doc(db, "kids", kidId, "tasks", taskId);
  await deleteDoc(ref);
}

export async function toggleTaskDone(kidId, taskId, currentDone) {
  await updateTask(kidId, taskId, { done: !currentDone });
}

export async function setParentNote(kidId, taskId, noteText) {
  await updateTask(kidId, taskId, { parentNote: noteText || "" });
}
