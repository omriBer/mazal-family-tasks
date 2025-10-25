// db.js
// שכבת גישה לדאטה בענן (Firestore)
// קובץ זה נטען ישירות מהדפדפן, בלי שרת באמצע.

// 1. ייבוא ה-SDK מה-CDN הרשמי של Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// 2. הקונפיגורציה שלך מה-Firebase Console
// חשוב: כאן אתה תדביק את ה-config שקיבלת כשהגדרת Web App.
// זה נראה כמו אובייקט עם apiKey, authDomain, projectId וכו'.
const firebaseConfig = {
  apiKey: "TODO_REPLACE_ME",
  authDomain: "TODO_REPLACE_ME",
  projectId: "TODO_REPLACE_ME",
  storageBucket: "TODO_REPLACE_ME",
  messagingSenderId: "TODO_REPLACE_ME",
  appId: "TODO_REPLACE_ME"
};

// 3. אתחול ה-Firebase וה-DB
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// -------------------------------------------------------------------
// מבנה הנתונים שאנחנו עובדים איתו:
//
// kids (collection)
//   kidId (document)  -> fields: name, icon, color, childHeadline, childSubline, parentPraise, order
//      tasks (subcollection)
//         taskId (document) -> fields: title, meta, icon, done, childNote, parentNote
// -------------------------------------------------------------------


// ---- KIDS ----

// קבלת כל הילדים, ממויינים לפי order (מספר קטן->גבוה)
export async function listKids() {
  const kidsCol = collection(db, "kids");
  const snap = await getDocs(kidsCol);

  // נמיר את ה-docs לאובייקטים
  let kids = [];
  snap.forEach(docSnap => {
    const data = docSnap.data();
    kids.push({
      id: docSnap.id,
      ...data
    });
  });

  // מיון לפי order אם קיים
  kids.sort((a,b) => {
    const ao = (a.order ?? 0);
    const bo = (b.order ?? 0);
    return ao - bo;
  });

  return kids;
}

// יצירת ילד חדש
export async function addKid({ name, icon="💛", color="var(--yellow)" }) {
  const kidsCol = collection(db, "kids");
  const newKid = {
    name,
    icon,
    color,
    childHeadline: "היי " + name + " 😊",
    childSubline: "ברוך הבא למז״ל!",
    parentPraise: "כל הכבוד על ההתחלה 🌟",
    order: Date.now() // נשים order לפי זמן יצירה כדי שלא יתנגש
  };
  const res = await addDoc(kidsCol, newKid);
  return res.id;
}

// מחיקת ילד (כולל המשימות שלו)
// שים לב: זה מוחק רק את המסמך של הילד. Firestore לא מוחק אוטומטית את ה-subcollection.
// לפיילוט המשפחתי זה מספיק, אבל בייצור אמיתי היינו צריכים לעבור task-Task ולמחוק.
export async function deleteKid(kidId) {
  await deleteDoc(doc(db, "kids", kidId));
  // הערה: זה ישאיר יתומים ב-"tasks" אם נשמרו כ-subcollection.
  // בפתרון המשפחתי זה כנראה מספיק.
}

// ---- TASKS ----

// החזרת כל המשימות של ילד מסוים
export async function listTasks(kidId) {
  const tasksCol = collection(db, "kids", kidId, "tasks");
  const snap = await getDocs(tasksCol);

  let tasks = [];
  snap.forEach(docSnap => {
    const data = docSnap.data();
    tasks.push({
      id: docSnap.id,
      ...data
    });
  });

  // אין לנו order למשימות כרגע, אפשר להשאיר כמו שבא או למיין לפי title
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
    childNote: null,
    parentNote: null
  };
  const res = await addDoc(tasksCol, newTask);
  return res.id;
}

// עדכון משימה (לדוגמה סימון בוצע, הוספת תגובת הורה)
export async function updateTask(kidId, taskId, patchObj) {
  const taskRef = doc(db, "kids", kidId, "tasks", taskId);
  await updateDoc(taskRef, patchObj);
}

// מחיקת משימה
export async function deleteTaskDoc(kidId, taskId) {
  const taskRef = doc(db, "kids", kidId, "tasks", taskId);
  await deleteDoc(taskRef);
}

// פונקציה מהירה לסימון/ביטול "בוצע"
export async function toggleTaskDone(kidId, taskId, currentDone) {
  await updateTask(kidId, taskId, { done: !currentDone });
}

// פונקציה להוספת תגובת הורה
export async function setParentNote(kidId, taskId, noteText) {
  await updateTask(kidId, taskId, { parentNote: noteText || null });
}
