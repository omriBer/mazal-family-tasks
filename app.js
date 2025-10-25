// app.js
// אחראי על ממשק המשתמש והאינטראקציה עם db.js (הדאטה בענן)

import {
  listKids,
  addKid,
  deleteKid,
  listTasks,
  addTask,
  deleteTaskDoc,
  toggleTaskDone,
  setParentNote,
  updateTask
} from "./db.js";

// מצביעים לאלמנטים קיימים ב-HTML שלך
const parentCard      = document.getElementById("parentCard");
const kidCard         = document.getElementById("kidCard");

const parentTabBtn    = document.getElementById("parentTab");
const kidTabBtn       = document.getElementById("kidTab");

const parentLocked    = document.getElementById("parentLocked");
const parentContent   = document.getElementById("parentContent");
const parentPassInput = document.getElementById("parentPassInput");
const lockWarn        = document.getElementById("lockWarn");

const parentKidsArea  = document.getElementById("parentKidsArea");
const overallProgress = document.getElementById("overallProgress");

const kidTabsArea     = document.getElementById("kidTabsArea");
const kidHeaderName   = document.getElementById("kidHeaderName");
const kidHeadlineEl   = document.getElementById("kidHeadline");
const kidSublineEl    = document.getElementById("kidSubline");
const kidTasksArea    = document.getElementById("kidTasksArea");

const openAddTaskBtn  = document.getElementById("openAddTask");
const taskModalBg     = document.getElementById("taskModalBg");
const taskChildSel    = document.getElementById("taskChild");
const taskTitleInp    = document.getElementById("taskTitle");
const taskMetaInp     = document.getElementById("taskMeta");

const replyModalBg    = document.getElementById("replyModalBg");
const replyTaskName   = document.getElementById("replyTaskName");
const replyText       = document.getElementById("replyText");

const manageKidsBg    = document.getElementById("manageKidsBg");
const kidsList        = document.getElementById("kidsList");
const newKidNameInp   = document.getElementById("newKidName");
const newKidIconInp   = document.getElementById("newKidIcon");
const newKidColorInp  = document.getElementById("newKidColor");

// מצב ריצה בזיכרון
let unlockedParent = false;
let currentKidId   = null;   // איזה ילד מוצג כרגע במסך "ילד"
let kidsCache      = [];     // [{id,name,icon,color,...}, ...]
let tasksCache     = {};     // { kidId: [ {id,title,...}, ... ] }
let replyCtx       = { kidId:null, taskId:null, taskTitle:"" };

const PARENT_PASSWORD = "9999";

// ------------------------------------------
// 1. נעילת הורה
// ------------------------------------------
window.openParentView = async function openParentView() {
  showView("parent");

  if (!unlockedParent) {
    parentLocked.style.display  = "block";
    parentContent.style.display = "none";
  } else {
    parentLocked.style.display  = "none";
    parentContent.style.display = "block";
    await renderParentView();
  }
};

window.tryUnlockParent = async function tryUnlockParent() {
  if (parentPassInput.value.trim() === PARENT_PASSWORD) {
    unlockedParent = true;
    lockWarn.textContent = "";
    parentLocked.style.display  = "none";
    parentContent.style.display = "block";
    await renderParentView();
  } else {
    lockWarn.textContent = "סיסמה לא נכונה";
  }
};

// ------------------------------------------
// 2. מעבר בין טאב הורה / ילד
// ------------------------------------------
window.showCard = async function showCard(which){
  showView(which);

  if (which === "kid") {
    await loadKidsIfNeeded();
    if (!currentKidId && kidsCache.length > 0) {
      currentKidId = kidsCache[0].id;
    }
    renderKidTabs();
    await renderKidView(currentKidId);
  }
};

function showView(which){
  if(which === "parent"){
    parentCard.classList.add("active");
    kidCard.classList.remove("active");
    parentTabBtn.classList.add("active");
    kidTabBtn.classList.remove("active");
  } else {
    kidCard.classList.add("active");
    parentCard.classList.remove("active");
    kidTabBtn.classList.add("active");
    parentTabBtn.classList.remove("active");
  }
}

// ------------------------------------------
// 3. טען ילדים ומשימות מה-DB
// ------------------------------------------
async function loadKidsIfNeeded() {
  if (kidsCache.length === 0) {
    kidsCache = await listKids(); // [{id,name,icon,color,...}, ...]
  }
}

async function loadTasksForKid(kidId) {
  const tasks = await listTasks(kidId);
  tasksCache[kidId] = tasks;
}

// ------------------------------------------
// 4. רנדר מסך ההורה
// ------------------------------------------
async function renderParentView() {
  // טען ילדים מהענן אם צריך
  await loadKidsIfNeeded();

  parentKidsArea.innerHTML = "";

  let total = 0;
  let done  = 0;

  for (const kid of kidsCache) {
    // טען משימות של כל ילד
    await loadTasksForKid(kid.id);
    const kidTasks = tasksCache[kid.id] || [];

    // חשב התקדמות
    kidTasks.forEach(t => {
      total++;
      if (t.done) done++;
    });

    // בניית בלוק ילד
    const kidBlock = document.createElement("div");
    kidBlock.className = "kid-block";

    const header = document.createElement("div");
    header.className = "kid-header";
    header.innerHTML = `
      <span class="kid-color-heart" style="color:${kid.color}">${kid.icon}</span>
      <span>${kid.name}</span>
    `;
    kidBlock.appendChild(header);

    // לכל משימה
    kidTasks.forEach(task => {
      const row = document.createElement("div");
      row.className = "task-row";

      row.innerHTML = `
        <div class="task-icon">${task.icon || ""}</div>
        <div class="task-main">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">${task.meta || ""}</div>
        </div>

        <div class="task-check">
          <input type="checkbox"
            ${task.done ? "checked":""}
            data-kid="${kid.id}"
            data-task="${task.id}" />

          <button class="task-small-btn blue"
            data-action="reply"
            data-kid="${kid.id}"
            data-task="${task.id}"
            data-title="${task.title}">
            הוסף תגובה 💬
          </button>

          <button class="task-small-btn red"
            data-action="delete"
            data-kid="${kid.id}"
            data-task="${task.id}">
            מחיקה 🗑
          </button>
        </div>
      `;

      kidBlock.appendChild(row);

      // בועות הערות
      if (task.childNote || task.parentNote){
        const fb = document.createElement("div");
        fb.className = "feedback-bubble";

        if (task.childNote){
          fb.innerHTML += `
            <span class="feedback-label">הערה מ${kid.name}:</span>
            ${task.childNote}
          `;
        }
        if (task.parentNote){
          fb.innerHTML += `
            <span class="feedback-label" style="color:var(--green)">תגובה הורה:</span>
            ${task.parentNote}
          `;
        }

        kidBlock.appendChild(fb);
      }
    });

    parentKidsArea.appendChild(kidBlock);
  }

  // הוספת מאזינים לצ'קבוקסים / כפתורי תגובה / מחיקה
  parentKidsArea.querySelectorAll("input[type=checkbox]").forEach(cb=>{
    cb.addEventListener("change", async e=>{
      const kidId  = e.target.getAttribute("data-kid");
      const taskId = e.target.getAttribute("data-task");
      const current = e.target.checked;
      // current = מצב לאחר השינוי, אבל toggleTaskDone הופך על בסיס מה שהיה קודם.
      // נחשב מה היה קודם:
      const before = !current;
      await toggleTaskDone(kidId, taskId, before);
      await renderParentView();
    });
  });

  parentKidsArea.querySelectorAll("button.task-small-btn").forEach(btn=>{
    btn.addEventListener("click", async e=>{
      const action = e.target.getAttribute("data-action");
      const kidId  = e.target.getAttribute("data-kid");
      const taskId = e.target.getAttribute("data-task");

      if(action === "delete"){
        await deleteTaskDoc(kidId, taskId);
        await renderParentView();
      } else if(action === "reply"){
        replyCtx.kidId = kidId;
        replyCtx.taskId = taskId;
        replyCtx.taskTitle = e.target.getAttribute("data-title") || "";
        openReplyModal();
      }
    });
  });

  // עדכון אחוז התקדמות
  const percent = total === 0 ? 0 : Math.round((done/total)*100);
  overallProgress.textContent = percent + "%";
}

// ------------------------------------------
// 5. מסך ילד
// ------------------------------------------
function renderKidTabs() {
  kidTabsArea.innerHTML = "";
  for (const kid of kidsCache) {
    const btn = document.createElement("button");
    btn.className = "kid-tab-btn" + (kid.id === currentKidId ? " active" : "");
    btn.textContent = kid.name;
    btn.addEventListener("click", async ()=>{
      currentKidId = kid.id;
      renderKidTabs();
      await renderKidView(kid.id);
    });
    kidTabsArea.appendChild(btn);
  }
}

async function renderKidView(kidId){
  const kid = kidsCache.find(k=>k.id === kidId);
  if(!kid) return;

  // נטען משימות של הילד אם אין בזיכרון
  if(!tasksCache[kidId]) {
    await loadTasksForKid(kidId);
  }
  const kidTasks = tasksCache[kidId] || [];

  kidHeaderName.textContent = "היי " + kid.name + " " + kid.icon;
  kidHeadlineEl.textContent = kid.childHeadline || "";
  kidSublineEl.textContent  = kid.childSubline || "";

  kidTasksArea.innerHTML = "";

  kidTasks.forEach(task => {
    const wrap = document.createElement("div");
    wrap.className = "child-task-row";

    const doneClass = task.done ? "child-task-done-btn done" : "child-task-done-btn";

    wrap.innerHTML = `
      <div class="child-task-head">
        <div class="child-task-title">${task.title} ${task.icon || ""}</div>
        <button class="${doneClass}"
          data-kid="${kidId}"
          data-task="${task.id}">
          ${task.done ? "✔ בוצע" : "סיימתי"}
        </button>
      </div>
      <div class="child-task-meta">${task.meta || ""}</div>
    `;

    // נחמיא לילד במשימה הראשונה
    if(task === kidTasks[0] && kid.parentPraise){
      const praise = document.createElement("div");
      praise.className = "parent-feedback-box";
      praise.innerHTML = `
        <span class="parent-feedback-label">פידבק מההורה</span>
        ${kid.parentPraise}
      `;
      wrap.appendChild(praise);
    }

    kidTasksArea.appendChild(wrap);
  });

  // לחיצה של הילד על "סיימתי"
  kidTasksArea.querySelectorAll("button.child-task-done-btn").forEach(btn=>{
    btn.addEventListener("click", async e=>{
      const kidId  = e.target.getAttribute("data-kid");
      const taskId = e.target.getAttribute("data-task");

      // צריך לדעת המצב הנוכחי כדי להפוך אותו
      const kidTasksList = tasksCache[kidId] || [];
      const task = kidTasksList.find(t => t.id === taskId);
      const before = !!task.done;

      await toggleTaskDone(kidId, taskId, before);

      // רענון מקומי
      await loadTasksForKid(kidId);
      await renderKidView(kidId);
      if (unlockedParent) {
        await renderParentView();
      }
    });
  });
}

// ------------------------------------------
// 6. מודאל הוספת משימה
// ------------------------------------------
window.openAddTaskModal = async function openAddTaskModal(){
  await loadKidsIfNeeded();

  taskChildSel.innerHTML = "";
  kidsCache.forEach(k=>{
    const opt = document.createElement("option");
    opt.value = k.id;
    opt.textContent = k.name;
    taskChildSel.appendChild(opt);
  });

  taskTitleInp.value = "";
  taskMetaInp.value  = "";

  taskModalBg.style.display = "flex";
};

window.closeModal = function closeModal(id){
  document.getElementById(id).style.display = "none";
};

window.saveNewTask = async function saveNewTask(){
  const kidId = taskChildSel.value;
  const title = taskTitleInp.value.trim();
  const meta  = taskMetaInp.value.trim();

  if(!title){
    alert("חייבים שם משימה 🙂");
    return;
  }

  await addTask(kidId, { title, meta });

  closeModal("taskModalBg");

  // טען מחדש משימות של הילד
  await loadTasksForKid(kidId);

  if (unlockedParent) {
    await renderParentView();
  }
  if (kidId === currentKidId) {
    await renderKidView(kidId);
  }
};

// ------------------------------------------
// 7. מודאל תגובה של הורה
// ------------------------------------------
function openReplyModal(){
  replyTaskName.textContent = replyCtx.taskTitle;
  replyText.value = "";
  replyModalBg.style.display = "flex";
}
window.saveReply = async function saveReply(){
  const note = replyText.value.trim() || null;
  await setParentNote(replyCtx.kidId, replyCtx.taskId, note);
  closeModal("replyModalBg");
  if (unlockedParent) {
    await renderParentView();
  }
  if (replyCtx.kidId === currentKidId) {
    await renderKidView(replyCtx.kidId);
  }
};

// ------------------------------------------
// 8. מודאל ניהול ילדים
// (שלב הבא: לחבר addKid/deleteKid כמו שעשינו קודם)
// ------------------------------------------

window.openManageKidsModal = async function openManageKidsModal(){
  await loadKidsIfNeeded();
  drawKidsList();
  manageKidsBg.style.display = "flex";
};

function drawKidsList(){
  kidsList.innerHTML = "";
  kidsCache.forEach(k=>{
    const row = document.createElement("div");
    row.className = "kid-list-row";
    row.innerHTML = `
      <span>
        <span style="color:${k.color}">${k.icon}</span>
        <span>${k.name}</span>
      </span>
      <button class="kid-remove-btn" data-kid="${k.id}">הסרה</button>
    `;
    kidsList.appendChild(row);
  });

  kidsList.querySelectorAll(".kid-remove-btn").forEach(btn=>{
    btn.addEventListener("click", async e=>{
      const kidId = e.target.getAttribute("data-kid");
      await deleteKid(kidId);
      kidsCache = kidsCache.filter(k => k.id !== kidId);
      // אם מחקתי את הילד שמוצג כרגע, נעבור לילד הבא
      if (kidId === currentKidId) {
        currentKidId = kidsCache[0]?.id || null;
      }
      drawKidsList();
      if (unlockedParent) {
        await renderParentView();
      }
      renderKidTabs();
      if (currentKidId) {
        await renderKidView(currentKidId);
      } else {
        kidTasksArea.innerHTML = "";
      }
    });
  });
}

window.addKid = async function addKidHandler(){
  const name  = newKidNameInp.value.trim();
  const icon  = newKidIconInp.value.trim() || "💛";
  const color = newKidColorInp.value.trim() || "var(--yellow)";
  if(!name){
    alert("שם ילד חובה");
    return;
  }

  const newKidId = await addKid({ name, icon, color });

  // עדכן קאש
  kidsCache.push({
    id: newKidId,
    name,
    icon,
    color,
    childHeadline: "היי " + name + " 😊",
    childSubline: "ברוך הבא למז״ל!",
    parentPraise: "כל הכבוד על ההתחלה 🌟"
  });

  newKidNameInp.value  = "";
  newKidIconInp.value  = "";
  newKidColorInp.value = "";

  drawKidsList();
  renderKidTabs();
};

// ------------------------------------------
// 9. התנהגות ראשונית בעת טעינת העמוד
// ------------------------------------------
(async function init(){
  // מסך ברירת מחדל: הורה נעול
  showView("parent");
  parentLocked.style.display = "block";
  parentContent.style.display = "none";

  // נטען ילדים (לטאב ילד בהמשך)
  await loadKidsIfNeeded();
  if (kidsCache.length > 0) {
    currentKidId = kidsCache[0].id;
  }

  renderKidTabs();
  if (currentKidId) {
    await renderKidView(currentKidId);
  }
})();
