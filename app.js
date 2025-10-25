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
  deleteMessage,
  subscribeMessages,
  subscribeTasks
} from "./db.js";

// אזורי מונטאז'
const viewToggleRoot = document.getElementById("viewToggleRoot");
const parentMount    = document.getElementById("parentMount");
const kidMount       = document.getElementById("kidMount");
const syncStatusContainer = document.getElementById("syncStatusContainer");

// אלמנטים שנאתחל דינמית
let parentCard      = null;
let kidCard         = null;

let parentTabBtn    = null;
let kidTabBtn       = null;

let parentLocked    = null;
let parentContent   = null;
let parentPassInput = null;
let lockWarn        = null;

let parentKidsArea  = null;
let overallProgress = null;
let overallText     = null;

let kidTabsArea     = null;
let kidHeaderName   = null;
let kidHeadlineEl   = null;
let kidSublineEl    = null;
let kidTasksArea    = null;
let kidMessagesArea = null;

let taskModalBg     = null;
let taskChildSel    = null;
let taskTitleInp    = null;
let taskMetaInp     = null;
let taskScopeSingleRadio = null;
let taskScopeAllRadio    = null;
let taskScopeSingleText  = null;
let taskScopeSingleIcon  = null;
let taskScheduleNowRadio        = null;
let taskScheduleTomorrowRadio   = null;
let taskScheduleDayAfterRadio   = null;

let replyModalBg    = null;
let replyTaskName   = null;
let replyTextEl     = null;

let manageKidsBg    = null;
let kidsList        = null;
let newKidNameInp   = null;
let newKidIconInp   = null;
let newKidColorInp  = null;

let kidMissingCard  = null;

const PARENT_PASSWORD = "9999";

const MS_IN_DAY = 24 * 60 * 60 * 1000;

let requestedKidSlug   = "";
let kidPrivateMode     = false;
let viewToggleMounted  = false;
let parentUiMounted    = false;
let parentModalsMounted = false;
let kidUiMounted       = false;
let kidNotFoundMode    = false;

function mountViewToggle() {
  if (viewToggleMounted || !viewToggleRoot) return;
  const tpl = document.getElementById("viewToggleTemplate");
  if (!tpl) return;

  const clone = tpl.content.cloneNode(true);
  viewToggleRoot.appendChild(clone);

  parentTabBtn = document.getElementById("parentTab");
  kidTabBtn    = document.getElementById("kidTab");

  viewToggleMounted = true;
}

function mountParentModals() {
  if (parentModalsMounted) return;
  const tpl = document.getElementById("parentModalsTemplate");
  if (!tpl) return;

  const clone = tpl.content.cloneNode(true);
  document.body.appendChild(clone);

  taskModalBg   = document.getElementById("taskModalBg");
  taskChildSel  = document.getElementById("taskChild");
  taskTitleInp  = document.getElementById("taskTitle");
  taskMetaInp   = document.getElementById("taskMeta");
  taskScopeSingleRadio = document.getElementById("taskScopeSingle");
  taskScopeAllRadio    = document.getElementById("taskScopeAll");
  taskScopeSingleText  = document.getElementById("taskScopeSingleText");
  taskScopeSingleIcon  = document.getElementById("taskScopeSingleIcon");
  taskScheduleNowRadio      = document.getElementById("taskScheduleNow");
  taskScheduleTomorrowRadio = document.getElementById("taskScheduleTomorrow");
  taskScheduleDayAfterRadio = document.getElementById("taskScheduleDayAfter");

  if (taskChildSel) {
    taskChildSel.addEventListener("change", updateTaskScopeSingleLabel);
  }

  replyModalBg  = document.getElementById("replyModalBg");
  replyTaskName = document.getElementById("replyTaskName");
  replyTextEl   = document.getElementById("replyText");

  manageKidsBg   = document.getElementById("manageKidsBg");
  kidsList       = document.getElementById("kidsList");
  newKidNameInp  = document.getElementById("newKidName");
  newKidIconInp  = document.getElementById("newKidIcon");
  newKidColorInp = document.getElementById("newKidColor");

  parentModalsMounted = true;
}

function mountParentUi() {
  if (parentUiMounted || !parentMount) return;
  const tpl = document.getElementById("parentViewTemplate");
  if (!tpl) return;

  const clone = tpl.content.cloneNode(true);
  parentMount.appendChild(clone);

  parentCard      = document.getElementById("parentCard");
  parentLocked    = document.getElementById("parentLocked");
  parentContent   = document.getElementById("parentContent");
  parentPassInput = document.getElementById("parentPassInput");
  lockWarn        = document.getElementById("lockWarn");

  parentKidsArea  = document.getElementById("parentKidsArea");
  overallProgress = document.getElementById("overallProgress");
  overallText     = document.getElementById("overallText");

  parentUiMounted = true;
  mountParentModals();
}

function mountKidUi() {
  if (kidUiMounted || !kidMount) return;
  const tpl = document.getElementById("kidViewTemplate");
  if (!tpl) return;

  const clone = tpl.content.cloneNode(true);
  kidMount.innerHTML = "";
  kidMount.appendChild(clone);

  kidCard         = document.getElementById("kidCard");
  kidTabsArea     = document.getElementById("kidTabsArea");
  kidHeaderName   = document.getElementById("kidHeaderName");
  kidHeadlineEl   = document.getElementById("kidHeadline");
  kidSublineEl    = document.getElementById("kidSubline");
  kidTasksArea    = document.getElementById("kidTasksArea");
  kidMessagesArea = document.getElementById("kidMessagesArea");

  kidUiMounted    = true;
  kidNotFoundMode = false;
  kidMissingCard  = null;
}

function mountKidMissingCard() {
  if (!kidMount) return;
  const tpl = document.getElementById("kidMissingTemplate");
  if (!tpl) return;

  kidMount.innerHTML = "";
  const clone = tpl.content.cloneNode(true);
  kidMount.appendChild(clone);

  kidCard        = document.getElementById("kidMissingCard");
  kidMissingCard = kidCard;

  kidUiMounted    = false;
  kidNotFoundMode = true;

  kidTabsArea     = null;
  kidHeaderName   = null;
  kidHeadlineEl   = null;
  kidSublineEl    = null;
  kidTasksArea    = null;
  kidMessagesArea = null;
}

// סטייט בריצה
let unlockedParent = false;
let kidsCache      = [];      // [{id, name, slug, ...}, ...]
let tasksCache     = {};      // { kidId : [ {id,title,...}, ... ] }
let messagesCache  = {};      // { kidId : [ {id,from,text,ts}, ... ] }
let currentKidId   = null;
let activeView     = "parent";

let replyCtx       = { kidId:null, taskId:null, title:"" };

const messageListeners = new Map();
const taskListeners    = new Map();
const kidMessageQueue  = new Set();
const parentMessageQueue = new Set();
const kidTaskPulseMap    = new Map();   // kidId -> Set(taskId)
const parentTaskPulseMap = new Map();   // kidId -> Set(taskId)
const initializedMessageRealtime = new Set();
const initializedTaskRealtime    = new Set();

let syncStatusTimeout = null;
let realtimeFailed    = false;
let realtimeSuccessShown = false;

let floatingNoticeWrapper = null;
let floatingNoticeBubble  = null;
let floatingNoticeTimer   = null;

// --------------------------------------------------
// עזרי UI
// --------------------------------------------------
function showView(which){
  if(which === "parent"){
    if (parentCard) parentCard.classList.add("active");
    if (kidCard) kidCard.classList.remove("active");
    if (parentTabBtn) parentTabBtn.classList.add("active");
    if (kidTabBtn) kidTabBtn.classList.remove("active");
    activeView = "parent";
  } else {
    if (kidCard) kidCard.classList.add("active");
    if (parentCard) parentCard.classList.remove("active");
    if (kidTabBtn) kidTabBtn.classList.add("active");
    if (parentTabBtn) parentTabBtn.classList.remove("active");
    activeView = "kid";
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

function ensureFloatingNoticeElements() {
  if (!floatingNoticeWrapper) {
    floatingNoticeWrapper = document.getElementById("floatingNoticeRoot");
    if (!floatingNoticeWrapper) {
      floatingNoticeWrapper = document.createElement("div");
      floatingNoticeWrapper.id = "floatingNoticeRoot";
      document.body.appendChild(floatingNoticeWrapper);
    }
    floatingNoticeWrapper.classList.add("floating-notice-wrapper");
  }

  if (!floatingNoticeBubble) {
    floatingNoticeBubble = document.createElement("div");
    floatingNoticeBubble.className = "floating-notice-bubble";
    floatingNoticeWrapper.appendChild(floatingNoticeBubble);
  }
}

function showFloatingNotice(type = "message", text = "") {
  ensureFloatingNoticeElements();
  if (!floatingNoticeWrapper || !floatingNoticeBubble) return;

  const icon = type === "task" ? "🎯" : "💌";
  const fallback = type === "task"
    ? "נוספה משימה חדשה!"
    : "יש הודעה חדשה!";
  const safeText = escapeHtml(text || fallback);

  floatingNoticeBubble.innerHTML = `<span class="floating-notice-icon" aria-hidden="true">${icon}</span><span class="floating-notice-text">${safeText}</span>`;

  floatingNoticeBubble.classList.remove("notice-message", "notice-task");
  floatingNoticeBubble.classList.add(type === "task" ? "notice-task" : "notice-message");

  floatingNoticeWrapper.classList.add("is-visible");

  floatingNoticeBubble.style.animation = "none";
  void floatingNoticeBubble.offsetWidth;
  floatingNoticeBubble.style.animation = "";

  if (floatingNoticeTimer) {
    clearTimeout(floatingNoticeTimer);
  }

  floatingNoticeTimer = setTimeout(() => {
    if (floatingNoticeWrapper) {
      floatingNoticeWrapper.classList.remove("is-visible");
    }
  }, 3000);
}

function sortTasksForDisplay(tasks = []) {
  return [...tasks].sort((a, b) => {
    if (!!a.done === !!b.done) return 0;
    return a.done ? 1 : -1;
  });
}

function getStartOfLocalDayMs(offsetDays = 0) {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + (offsetDays || 0),
    0,
    0,
    0,
    0
  );
  return start.getTime();
}

function computeAvailableFromDay(selection) {
  switch (selection) {
    case "tomorrow":
      return getStartOfLocalDayMs(1);
    case "dayAfterTomorrow":
      return getStartOfLocalDayMs(2);
    default:
      return null;
  }
}

function shouldTaskBeVisibleForKid(task, nowStartOfDayMs) {
  if (!task) return false;
  const value = task.availableFromDay;
  if (value === null || value === undefined || value === "") {
    return true;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return true;
  }
  return numeric <= nowStartOfDayMs;
}

function getTaskAvailabilityLabel(availableFromDay, nowStartOfDayMs) {
  if (availableFromDay === null || availableFromDay === undefined || availableFromDay === "") {
    return "";
  }
  const numeric = Number(availableFromDay);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  if (numeric <= nowStartOfDayMs) {
    return "";
  }
  const diffDays = Math.round((numeric - nowStartOfDayMs) / MS_IN_DAY);
  if (diffDays <= 0) {
    return "";
  }
  if (diffDays === 1) {
    return "זמין מחר";
  }
  if (diffDays === 2) {
    return "זמין מחרתיים";
  }
  const date = new Date(numeric);
  const formatted = date.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
  return `זמין ב-${formatted}`;
}

function getSelectedScopeValue() {
  if (taskScopeAllRadio && taskScopeAllRadio.checked) {
    return "all";
  }
  return "single";
}

function getSelectedScheduleValue() {
  if (taskScheduleTomorrowRadio && taskScheduleTomorrowRadio.checked) {
    return "tomorrow";
  }
  if (taskScheduleDayAfterRadio && taskScheduleDayAfterRadio.checked) {
    return "dayAfterTomorrow";
  }
  return "now";
}

function updateTaskScopeSingleLabel() {
  if (!taskScopeSingleText) return;
  const kidId = taskChildSel ? taskChildSel.value : "";
  const kid = kidsCache.find(k => k.id === kidId);
  if (kid) {
    taskScopeSingleText.textContent = `רק ל${kid.name}`;
    if (taskScopeSingleIcon) {
      taskScopeSingleIcon.textContent = kid.icon || "🙂";
    }
  } else {
    taskScopeSingleText.textContent = "רק לילד הזה";
    if (taskScopeSingleIcon) {
      taskScopeSingleIcon.textContent = "🙂";
    }
  }
}

function buildChatHtml(messages = [], { allowDelete = false, kidId = "", emptyText = "" } = {}) {
  if (!messages || messages.length === 0) {
    const text = emptyText || "אין הודעות";
    return `<div class="msg-empty">${escapeHtml(text)}</div>`;
  }

  const sortedMessages = [...messages].sort((a, b) => {
    const ats = typeof a.ts === "number" ? a.ts : 0;
    const bts = typeof b.ts === "number" ? b.ts : 0;
    return bts - ats;
  });

  return sortedMessages.map(m => {
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

function showSyncStatus(message = "") {
  if (!syncStatusContainer || !message) return;

  syncStatusContainer.innerHTML = "";
  const bubble = document.createElement("div");
  bubble.className = "sync-status-bubble";
  bubble.textContent = message;
  syncStatusContainer.appendChild(bubble);

  if (syncStatusTimeout) {
    clearTimeout(syncStatusTimeout);
  }

  syncStatusTimeout = setTimeout(() => {
    bubble.classList.add("fade-out");
    setTimeout(() => {
      if (bubble.parentNode) {
        bubble.parentNode.removeChild(bubble);
      }
    }, 400);
  }, 2800);
}

function addIdsToPulseMap(map, kidId, ids = []) {
  if (!ids || ids.length === 0) return;
  if (!map.has(kidId)) {
    map.set(kidId, new Set());
  }
  const set = map.get(kidId);
  ids.forEach(id => set.add(id));
}

function removeKidRealtime(kidId) {
  const msgUnsub = messageListeners.get(kidId);
  if (typeof msgUnsub === "function") {
    try { msgUnsub(); } catch (err) { console.warn("failed to unsubscribe messages", err); }
  }
  messageListeners.delete(kidId);

  const taskUnsub = taskListeners.get(kidId);
  if (typeof taskUnsub === "function") {
    try { taskUnsub(); } catch (err) { console.warn("failed to unsubscribe tasks", err); }
  }
  taskListeners.delete(kidId);

  kidMessageQueue.delete(kidId);
  parentMessageQueue.delete(kidId);
  kidTaskPulseMap.delete(kidId);
  parentTaskPulseMap.delete(kidId);
  initializedMessageRealtime.delete(kidId);
  initializedTaskRealtime.delete(kidId);
}

function handleRealtimeFailure(err) {
  console.error("Realtime subscription error", err);
  if (!realtimeFailed) {
    realtimeFailed = true;
    showSyncStatus("שליח הכוכבים בודק עדכונים 🌟");
  }
}

function triggerRealtimeRender(kidId) {
  if (activeView === "kid" && kidId === currentKidId) {
    renderKidView(kidId, { useCacheOnly: true });
  }
  if (activeView === "parent" && unlockedParent) {
    renderParentView({ useCacheOnly: true });
  }
}

function ensureRealtimeForKid(kidId) {
  if (!kidId) return;

  if (!messageListeners.has(kidId)) {
    try {
      const unsubscribe = subscribeMessages(kidId, (messages, error) => {
        if (error) {
          handleRealtimeFailure(error);
          return;
        }
        const wasInitialized = initializedMessageRealtime.has(kidId);
        const prevMessages = messagesCache[kidId] || [];
        const prevIds = new Set(prevMessages.map(m => m.id));

        messagesCache[kidId] = messages;

        if (wasInitialized) {
          const newMessages = messages.filter(m => !prevIds.has(m.id));
          if (newMessages.some(m => m.from === "parent")) {
            kidMessageQueue.add(kidId);
          }
          if (newMessages.some(m => m.from === "child")) {
            parentMessageQueue.add(kidId);
          }
        }

        if (!realtimeSuccessShown && !realtimeFailed) {
          realtimeSuccessShown = true;
          showSyncStatus("הכול מעודכן ✨");
        }

        initializedMessageRealtime.add(kidId);

        triggerRealtimeRender(kidId);
      });
      messageListeners.set(kidId, unsubscribe);
    } catch (err) {
      handleRealtimeFailure(err);
    }
  }

  if (!taskListeners.has(kidId)) {
    try {
      const unsubscribe = subscribeTasks(kidId, (tasks, error) => {
        if (error) {
          handleRealtimeFailure(error);
          return;
        }
        const wasInitialized = initializedTaskRealtime.has(kidId);
        const prevTasks = tasksCache[kidId] || [];
        const prevIds = new Set(prevTasks.map(t => t.id));

        tasksCache[kidId] = tasks;

        if (wasInitialized) {
          const newTaskIds = tasks.filter(t => !prevIds.has(t.id)).map(t => t.id);
          if (newTaskIds.length > 0) {
            addIdsToPulseMap(kidTaskPulseMap, kidId, newTaskIds);
            addIdsToPulseMap(parentTaskPulseMap, kidId, newTaskIds);
            if (activeView === "parent" && unlockedParent) {
              showSyncStatus("🎯 נוספה משימה חדשה לילד");
            }
          }
        }

        initializedTaskRealtime.add(kidId);

        triggerRealtimeRender(kidId);
      });
      taskListeners.set(kidId, unsubscribe);
    } catch (err) {
      handleRealtimeFailure(err);
    }
  }
}

function refreshRealtimeListeners() {
  const kidIds = new Set(kidsCache.map(k => k.id));

  Array.from(messageListeners.keys()).forEach(kidId => {
    if (!kidIds.has(kidId)) {
      removeKidRealtime(kidId);
    }
  });

  Array.from(taskListeners.keys()).forEach(kidId => {
    if (!kidIds.has(kidId)) {
      removeKidRealtime(kidId);
    }
  });

  kidsCache.forEach(kid => ensureRealtimeForKid(kid.id));
}

function showKidNewMessageBubble(kidId) {
  if (!kidMessagesArea) return;
  if (kidId !== currentKidId) return;
  if (activeView !== "kid") return;

  showFloatingNotice("message", "יש הודעה חדשה מההורה!");
}

function maybeShowKidMessageBubble(kidId) {
  if (!kidId) return;
  if (kidMessageQueue.has(kidId)) {
    kidMessageQueue.delete(kidId);
    showKidNewMessageBubble(kidId);
  }
}

function shouldShowParentMessageHint(kidId, { consume = true } = {}) {
  if (!kidId) return false;
  const hasHint = parentMessageQueue.has(kidId);
  if (hasHint && consume) {
    parentMessageQueue.delete(kidId);
  }
  return hasHint;
}

// --------------------------------------------------
// כניסה להורה
// --------------------------------------------------
window.openParentView = async function openParentView() {
  if (kidPrivateMode) return;
  mountParentUi();
  if (!parentCard) return;

  showView("parent");

  if (!unlockedParent) {
    if (parentLocked) parentLocked.style.display  = "block";
    if (parentContent) parentContent.style.display = "none";
  } else {
    if (parentLocked) parentLocked.style.display  = "none";
    if (parentContent) parentContent.style.display = "block";
    try {
      await renderParentView();
    } catch (err) {
      console.error("renderParentView error:", err);
    }
  }
};

window.tryUnlockParent = async function tryUnlockParent() {
  if (kidPrivateMode || !parentPassInput) return;

  if (parentPassInput.value.trim() === PARENT_PASSWORD) {
    unlockedParent = true;
    if (lockWarn) lockWarn.textContent = "";
    if (parentLocked) parentLocked.style.display  = "none";
    if (parentContent) parentContent.style.display = "block";
    try {
      await renderParentView();
    } catch (err) {
      console.error("renderParentView error:", err);
    }
  } else {
    if (lockWarn) lockWarn.textContent = "סיסמה לא נכונה";
  }
};

// --------------------------------------------------
// מעבר בין כרטיס הורה/ילד
// --------------------------------------------------
window.showCard = async function showCard(which){
  showView(which);

  if (which === "kid") {
    if (kidNotFoundMode) {
      return;
    }

    if (!kidUiMounted) {
      mountKidUi();
    }

    await ensureKidsLoaded();

    if (!currentKidId && kidsCache.length > 0) {
      currentKidId = kidsCache[0].id;
    }

    renderKidTabs();

    if (currentKidId) {
      await renderKidView(currentKidId);
    } else {
      if (kidTasksArea) kidTasksArea.innerHTML = "אין ילדים עדיין 🤔";
      if (kidMessagesArea) kidMessagesArea.innerHTML = "";
    }
  }

  if (which === "parent") {
    if (kidPrivateMode) {
      return;
    }

    mountParentUi();
    if (!parentLocked || !parentContent) return;

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
async function ensureKidsLoaded({ force = false } = {}) {
  if (kidPrivateMode) {
    if (kidsCache.length === 0 || force) {
      const allKids = await listKids();
      const targetSlug = (requestedKidSlug || "").toLowerCase();
      const targetKid = allKids.find(k => {
        const kidSlug = (k.slug || "").toLowerCase();
        return kidSlug === targetSlug || k.id === requestedKidSlug;
      });

      if (targetKid) {
        kidsCache = [targetKid];
      } else {
        kidsCache = [];
        currentKidId = null;
      }
    }
  } else if (kidsCache.length === 0 || force) {
    kidsCache = await listKids();
  }

  const validIds = new Set(kidsCache.map(k => k.id));
  Object.keys(tasksCache).forEach(kidId => {
    if (!validIds.has(kidId)) {
      delete tasksCache[kidId];
    }
  });
  Object.keys(messagesCache).forEach(kidId => {
    if (!validIds.has(kidId)) {
      delete messagesCache[kidId];
    }
  });

  refreshRealtimeListeners();
}

async function ensureTasksLoaded(kidId) {
  if (!tasksCache[kidId]) {
    tasksCache[kidId] = await listTasks(kidId);
  }
  ensureRealtimeForKid(kidId);
}

async function ensureMessagesLoaded(kidId, { force = false } = {}) {
  if (!kidId) return;
  if (!messagesCache[kidId] || force) {
    const msgs = await listMessages(kidId);
    messagesCache[kidId] = Array.isArray(msgs)
      ? [...msgs]
      : [];
  }
  ensureRealtimeForKid(kidId);
}

// --------------------------------------------------
// רינדור איזור ההורה
// --------------------------------------------------
async function renderParentView({ useCacheOnly = false } = {}) {
  if (kidPrivateMode) return;
  if (!parentKidsArea) return;

  if (!useCacheOnly) {
    await ensureKidsLoaded();
  } else if (kidsCache.length === 0) {
    await ensureKidsLoaded();
  }

  parentKidsArea.innerHTML = "";

  let totalTasks = 0;
  let doneTasks  = 0;
  const nowStartOfDayMs = getStartOfLocalDayMs(0);

  for (const kid of kidsCache) {
    if (!useCacheOnly || !tasksCache[kid.id]) {
      await ensureTasksLoaded(kid.id);
    }
    if (!useCacheOnly || !messagesCache[kid.id]) {
      await ensureMessagesLoaded(kid.id);
    }

    const kidTasks = sortTasksForDisplay(tasksCache[kid.id] || []);
    const msgs     = messagesCache[kid.id] || [];
    const consumeHint = activeView === "parent" && unlockedParent;
    const showMsgHint = shouldShowParentMessageHint(kid.id, { consume: consumeHint });

    if (showMsgHint && consumeHint) {
      const kidName = kid.name ? `מ${kid.name}` : "מהילד/ה";
      showFloatingNotice("message", `יש הודעה חדשה ${kidName}!`);
    }

    const parentPulseSet = parentTaskPulseMap.get(kid.id);
    if (
      parentPulseSet &&
      parentPulseSet.size > 0 &&
      activeView === "parent" &&
      unlockedParent
    ) {
      const kidNameForTask = kid.name ? kid.name : "הילד/ה";
      showFloatingNotice("task", `נוספה משימה חדשה ל${kidNameForTask}`);
    }

    kidTasks.forEach(t => {
      if (shouldTaskBeVisibleForKid(t, nowStartOfDayMs)) {
        totalTasks++;
        if (t.done) doneTasks++;
      }
    });

    // בלוק ילד
    const kidBlock = document.createElement("div");
    kidBlock.className = "kid-block";

    const header = document.createElement("div");
    header.className = "kid-header";
    header.innerHTML = `
      <span class="kid-color-heart" style="color:${kid.color || 'inherit'}">${escapeHtml(kid.icon || "💛")}</span>
      <span>${escapeHtml(kid.name || "")}</span>
      ${showMsgHint ? '<span class="new-msg-hint-parent" aria-hidden="true">💬</span>' : ''}
    `;
    kidBlock.appendChild(header);

    // משימות
    kidTasks.forEach(task => {
      const row = document.createElement("div");
      const isVisibleToday = shouldTaskBeVisibleForKid(task, nowStartOfDayMs);
      row.className = "task-row" + (task.done ? " task-done" : "");
      if (!isVisibleToday) {
        row.classList.add("future-task");
      }
      row.dataset.kidId = kid.id;
      row.dataset.taskId = task.id;

      const icon = task.icon ? escapeHtml(task.icon) : "⭐️";
      const availabilityLabel = getTaskAvailabilityLabel(task.availableFromDay, nowStartOfDayMs);
      const extraPieces = [];
      if (task.meta) {
        extraPieces.push(`<div class="task-meta">${escapeHtml(task.meta || "")}</div>`);
      }
      if (availabilityLabel) {
        extraPieces.push(`<div class="task-schedule-chip">${escapeHtml(availabilityLabel)}</div>`);
      }
      const metaHtml = extraPieces.join("");

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

      const pulseSet = parentTaskPulseMap.get(kid.id);
      if (pulseSet && pulseSet.has(task.id)) {
        row.classList.add("task-pulse");
        setTimeout(() => {
          row.classList.remove("task-pulse");
        }, 1600);
        pulseSet.delete(task.id);
        if (pulseSet.size === 0) {
          parentTaskPulseMap.delete(kid.id);
        }
      }

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

  if (overallProgress) overallProgress.textContent = percent + "%";
  if (overallText) overallText.innerHTML = `<b>התקדמות כללית</b><br/>${doneTasks}/${totalTasks} משימות הושלמו`;
}

// --------------------------------------------------
// מסך ילד
// --------------------------------------------------
function renderKidTabs() {
  if (!kidTabsArea || kidNotFoundMode) return;

  if (kidPrivateMode) {
    kidTabsArea.innerHTML = "";
    kidTabsArea.classList.add("hidden");
    return;
  }

  kidTabsArea.classList.remove("hidden");
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

async function renderKidView(kidId, { useCacheOnly = false } = {}) {
  if (kidNotFoundMode) return;

  if (!kidUiMounted) {
    mountKidUi();
  }
  if (!kidUiMounted) return;

  const kid = kidsCache.find(k => k.id === kidId);
  if (!kid) return;

  if (!useCacheOnly || !tasksCache[kidId]) {
    await ensureTasksLoaded(kidId);
  }
  if (!useCacheOnly || !messagesCache[kidId]) {
    await ensureMessagesLoaded(kidId);
  }
  const kidTasks = sortTasksForDisplay(tasksCache[kidId] || []);
  const msgs     = messagesCache[kidId] || [];

  const nowStartOfDayMs = getStartOfLocalDayMs(0);
  const visibleTasks = kidTasks.filter(task => shouldTaskBeVisibleForKid(task, nowStartOfDayMs));
  const visibleTaskIds = new Set(visibleTasks.map(t => t.id));

  const pulseSetForKid = kidTaskPulseMap.get(kidId);
  const hasVisiblePulse =
    pulseSetForKid &&
    pulseSetForKid.size > 0 &&
    Array.from(pulseSetForKid).some(id => visibleTaskIds.has(id));

  if (
    hasVisiblePulse &&
    kidId === currentKidId &&
    activeView === "kid"
  ) {
    showFloatingNotice("task", "יש לך משימה חדשה!");
  }

  if (kidHeaderName) kidHeaderName.textContent = `היי ${kid.name} ${kid.icon || ""}`;
  if (kidHeadlineEl) kidHeadlineEl.textContent = kid.childHeadline || "";
  if (kidSublineEl) kidSublineEl.textContent  = kid.childSubline || "";

  if (kidTabsArea && !kidPrivateMode) {
    kidTabsArea.classList.remove("hidden");
  }

  if (kidTasksArea) {
    kidTasksArea.innerHTML = "";
    if (visibleTasks.length === 0) {
      kidTasksArea.innerHTML = "<div class=\"child-no-tasks-note\">הכול שקט לעכשיו 😌</div>";
    }
  }

  visibleTasks.forEach(task => {
    const wrap = document.createElement("div");
    wrap.className = "child-task-row";
    if (task.done) {
      wrap.classList.add("task-done", "collapsed");
    } else {
      wrap.classList.add("expanded");
    }
    wrap.dataset.kidId = kidId;
    wrap.dataset.taskId = task.id;

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

    if (kidTasksArea) {
      kidTasksArea.appendChild(wrap);
    }

    const pulseSet = kidTaskPulseMap.get(kidId);
    if (pulseSet && pulseSet.has(task.id)) {
      wrap.classList.add("child-task-pulse");
      setTimeout(() => {
        wrap.classList.remove("child-task-pulse");
      }, 1600);
      pulseSet.delete(task.id);
      if (pulseSet.size === 0) {
        kidTaskPulseMap.delete(kidId);
      }
    }
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
    maybeShowKidMessageBubble(kidId);
  }

  if (!kidTasksArea) return;

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
  if (kidNotFoundMode) return;
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
  if (!taskModalBg || kidPrivateMode) return;
  await ensureKidsLoaded();

  taskChildSel.innerHTML = "";
  let defaultKidId = currentKidId && kidsCache.some(k => k.id === currentKidId)
    ? currentKidId
    : kidsCache[0]?.id || "";

  kidsCache.forEach(k => {
    const opt = document.createElement("option");
    opt.value = k.id;
    opt.textContent = k.name;
    taskChildSel.appendChild(opt);
  });

  if (defaultKidId && taskChildSel.querySelector(`option[value="${defaultKidId}"]`)) {
    taskChildSel.value = defaultKidId;
  } else if (kidsCache[0]) {
    taskChildSel.value = kidsCache[0].id;
  }

  if (taskScopeSingleRadio) taskScopeSingleRadio.checked = true;
  if (taskScopeAllRadio) taskScopeAllRadio.checked = false;
  if (taskScheduleNowRadio) taskScheduleNowRadio.checked = true;
  if (taskScheduleTomorrowRadio) taskScheduleTomorrowRadio.checked = false;
  if (taskScheduleDayAfterRadio) taskScheduleDayAfterRadio.checked = false;

  updateTaskScopeSingleLabel();

  taskTitleInp.value = "";
  taskMetaInp.value  = "";

  taskModalBg.style.display = "flex";
};

window.saveNewTask = async function saveNewTask() {
  if (!taskModalBg || kidPrivateMode) return;
  if (!taskChildSel) return;
  const kidId = taskChildSel.value;
  const title = taskTitleInp.value.trim();
  const meta  = taskMetaInp.value.trim();
  const scope = getSelectedScopeValue();
  const schedule = getSelectedScheduleValue();
  const availableFromDay = computeAvailableFromDay(schedule);

  if (!title) {
    alert("חייבים שם משימה 🙂");
    return;
  }

  const payload = { title, meta, availableFromDay };
  const saveBtn = taskModalBg.querySelector(".save-task-btn");
  if (saveBtn) saveBtn.disabled = true;

  try {
    if (scope === "all") {
      if (!kidsCache || kidsCache.length === 0) {
        alert("אין ילדים פעילים במערכת כרגע 👀");
        return;
      }

      await Promise.all(kidsCache.map(k => addTask(k.id, payload)));

      taskModalBg.style.display = "none";

      await Promise.all(
        kidsCache.map(async kid => {
          tasksCache[kid.id] = await listTasks(kid.id);
        })
      );

      if (unlockedParent) {
        await renderParentView();
      }
      if (currentKidId) {
        await renderKidView(currentKidId);
      }
    } else {
      if (!kidId) {
        alert("בחר ילד קודם 🙂");
        return;
      }

      await addTask(kidId, payload);

      taskModalBg.style.display = "none";

      tasksCache[kidId] = await listTasks(kidId);

      if (unlockedParent) {
        await renderParentView();
      }
      if (kidId === currentKidId) {
        await renderKidView(kidId);
      }
    }
  } catch (err) {
    console.error("saveNewTask error", err);
    alert("לא הצלחנו לשמור את המשימה כרגע 😔");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
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
  if (kidPrivateMode || !replyModalBg || !replyTaskName || !replyTextEl) return;
  replyTaskName.textContent = replyCtx.title;
  replyTextEl.value = "";
  replyModalBg.style.display = "flex";
}
window.openReplyModal = openReplyModal;

window.saveReply = async function saveReply(){
  if (kidPrivateMode || !replyModalBg || !replyTextEl) return;
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
  if (!manageKidsBg || kidPrivateMode) return;
  await ensureKidsLoaded();
  manageKidsBg.style.display = "flex";
  drawKidsList();
};

function drawKidsList(){
  if (!kidsList) return;
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
      removeKidRealtime(kidId);
      refreshRealtimeListeners();

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
  if (kidPrivateMode || !newKidNameInp || !newKidIconInp || !newKidColorInp) return;
  const name  = newKidNameInp.value.trim();
  const icon  = newKidIconInp.value.trim()  || "💛";
  const color = newKidColorInp.value.trim() || "var(--yellow)";

  if (!name) {
    alert("שם ילד חובה");
    return;
  }

  await addKid({ name, icon, color });

  kidsCache = await listKids();
  refreshRealtimeListeners();

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
  const params = new URLSearchParams(window.location.search);
  requestedKidSlug = (params.get("kid") || "").trim();
  kidPrivateMode = requestedKidSlug !== "";

  if (!kidPrivateMode) {
    mountViewToggle();
    mountParentUi();
  }

  await ensureKidsLoaded();

  if (kidPrivateMode) {
    if (kidsCache.length > 0) {
      currentKidId = kidsCache[0].id;
      mountKidUi();
      showView("kid");
      renderKidTabs();
      await ensureTasksLoaded(currentKidId);
      await ensureMessagesLoaded(currentKidId, { force: true });
      await renderKidView(currentKidId, { useCacheOnly: true });
    } else {
      mountKidMissingCard();
      showView("kid");
    }
    return;
  }

  mountKidUi();
  showView("parent");
  if (parentLocked) parentLocked.style.display  = "block";
  if (parentContent) parentContent.style.display = "none";

  if (kidsCache.length > 0) {
    currentKidId = kidsCache[0].id;
    renderKidTabs();
    await ensureTasksLoaded(currentKidId);
    await ensureMessagesLoaded(currentKidId, { force: true });
    await renderKidView(currentKidId, { useCacheOnly: true });
  } else {
    if (kidTasksArea) kidTasksArea.innerHTML = "אין ילדים עדיין 🤔";
    if (kidMessagesArea) kidMessagesArea.innerHTML = "";
  }
})();
