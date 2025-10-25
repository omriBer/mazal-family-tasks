// app.js
// לוגיקת UI + חיבור ל-DB

import {
  listKids,
  addKid,
  deleteKid,
  listTasks,
  addTask,
  deleteTaskDoc,
  toggleTaskDone,
  setParentNote
} from "./db.js";

// אלמנטים עיקריים
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
const overallText     = document.getElementById("overallText");

const kidTabsArea     = document.getElementById("kidTabsArea");
const kidHeaderName   = document.getElementById("kidHeaderName");
const kidHeadlineEl   = document.getElementById("kidHeadline");
const kidSublineEl    = document.getElementById("kidSubline");
const kidTasksArea    = document.getElementById("kidTasksArea");

const taskModalBg     = document.getElementById("taskModalBg");
const taskChildSel    = document.getElementById("taskChild");
const taskTitleInp    = document.getElementById("taskTitle");
const taskMetaInp     = document.getElementById("taskMeta");

const replyModalBg    = document.getElementById("replyModalBg");
const replyTaskName   = document.getElementById("replyTaskName");
const replyTextEl     = document.getElementById("replyText");

const manageKidsBg    = document.getElementById("manageKidsBg");
const kidsList        = document.getElementById("kidsList");
const newKidNameInp   = document.getElementById("newKidName");
const newKidIconInp   = document.getElementById("newKidIcon");
const newKidColorInp  = document.getElementById("newKidColor");

const PARENT_PASSWORD = "9999";

// סטייט בריצה
let unlockedParent = false;
let kidsCache      = [];      // [{id, name, slug, ...}, ...]
let tasksCache     = {};      // { kidId : [ {id,title,...}, ... ] }
let currentKidId   = null;
let replyCtx       = { kidId:null, taskId:null, title:"" };

// --------------------------------------------------
// עזרי UI
// --------------------------------------------------
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

// --------------------------------------------------
// כניסה להורה
// --------------------------------------------------
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

// --------------------------------------------------
// מעבר בין כרטיס הורה/ילד
// --------------------------------------------------
window.showCard = async function showCard(which){
  showView(which);

  if (which === "kid") {
    await ensureKidsLoaded();

    // אם אין currentKidId עדיין – קח את הראשון ברשימה
    if (!currentKidId && kidsCache.length > 0) {
      currentKidId = kidsCache[0].id;
    }

    renderKidTabs();
    if (currentKidId) {
      await renderKidView(currentKidId);
    }
  }
};

// --------------------------------------------------
// טעינת דאטה מהענן
// --------------------------------------------------
async function ensureKidsLoaded() {
  if (kidsCache.length === 0) {
    kidsCache = await listKids();
  }
}

async function ensureTasksLoaded(kidId) {
  if (!tasksCache[kidId]) {
    tasksCache[kidId] = await listTasks(kidId);
  }
}

// --------------------------------------------------
// רינדור איזור ההורה
// --------------------------------------------------
async function renderParentView() {
  await ensureKidsLoaded();

  parentKidsArea.innerHTML = "";

  let totalTasks = 0;
  let doneTasks  = 0;

  for (const kid of kidsCache) {
    await ensureTasksLoaded(kid.id);
    const kidTasks = tasksCache[kid.id] || [];

    kidTasks.forEach(t => {
      totalTasks++;
      if (t.done) doneTasks++;
    });

    // בלוק ילד
    const kidBlock = document.createElement("div");
    kidBlock.className = "kid-block";

    const header = document.createElement("div");
    header.className = "kid-header";
    header.innerHTML = `
      <span class="kid-color-heart" style="color:${kid.color || 'inherit'}">${kid.icon || "💛"}</span>
      <span>${kid.name}</span>
    `;
    kidBlock.appendChild(header);

    // משימות
    kidTasks.forEach(task => {
      const row = document.createElement("div");
      row.className = "task-row";

      row.innerHTML = `
        <div class="task-main">
          <div class="task-title">${task.title} ${task.icon || ""}</div>
          <div class="task-meta">${task.meta || ""}</div>
        </div>

        <div class="task-check">
          <input
            type="checkbox"
            ${task.done ? "checked":""}
            data-kid="${kid.id}"
            data-task="${task.id}"
          />

          <button class="task-small-btn blue"
            data-action="reply"
            data-kid="${kid.id}"
            data-task="${task.id}"
            data-title="${task.title}">
            תגובה 💬
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

      // בועות משוב
      if (task.childNote || task.parentNote){
        const fb = document.createElement("div");
        fb.className = "feedback-bubble";

        if (task.childNote){
          fb.innerHTML += `
            <span class="feedback-label">הודעת ${kid.name}:</span>
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

  // מאזינים לצ'קבוקסים
  parentKidsArea
    .querySelectorAll("input[type=checkbox]")
    .forEach(cb => {
      cb.addEventListener("change", async e => {
        const kidId  = e.target.getAttribute("data-kid");
        const taskId = e.target.getAttribute("data-task");
        // האם היה done לפני השינוי?
        const kidTasksList = tasksCache[kidId] || [];
        const t = kidTasksList.find(x => x.id === taskId);
        const wasDone = t ? t.done : false;

        await toggleTaskDone(kidId, taskId, wasDone);
        tasksCache[kidId] = await listTasks(kidId); // רענון במטמון
        await renderParentView();
        if (kidId === currentKidId) {
          await renderKidView(kidId);
        }
      });
    });

  // מאזינים לכפתורי תגובה / מחיקה
  parentKidsArea
    .querySelectorAll("button.task-small-btn")
    .forEach(btn => {
      btn.addEventListener("click", async e => {
        const action = btn.getAttribute("data-action");
        const kidId  = btn.getAttribute("data-kid");
        const taskId = btn.getAttribute("data-task");

        if (action === "delete") {
          await deleteTaskDoc(kidId, taskId);
          tasksCache[kidId] = await listTasks(kidId);
          await renderParentView();
          if (kidId === currentKidId) {
            await renderKidView(kidId);
          }
        }

        if (action === "reply") {
          replyCtx.kidId    = kidId;
          replyCtx.taskId   = taskId;
          replyCtx.title    = btn.getAttribute("data-title") || "";
          openReplyModal();
        }
      });
    });

  // עדכון % התקדמות
  const percent = totalTasks === 0
    ? 0
    : Math.round((doneTasks / totalTasks) * 100);

  overallProgress.textContent = percent + "%";
  overallText.innerHTML = `<b>התקדמות כללית</b><br/>${doneTasks}/${totalTasks} משימות הושלמו`;
}

// --------------------------------------------------
// מסך ילד
// --------------------------------------------------
function renderKidTabs() {
  kidTabsArea.innerHTML = "";

  kidsCache.forEach(k => {
    const btn = document.createElement("button");
    btn.className = "kid-tab-btn" + (k.id === currentKidId ? " active" : "");
    btn.textContent = k.name;
    btn.addEventListener("click", async () => {
      currentKidId = k.id;
      renderKidTabs();
      await renderKidView(currentKidId);
    });
    kidTabsArea.appendChild(btn);
  });
}

async function renderKidView(kidId) {
  const kid = kidsCache.find(k => k.id === kidId);
  if (!kid) return;

  await ensureTasksLoaded(kidId);
  const kidTasks = tasksCache[kidId] || [];

  kidHeaderName.textContent = `היי ${kid.name} ${kid.icon || ""}`;
  kidHeadlineEl.textContent = kid.childHeadline || "";
  kidSublineEl.textContent  = kid.childSubline || "";

  kidTasksArea.innerHTML = "";

  kidTasks.forEach(task => {
    const wrap = document.createElement("div");
    wrap.className = "child-task-row";

    const doneClass = task.done
      ? "child-task-done-btn done"
      : "child-task-done-btn";

    wrap.innerHTML = `
      <div class="child-task-head">
        <div class="child-task-title">${task.title} ${task.icon || ""}</div>
        <button
          class="${doneClass}"
          data-kid="${kidId}"
          data-task="${task.id}"
        >
          ${task.done ? "✔ בוצע" : "סיימתי"}
        </button>
      </div>
      <div class="child-task-meta">${task.meta || ""}</div>
    `;

    // פידבק כללי מההורה לילד (parentPraise) מוצג מתחת למשימה הראשונה
    if (task === kidTasks[0] && kid.parentPraise) {
      const praise = document.createElement("div");
      praise.className = "parent-feedback-box";
      praise.innerHTML = `
        <span class="parent-feedback-label">מה ההורה חושב עליך 😍</span>
        ${kid.parentPraise}
      `;
      wrap.appendChild(praise);
    }

    kidTasksArea.appendChild(wrap);
  });

  // כפתור "סיימתי" של הילד
  kidTasksArea
    .querySelectorAll("button.child-task-done-btn")
    .forEach(btn => {
      btn.addEventListener("click", async e => {
        const kId  = btn.getAttribute("data-kid");
        const tId  = btn.getAttribute("data-task");

        // מה היה המצב לפני?
        const listRef = tasksCache[kId] || [];
        const item    = listRef.find(x => x.id === tId);
        const wasDone = item ? item.done : false;

        await toggleTaskDone(kId, tId, wasDone);

        // רענון
        tasksCache[kId] = await listTasks(kId);
        await renderKidView(kId);

        if (unlockedParent) {
          await renderParentView();
        }
      });
    });
}

// --------------------------------------------------
// מודאל משימה חדשה
// --------------------------------------------------
window.openAddTaskModal = async function openAddTaskModal() {
  await ensureKidsLoaded();

  taskChildSel.innerHTML = "";
  kidsCache.forEach(k => {
    const opt = document.createElement("option");
    opt.value = k.id;
    opt.textContent = k.name;
    taskChildSel.appendChild(opt);
  });

  taskTitleInp.value = "";
  taskMetaInp.value  = "";

  taskModalBg.style.display = "flex";
};

window.saveNewTask = async function saveNewTask() {
  const kidId = taskChildSel.value;
  const title = taskTitleInp.value.trim();
  const meta  = taskMetaInp.value.trim();

  if (!title) {
    alert("חייבים שם משימה 🙂");
    return;
  }

  await addTask(kidId, { title, meta });

  taskModalBg.style.display = "none";

  tasksCache[kidId] = await listTasks(kidId);

  if (unlockedParent) {
    await renderParentView();
  }
  if (kidId === currentKidId) {
    await renderKidView(kidId);
  }
};

window.closeModal = function closeModal(id){
  document.getElementById(id).style.display = "none";
};

// --------------------------------------------------
// מודאל תגובת הורה
// --------------------------------------------------
function openReplyModal() {
  replyTaskName.textContent = replyCtx.title;
  replyTextEl.value = "";
  replyModalBg.style.display = "flex";
}
window.saveReply = async function saveReply() {
  const note = replyTextEl.value.trim();

  await setParentNote(replyCtx.kidId, replyCtx.taskId, note);

  replyModalBg.style.display = "none";

  // רענון
  tasksCache[replyCtx.kidId] = await listTasks(replyCtx.kidId);
  if (unlockedParent) {
    await renderParentView();
  }
  if (replyCtx.kidId === currentKidId) {
    await renderKidView(replyCtx.kidId);
  }
};

// --------------------------------------------------
// מודאל ניהול ילדים
// --------------------------------------------------
window.openManageKidsModal = async function openManageKidsModal() {
  await ensureKidsLoaded();
  drawKidsList();
  manageKidsBg.style.display = "flex";
};

function drawKidsList() {
  kidsList.innerHTML = "";
  const base = window.location.origin + window.location.pathname;

  kidsCache.forEach(k => {
    const kidLinkSlug = k.slug || k.id;
    const link = `${base}?kid=${kidLinkSlug}`;

    const row = document.createElement("div");
    row.className = "kid-list-row";

    row.innerHTML = `
      <div class="kid-row-left">
        <span style="color:${k.color || 'inherit'}">${k.icon || "💛"}</span>
        <span>${k.name}</span>
      </div>
      <div class="kid-row-actions">
        <button class="kid-link-btn" data-link="${link}">
          📎 קישור
        </button>
        <button class="kid-remove-btn" data-kid="${k.id}">
          הסרה
        </button>
      </div>
    `;

    kidsList.appendChild(row);
  });

  // כפתור העתקת קישור
  kidsList.querySelectorAll(".kid-link-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      const link = btn.getAttribute("data-link");
      navigator.clipboard.writeText(link);
      alert(`הקישור הועתק 📋:\n${link}\nשלח בוואטסאפ לילד`);
    });
  });

  // כפתור הסרת ילד
  kidsList.querySelectorAll(".kid-remove-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      const kidId = btn.getAttribute("data-kid");
      await deleteKid(kidId);

      // עדכן קאש
      kidsCache = kidsCache.filter(x => x.id !== kidId);
      delete tasksCache[kidId];

      // אם מחקתי את מי שמוצג עכשיו בילד -> לעבור לאחר
      if (currentKidId === kidId) {
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
        kidHeadlineEl.textContent = "";
        kidSublineEl.textContent  = "";
        kidHeaderName.textContent = "אין ילדים כרגע 🙃";
      }
    });
  });
}

window.addKid = async function addKidHandler(){
  const name  = newKidNameInp.value.trim();
  const icon  = newKidIconInp.value.trim()  || "💛";
  const color = newKidColorInp.value.trim() || "var(--yellow)";

  if (!name) {
    alert("שם ילד חובה");
    return;
  }

  // הוספה בענן
  const newKidId = await addKid({ name, icon, color });

  // עדכון קאש מקומי: נטען מחדש את כל הילדים (פשוט ובטוח)
  kidsCache = await listKids();

  // נקה טופס
  newKidNameInp.value  = "";
  newKidIconInp.value  = "";
  newKidColorInp.value = "";

  drawKidsList();
  renderKidTabs();

  // אם אין currentKidId עדיין, קח את זה שיצרנו עכשיו
  if (!currentKidId && kidsCache.length > 0) {
    currentKidId = kidsCache[kidsCache.length - 1].id;
    await renderKidView(currentKidId);
  }
};

// --------------------------------------------------
// INIT – מה קורה כשהעמוד נטען
// --------------------------------------------------
(async function init(){
  // טען את רשימת הילדים מהענן
  await ensureKidsLoaded();

  // בדוק אם הגיעו עם קישור אישי ?kid=slug
  const params  = new URLSearchParams(window.location.search);
  const kidSlug = params.get("kid");

if (kidSlug) {
  // החבא את כל ממשק ההורה לגמרי
  document.querySelector(".view-toggle").style.display = "none";
  document.getElementById("parentCard").style.display = "none";
  document.getElementById("parentLocked").style.display = "none";
  document.getElementById("parentContent").style.display = "none";

  // הצג רק את מסך הילד
  const kid = kidsCache.find(k =>
    k.slug === kidSlug || k.id === kidSlug
  );

  if (kid) {
    currentKidId = kid.id;
    showView("kid");
    renderKidTabs();
    await renderKidView(currentKidId);
    return;
  } else {
    alert("לא נמצא ילד בשם הזה 🤔");
  }
}


    // נסה לזהות את הילד לפי slug או לפי ה-id של הדוקומנט
    const kid = kidsCache.find(k =>
      k.slug === kidSlug || k.id === kidSlug
    );

    if (kid) {
      currentKidId = kid.id;
      showView("kid");
      renderKidTabs();
      await renderKidView(currentKidId);
      return;
    } else {
      alert("לא נמצא ילד בשם הזה 🤔");
    }
  }

  // ברירת מחדל: הורה (נעול)
  showView("parent");
  parentLocked.style.display  = "block";
  parentContent.style.display = "none";

  // נכין גם את מסך הילד לברירת מחדל
  if (kidsCache.length > 0) {
    currentKidId = kidsCache[0].id;
    renderKidTabs();
    await renderKidView(currentKidId);
  }
})();
