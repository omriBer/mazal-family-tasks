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
  setParentNote,
  addMessage,
  listMessages,
  addParentReply,
  deleteMessage
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
const kidMessagesArea = document.getElementById("kidMessagesArea");

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
let messagesCache  = {};      // { kidId : [ {id,from,text,ts}, ... ] }
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

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMessageText(str = "") {
  return escapeHtml(str).replace(/\n/g, "<br/>");
}

function sortTasksForDisplay(tasks = []) {
  return [...tasks].sort((a, b) => {
    if (!!a.done === !!b.done) return 0;
    return a.done ? 1 : -1;
  });
}

function buildChatHtml(messages = [], { allowDelete = false, kidId = "", emptyText = "" } = {}) {
  if (!messages || messages.length === 0) {
    const text = emptyText || "אין הודעות";
    return `<div class="msg-empty">${escapeHtml(text)}</div>`;
  }

  return messages.map(m => {
    const directionClass = m.from === "parent" ? "parent" : "child";
    const textHtml       = formatMessageText(m.text || "");
    const deleteHtml = allowDelete && m.from === "parent"
      ? `<button class="chat-delete" data-kid="${kidId}" data-message="${m.id}" title="מחיקת הודעת הורה">🗑️</button>`
      : "";

    return `
      <div class="chat-row ${directionClass}">
        <div class="chat-bubble">
          <div class="chat-text">${textHtml}</div>
          ${deleteHtml}
        </div>
      </div>
    `;
  }).join("");
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
    try {
      await renderParentView();
    } catch (err) {
      console.error("renderParentView error:", err);
    }
  }
};

window.tryUnlockParent = async function tryUnlockParent() {
  if (parentPassInput.value.trim() === PARENT_PASSWORD) {
    unlockedParent = true;
    lockWarn.textContent = "";
    parentLocked.style.display  = "none";
    parentContent.style.display = "block";
    try {
      await renderParentView();
    } catch (err) {
      console.error("renderParentView error:", err);
    }
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

    if (!currentKidId && kidsCache.length > 0) {
      currentKidId = kidsCache[0].id;
    }

    renderKidTabs();

    if (currentKidId) {
      await renderKidView(currentKidId);
    } else {
      kidTasksArea.innerHTML = "אין ילדים עדיין 🤔";
      if (kidMessagesArea) {
        kidMessagesArea.innerHTML = "";
      }
    }
  }

  if (which === "parent") {
    if (!unlockedParent) {
      parentLocked.style.display  = "block";
      parentContent.style.display = "none";
    } else {
      parentLocked.style.display  = "none";
      parentContent.style.display = "block";
      try {
        await renderParentView();
      } catch (err) {
        console.error("renderParentView error:", err);
      }
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

async function ensureMessagesLoaded(kidId, { force = false } = {}) {
  if (!kidId) return;
  if (!messagesCache[kidId] || force) {
    messagesCache[kidId] = await listMessages(kidId);
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
    await ensureMessagesLoaded(kid.id, { force: true });

    const kidTasks = sortTasksForDisplay(tasksCache[kid.id] || []);
    const msgs     = messagesCache[kid.id] || [];

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
      <span class="kid-color-heart" style="color:${kid.color || 'inherit'}">${escapeHtml(kid.icon || "💛")}</span>
      <span>${escapeHtml(kid.name || "")}</span>
    `;
    kidBlock.appendChild(header);

    // משימות
    kidTasks.forEach(task => {
      const row = document.createElement("div");
      row.className = "task-row" + (task.done ? " task-done" : "");

      const icon = task.icon ? escapeHtml(task.icon) : "⭐️";
      const metaHtml = task.meta ? `<div class="task-meta">${escapeHtml(task.meta || "")}</div>` : "";

      row.innerHTML = `
        <div class="task-main">
          <div class="task-title">
            <span class="task-icon">${icon}</span>
            <span class="task-title-text">${escapeHtml(task.title || "")}</span>
          </div>
          ${metaHtml}
        </div>

        <div class="task-check">
          <input
            type="checkbox"
            ${task.done ? "checked" : ""}
            data-kid="${kid.id}"
            data-task="${task.id}"
            aria-label="${task.done ? "בטל סימון משימה" : "סמן משימה כהושלמה"}"
          />

          <button class="task-small-btn blue"
            data-action="reply"
            data-kid="${kid.id}"
            data-task="${task.id}"
            data-title="${escapeHtml(task.title || "")}">
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

      // בועות משוב למשימה עצמה
      if (task.childNote || task.parentNote){
        const fb = document.createElement("div");
        fb.className = "feedback-bubble";

        if (task.childNote){
          fb.innerHTML += `
            <span class="feedback-label">הודעת ${escapeHtml(kid.name || "") }:</span>
            ${escapeHtml(task.childNote || "")}
          `;
        }
        if (task.parentNote){
          fb.innerHTML += `
            <span class="feedback-label" style="color:var(--green)">תגובה הורה:</span>
            ${escapeHtml(task.parentNote || "")}
          `;
        }
        kidBlock.appendChild(fb);
      }
    });

    // הודעות כלליות (צ'אט ילד-הורה)
    const messageTitle = escapeHtml(kid.name || "");
    const msgWrap = document.createElement("div");
    msgWrap.className = "messages-block";
    msgWrap.innerHTML = `
      <div class="messages-title">שיחות עם ${messageTitle} 💬</div>
      <div class="messages-list chat-thread">
        ${buildChatHtml(msgs, { allowDelete: true, kidId: kid.id, emptyText: "אין עדיין הודעות" })}
      </div>

      <div class="msg-reply-area">
        <textarea
          class="msg-reply-input"
          placeholder="רוצה לשלוח הודעה לילד? 💖"
          data-kid="${kid.id}"
        ></textarea>
        <button
          class="msg-reply-send-btn"
          data-kid="${kid.id}"
        >שליחת הודעת הורה ➜</button>
      </div>
    `;
    kidBlock.appendChild(msgWrap);

    parentKidsArea.appendChild(kidBlock);
  }

  // מאזינים לצ'קבוקסים של המשימות
  parentKidsArea
    .querySelectorAll("input[type=checkbox]")
    .forEach(cb => {
      cb.addEventListener("change", async e => {
        const kidId  = e.target.getAttribute("data-kid");
        const taskId = e.target.getAttribute("data-task");
        const kidTasksList = tasksCache[kidId] || [];
        const t = kidTasksList.find(x => x.id === taskId);
        const wasDone = t ? t.done : false;

        await toggleTaskDone(kidId, taskId, wasDone);
        tasksCache[kidId] = await listTasks(kidId);
        await renderParentView();
        if (kidId === currentKidId) {
          await renderKidView(kidId);
        }
      });
    });

  // מאזינים לכפתורי תגובה / מחיקה של משימות
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

  // מחיקת הודעות הורה
  parentKidsArea
    .querySelectorAll(".chat-delete")
    .forEach(btn => {
      btn.addEventListener("click", async e => {
        const kidId = btn.getAttribute("data-kid");
        const msgId = btn.getAttribute("data-message");
        if (!kidId || !msgId) return;
        btn.disabled = true;
        try {
          await deleteMessage(kidId, msgId);
          await ensureMessagesLoaded(kidId, { force: true });
          await renderParentView();
          if (kidId === currentKidId) {
            await renderKidView(kidId);
          }
        } catch (err) {
          console.error("deleteMessage error", err);
          alert("לא הצלחנו למחוק את ההודעה 😔");
        }
      });
    });

  // מאזינים לשליחת הודעה חדשה מההורה לילד
  parentKidsArea
    .querySelectorAll(".msg-reply-send-btn")
    .forEach(btn => {
      btn.addEventListener("click", async e => {
        const kidId = btn.getAttribute("data-kid");
        const ta = parentKidsArea.querySelector(
          `.msg-reply-input[data-kid="${kidId}"]`
        );
        if (!ta) return;
        const txt = ta.value.trim();
        if (!txt) {
          alert("כתוב הודעה קודם 🙂");
          return;
        }

        btn.disabled = true;
        try {
          await addParentReply(kidId, txt);
          ta.value = "";

          await ensureMessagesLoaded(kidId, { force: true });

          await renderParentView();

          if (kidId === currentKidId) {
            await renderKidView(kidId);
          }
        } catch (err) {
          console.error("addParentReply error", err);
          alert("אירעה שגיאה בשליחת ההודעה 😔");
        } finally {
          btn.disabled = false;
        }
      });
    });

  // עדכון אחוזי התקדמות
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
  await ensureMessagesLoaded(kidId, { force: true });
  const kidTasks = sortTasksForDisplay(tasksCache[kidId] || []);
  const msgs     = messagesCache[kidId] || [];

  kidHeaderName.textContent = `היי ${kid.name} ${kid.icon || ""}`;
  kidHeadlineEl.textContent = kid.childHeadline || "";
  kidSublineEl.textContent  = kid.childSubline || "";

  kidTasksArea.innerHTML = "";

  kidTasks.forEach(task => {
    const wrap = document.createElement("div");
    wrap.className = "child-task-row";
    if (task.done) {
      wrap.classList.add("task-done", "collapsed");
    } else {
      wrap.classList.add("expanded");
    }

    const doneClass = task.done
      ? "child-task-done-btn done"
      : "child-task-done-btn";

    const icon = task.icon ? escapeHtml(task.icon) : "⭐️";

    const head = document.createElement("div");
    head.className = "child-task-head";
    head.innerHTML = `
      <div class="child-task-title">
        <span class="task-icon">${icon}</span>
        <span class="task-title-text">${escapeHtml(task.title || "")}</span>
      </div>
      <button
        class="${doneClass}"
        data-kid="${kidId}"
        data-task="${task.id}"
        aria-label="${task.done ? "בטל סימון משימה" : "סיימתי את המשימה"}"
      >
        ${task.done ? "✔️" : "סיימתי"}
      </button>
    `;
    wrap.appendChild(head);

    const details = document.createElement("div");
    details.className = "child-task-details";

    let detailsHtml = "";
    if (task.meta) {
      detailsHtml += `<div class="child-task-meta">${escapeHtml(task.meta || "")}</div>`;
    }
    if (task.childNote) {
      detailsHtml += `<div class="task-note child-note"><span>מה כתבתי:</span>${escapeHtml(task.childNote || "")}</div>`;
    }
    if (task.parentNote) {
      detailsHtml += `<div class="task-note parent-note"><span>תגובה מההורה:</span>${escapeHtml(task.parentNote || "")}</div>`;
    }

    if (detailsHtml) {
      details.innerHTML = detailsHtml;
      wrap.appendChild(details);
    }

    kidTasksArea.appendChild(wrap);
  });

  if (kidMessagesArea) {
    kidMessagesArea.innerHTML = `
      <div class="kid-messages-block">
        <div class="kid-messages-title">שיחות עם ההורה 💬</div>
        <div class="kid-messages-list chat-thread">
          ${buildChatHtml(msgs, { emptyText: "עוד אין הודעות משותפות" })}
        </div>
      </div>
    `;
  }

  kidTasksArea
    .querySelectorAll("button.child-task-done-btn")
    .forEach(btn => {
      btn.addEventListener("click", async e => {
        e.stopPropagation();
        const kId  = btn.getAttribute("data-kid");
        const tId  = btn.getAttribute("data-task");

        const listRef = tasksCache[kId] || [];
        const item    = listRef.find(x => x.id === tId);
        const wasDone = item ? item.done : false;

        await toggleTaskDone(kId, tId, wasDone);

        tasksCache[kId] = await listTasks(kId);
        await renderKidView(kId);

        if (unlockedParent) {
          await renderParentView();
        }
      });
    });

  kidTasksArea
    .querySelectorAll(".child-task-row.task-done .child-task-head")
    .forEach(head => {
      head.addEventListener("click", e => {
        if (e.target.closest("button")) return;
        const row = head.closest(".child-task-row");
        if (!row) return;
        if (row.classList.contains("collapsed")) {
          row.classList.remove("collapsed");
          row.classList.add("expanded");
        } else {
          row.classList.remove("expanded");
          row.classList.add("collapsed");
        }
      });
    });
}

// --------------------------------------------------
// שליחת הודעה מהילד להורה
// --------------------------------------------------
window.sendKidMessage = async function sendKidMessage() {
  if (!currentKidId) {
    alert("אין ילד נוכחי 🤔");
    return;
  }
  const ta = document.getElementById("kidNote");
  if (!ta) return;
  const txt = ta.value.trim();
  if (!txt) {
    alert("כתוב משהו קודם ❤️");
    return;
  }

  const sendBtn = document.querySelector(".send-feedback-area .send-btn");
  if (sendBtn) sendBtn.disabled = true;

  try {
    await addMessage(currentKidId, txt, "child");

    ta.value = "";

    await ensureMessagesLoaded(currentKidId, { force: true });

    await renderKidView(currentKidId);

    if (unlockedParent) {
      await renderParentView();
    }
  } catch (err) {
    console.error("child send message error", err);
    alert("לא הצלחנו לשלוח את ההודעה כרגע 😔");
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
};

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
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
};

// --------------------------------------------------
// מודאל תגובה למשימה
// --------------------------------------------------
function openReplyModal(){
  replyTaskName.textContent = replyCtx.title;
  replyTextEl.value = "";
  replyModalBg.style.display = "flex";
}
window.openReplyModal = openReplyModal;

window.saveReply = async function saveReply(){
  const text = replyTextEl.value.trim();
  await setParentNote(replyCtx.kidId, replyCtx.taskId, text);
  replyModalBg.style.display = "none";

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
window.openManageKidsModal = async function openManageKidsModal(){
  await ensureKidsLoaded();
  manageKidsBg.style.display = "flex";
  drawKidsList();
};

function drawKidsList(){
  kidsList.innerHTML = "";

  kidsCache.forEach(k => {
    const link = `${location.origin}${location.pathname}?kid=${encodeURIComponent(k.slug || k.id)}`;

    const row = document.createElement("div");
    row.className = "kid-list-row";
    row.innerHTML = `
      <div class="kid-row-left">
        <span style="color:${k.color || 'inherit'}">${escapeHtml(k.icon || "💛")}</span>
        <span>${escapeHtml(k.name || "")}</span>
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

  kidsList.querySelectorAll(".kid-link-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      const link = btn.getAttribute("data-link");
      navigator.clipboard.writeText(link);
      alert(`הקישור הועתק 📋:\n${link}\nשלח בוואטסאפ לילד`);
    });
  });

  kidsList.querySelectorAll(".kid-remove-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      const kidId = btn.getAttribute("data-kid");
      await deleteKid(kidId);

      kidsCache = kidsCache.filter(x => x.id !== kidId);
      delete tasksCache[kidId];
      delete messagesCache[kidId];

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
        kidTasksArea.innerHTML   = "";
        if (kidMessagesArea) kidMessagesArea.innerHTML = "";
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

  await addKid({ name, icon, color });

  kidsCache = await listKids();

  newKidNameInp.value  = "";
  newKidIconInp.value  = "";
  newKidColorInp.value = "";

  drawKidsList();
  renderKidTabs();

  if (!currentKidId && kidsCache.length > 0) {
    currentKidId = kidsCache[kidsCache.length - 1].id;
    await renderKidView(currentKidId);
  }
};

// --------------------------------------------------
// INIT – מה קורה כשהעמוד נטען
// --------------------------------------------------
(async function init(){
  await ensureKidsLoaded();

  const params  = new URLSearchParams(window.location.search);
  const kidSlug = params.get("kid");

  if (kidSlug) {
    const viewToggle = document.querySelector(".view-toggle");
    if (viewToggle) viewToggle.style.display = "none";

    parentCard.style.display      = "none";
    parentLocked.style.display    = "none";
    parentContent.style.display   = "none";

    const kid = kidsCache.find(k =>
      k.slug === kidSlug || k.id === kidSlug
    );

    if (kid) {
      currentKidId = kid.id;
      showView("kid");

      renderKidTabs();
      await renderKidView(currentKidId);
      await ensureMessagesLoaded(currentKidId, { force: true });

      return;
    } else {
      alert("לא נמצא ילד בשם הזה 🤔");
    }
  }

  showView("parent");
  parentLocked.style.display  = "block";
  parentContent.style.display = "none";

  if (kidsCache.length > 0) {
    currentKidId = kidsCache[0].id;
    renderKidTabs();
    await renderKidView(currentKidId);
    await ensureMessagesLoaded(currentKidId, { force: true });
  }
})();
