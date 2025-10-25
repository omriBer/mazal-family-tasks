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
  deleteDoc,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// הקונפיג מהפרויקט שלך ב-Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBfGOSPtF33dgN6bPhpgUrXT-eEyf6e8rI",
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
//     order
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
// הודעות ילד-הורה
// ----------------------------------------------------

export async function addMessage(kidId, text, from, replyToMessageId = "") {
  if (!kidId) {
    throw new Error("kidId is required to add a message");
  }
  const cleanText = (text ?? "").trim();
  if (!cleanText) {
    throw new Error("message text is empty");
  }
  const normalizedFrom = from === "parent" ? "parent" : "child";

  const msgsCol = collection(db, "kids", kidId, "messages");
  const payload = {
    from: normalizedFrom,
    text: cleanText,
    ts: Date.now(),
    replyToMessageId: replyToMessageId || ""
  };

  const res = await addDoc(msgsCol, payload);
  return res.id;
}

export async function listMessages(kidId) {
  if (!kidId) {
    return [];
  }
  const msgsCol = collection(db, "kids", kidId, "messages");
  const q = query(msgsCol, orderBy("ts", "desc"));
  const snap = await getDocs(q);

  const messages = [];
  snap.forEach(docSnap => {
    messages.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  return messages;
}

export async function addParentReply(kidId, text, replyToMessageId = "") {
  return addMessage(kidId, text, "parent", replyToMessageId);
}

export async function deleteMessage(kidId, messageId) {
  if (!kidId || !messageId) return;
  const ref = doc(db, "kids", kidId, "messages", messageId);
  await deleteDoc(ref);
}

// ----------------------------------------------------
// Real-time subscriptions
// ----------------------------------------------------

export function subscribeMessages(kidId, callback) {
  if (!kidId || typeof callback !== "function") {
    return () => {};
  }

  const msgsCol = collection(db, "kids", kidId, "messages");
  const q = query(msgsCol, orderBy("ts", "desc"));

  const unsubscribe = onSnapshot(
    q,
    snap => {
      const messages = [];
      snap.forEach(docSnap => {
        messages.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      callback(messages, null);
    },
    error => {
      console.error("subscribeMessages error", error);
      callback([], error);
    }
  );

  return unsubscribe;
}

export function subscribeTasks(kidId, callback) {
  if (!kidId || typeof callback !== "function") {
    return () => {};
  }

  const tasksCol = collection(db, "kids", kidId, "tasks");

  const unsubscribe = onSnapshot(
    tasksCol,
    snap => {
      const tasks = [];
      snap.forEach(docSnap => {
        tasks.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      callback(tasks, null);
    },
    error => {
      console.error("subscribeTasks error", error);
      callback([], error);
    }
  );

  return unsubscribe;
}
