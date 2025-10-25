// db.js
// שכבת גישה ל-Firebase Firestore

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

// הקונפיג מהפרויקט שלך ב-Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDdEhEqRRQDKUmTJ73c3LLKxP8s4q5WIec",
  authDomain: "mazal-family.firebaseapp.com",
  projectId: "mazal-family",
  storageBucket: "mazal-family.firebasestorage.app",
  messagingSenderId: "495595541465",
  appId: "1:495595541465:web:c33f365ad6f8552bd13fc8"
};

// אתחול
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ----------------------------------------------------
// kids collection
//   kidDoc: {
//     name, slug, icon, color,
//     childHeadline, childSubline,
//     parentPraise, order
//   }
//
// kids/{kidId}/tasks/{taskId}
//   taskDoc: {
//     title, meta, icon,
//     done, childNote, parentNote
//   }
//
// kids/{kidId}/messages/{messageId}
//   messageDoc: {
//     from: "child" | "parent",
//     text: string,
//     ts: number (Date.now()),
//     replyToMessageId: string
//   }
// ----------------------------------------------------


// שליפת כל הילדים
export async function listKids() {
  const kidsCol = collection(db, "kids");
  const snap = await getDocs(kidsCol);

  let kids = [];
  snap.forEach(docSnap => {
    kids.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  kids.sort((a,b) => {
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    return ao - bo;
  });

  return kids;
}

// יצירת ילד חדש
export async function addKid({ name, icon="💛", color="var(--yellow)" }) {
  const kidsCol = collection(db, "kids");

  // slug אוטומטי בסיסי
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "");

  const newKid = {
    name,
    slug,
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

// מחיקת ילד
// שים לב: Firestore לא מוחק אוטומטית את תתי האוספים (tasks/messages)
// ל-MVP זה כנראה מספיק.
export async function deleteKid(kidId) {
  await deleteDoc(doc(db, "kids", kidId));
}

// שליפת משימות של ילד
export async function listTasks(kidId) {
  const tasksCol = collection(db, "kids", kidId, "tasks");
  const snap = await getDocs(tasksCol);

  let tasks = [];
  snap.forEach(docSnap => {
    tasks.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  return tasks;
}

// הוספת משימה לילד
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

// עדכון משימה
export async function updateTask(kidId, taskId, patch) {
  const ref = doc(db, "kids", kidId, "tasks", taskId);
  await updateDoc(ref, patch);
}

// מחיקת משימה
export async function deleteTaskDoc(kidId, taskId) {
  const ref = doc(db, "kids", kidId, "tasks", taskId);
  await deleteDoc(ref);
}

// סימון/ביטול "בוצע"
export async function toggleTaskDone(kidId, taskId, wasDoneBefore) {
  await updateTask(kidId, taskId, { done: !wasDoneBefore });
}

// עדכון תגובת הורה למשימה ספציפית
export async function setParentNote(kidId, taskId, noteText) {
  await updateTask(kidId, taskId, { parentNote: noteText || "" });
}

// ----------------------------------------------------
// הודעות בין הילד להורה
// ----------------------------------------------------

// הוספת הודעה (ילד או הורה)
export async function addMessage(kidId, text, from = "child") {
  const messagesCol = collection(db, "kids", kidId, "messages");
  const msg = {
    from, // "child" או "parent"
    text,
    ts: Date.now(),
    replyToMessageId: ""
  };
  const res = await addDoc(messagesCol, msg);
  return res.id;
}

// שליפת כל ההודעות של ילד
export async function listMessages(kidId) {
  const messagesCol = collection(db, "kids", kidId, "messages");
  const snap = await getDocs(messagesCol);

  let msgs = [];
  snap.forEach(docSnap => {
    msgs.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  // מיון מהישן לחדש
  msgs.sort((a,b) => (a.ts||0) - (b.ts||0));
  return msgs;
}

// שליחת הודעה בתור הורה
export async function addParentReply(kidId, text) {
  return addMessage(kidId, text, "parent");
}
