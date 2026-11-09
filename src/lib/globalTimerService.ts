// Persistent App-Wide Study & Exam Timer Context
// Allows the study timer or exam countdown to continue ticking in the background
// even when the user switches tabs, leaves the app, or locks their device.

import { sendNativePushNotification, playNotificationChime } from './pushNotificationManager';

export interface GlobalTimerSession {
  isRunning: boolean;
  isPaused: boolean;
  mode: 'focus' | 'exam' | 'break';
  subjectName: string;
  topicName: string;
  targetSeconds: number;
  secondsLeft: number;
  startedAtTimestamp?: number;
  targetEndTimestamp?: number; // Absolute epoch timestamp when the session ends
  lastTickTimestamp?: number;
  hasNotifiedCompletion?: boolean;
}

export interface ImmediateStudyReminder {
  id: string;
  title: string;
  topic: string;
  targetTimestamp: number;
  minutes: number;
  triggered: boolean;
}

const TIMER_STORAGE_KEY = 'studyplanner_global_running_timer_v1';
const REMINDER_STORAGE_KEY = 'studyplanner_immediate_reminders_v1';

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('studyplanner_timer_bus');
  }
} catch (e) {}

/**
 * Read the current timer state, accurately factoring in elapsed wall-clock time
 */
export function getPersistedTimer(): GlobalTimerSession | null {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return null;
    const data: GlobalTimerSession = JSON.parse(raw);

    // If running and not paused, compute accurate time left from wall-clock targetEndTimestamp
    if (data.isRunning && !data.isPaused) {
      const now = Date.now();
      if (data.targetEndTimestamp) {
        const remaining = Math.max(0, Math.ceil((data.targetEndTimestamp - now) / 1000));
        data.secondsLeft = remaining;
        data.lastTickTimestamp = now;

        if (remaining <= 0) {
          data.isRunning = false;
          if (!data.hasNotifiedCompletion) {
            data.hasNotifiedCompletion = true;
            triggerTimerCompletionPush(data);
            persistRunningTimer(data);
          }
        }
      } else if (data.lastTickTimestamp) {
        const elapsedSec = Math.floor((now - data.lastTickTimestamp) / 1000);
        if (elapsedSec > 0) {
          data.secondsLeft = Math.max(0, data.secondsLeft - elapsedSec);
          data.lastTickTimestamp = now;
          if (data.secondsLeft <= 0) {
            data.isRunning = false;
            if (!data.hasNotifiedCompletion) {
              data.hasNotifiedCompletion = true;
              triggerTimerCompletionPush(data);
              persistRunningTimer(data);
            }
          }
        }
      }
    }
    return data;
  } catch (err) {
    console.warn('Failed to read persisted timer:', err);
    return null;
  }
}

const CLIENT_DEVICE_ID = typeof window !== 'undefined' 
  ? (() => {
      let id = sessionStorage.getItem('studyflow_timer_client_id');
      if (!id) {
        id = `win_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        try { sessionStorage.setItem('studyflow_timer_client_id', id); } catch (e) {}
      }
      return id;
    })()
  : 'server';

// Throttle server push to avoid overwhelming network while retaining real-time accuracy
let lastServerSyncTimestamp = 0;
let pendingServerSyncTimeout: any = null;

async function syncTimerToServer(timer: GlobalTimerSession | null, immediate: boolean = false) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (!immediate && now - lastServerSyncTimestamp < 800) {
    if (!pendingServerSyncTimeout) {
      pendingServerSyncTimeout = setTimeout(() => {
        pendingServerSyncTimeout = null;
        syncTimerToServer(timer, true);
      }, 800);
    }
    return;
  }
  lastServerSyncTimestamp = now;

  try {
    await fetch('/api/timer/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timer,
        sourceDeviceId: CLIENT_DEVICE_ID,
        sourceDeviceName: window.top === window ? 'External Window / Monitor' : 'Builder App Preview'
      })
    });
  } catch (err) {
    // Graceful background sync failure
  }
}

/**
 * Persist timer and broadcast updates across tabs, floating windows, and server
 */
export function persistRunningTimer(timer: GlobalTimerSession | null, syncToServer: boolean = true): void {
  try {
    if (!timer) {
      localStorage.removeItem(TIMER_STORAGE_KEY);
    } else {
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
        ...timer,
        lastTickTimestamp: Date.now()
      }));
    }

    // Broadcast locally across components & BroadcastChannel
    window.dispatchEvent(new CustomEvent('studyplanner:timer-update', { detail: timer }));
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: 'TIMER_UPDATE', timer });
      } catch (e) {}
    }

    // Sync to server so builder app & external monitor stay 100% linked
    if (syncToServer) {
      syncTimerToServer(timer);
    }
  } catch (err) {
    console.warn('Failed to persist running timer:', err);
  }
}

export function clearRunningTimer(syncToServer: boolean = true): void {
  try {
    localStorage.removeItem(TIMER_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('studyplanner:timer-update', { detail: null }));
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: 'TIMER_UPDATE', timer: null });
      } catch (e) {}
    }
    if (syncToServer) {
      syncTimerToServer(null, true);
    }
  } catch (err) {
    console.warn('Failed to clear running timer:', err);
  }
}

/**
 * Start or restart an app-wide timer session
 */
export function startGlobalTimerSession(
  subjectName: string,
  topicName: string,
  durationMinutes: number = 25,
  mode: 'focus' | 'exam' | 'break' = 'focus'
): GlobalTimerSession {
  const targetSeconds = Math.max(60, Math.round(durationMinutes * 60));
  const now = Date.now();
  const session: GlobalTimerSession = {
    isRunning: true,
    isPaused: false,
    mode,
    subjectName: subjectName || 'General',
    topicName: topicName || 'Study Session',
    targetSeconds,
    secondsLeft: targetSeconds,
    startedAtTimestamp: now,
    targetEndTimestamp: now + (targetSeconds * 1000),
    lastTickTimestamp: now,
    hasNotifiedCompletion: false
  };

  persistRunningTimer(session);
  return session;
}

export function pauseGlobalTimerSession(): GlobalTimerSession | null {
  const current = getPersistedTimer();
  if (!current || !current.isRunning) return null;

  const updated: GlobalTimerSession = {
    ...current,
    isPaused: true,
    targetEndTimestamp: undefined // Freeze until resumed
  };
  persistRunningTimer(updated);
  return updated;
}

export function resumeGlobalTimerSession(): GlobalTimerSession | null {
  const current = getPersistedTimer();
  if (!current) return null;

  const now = Date.now();
  const updated: GlobalTimerSession = {
    ...current,
    isRunning: true,
    isPaused: false,
    targetEndTimestamp: now + (current.secondsLeft * 1000),
    lastTickTimestamp: now
  };
  persistRunningTimer(updated);
  return updated;
}

export function addMinutesToGlobalTimer(minutes: number = 5): GlobalTimerSession | null {
  const current = getPersistedTimer();
  if (!current) return null;

  const additionalSeconds = minutes * 60;
  const newSecondsLeft = current.secondsLeft + additionalSeconds;
  const now = Date.now();

  const updated: GlobalTimerSession = {
    ...current,
    secondsLeft: newSecondsLeft,
    targetSeconds: current.targetSeconds + additionalSeconds,
    targetEndTimestamp: current.isRunning && !current.isPaused ? (now + newSecondsLeft * 1000) : current.targetEndTimestamp,
    hasNotifiedCompletion: false
  };
  persistRunningTimer(updated);
  return updated;
}

/**
 * Triggers instant system push notification & chime when a sprint finishes
 */
function triggerTimerCompletionPush(timer: GlobalTimerSession) {
  playNotificationChime();

  const isBreak = timer.mode === 'break';
  const title = isBreak ? '☕ Break Finished!' : `⏱️ Sprint Complete: ${timer.subjectName}!`;
  const body = isBreak
    ? 'Time to return to your study cockpit and start your next focus block.'
    : `Excellent work! You finished studying "${timer.topicName}". Click to log active recall and sign your hours.`;

  sendNativePushNotification({
    title,
    body,
    tag: `timer-finish-${Date.now()}`,
    playSound: true,
    onClickUrl: '/?tab=study_cockpit',
    actions: [
      { action: 'start-timer', title: '⏱️ Start 5m Break' },
      { action: 'mark-done', title: '✍️ Sign Hours' }
    ]
  });
}

/**
 * Schedule an immediate study or break reminder (e.g. "Remind me in 10 mins")
 */
export function scheduleImmediateReminder(title: string, topic: string, delayMinutes: number): ImmediateStudyReminder {
  const now = Date.now();
  const reminder: ImmediateStudyReminder = {
    id: `rem_${now}_${Math.random().toString(36).substring(2, 6)}`,
    title,
    topic,
    targetTimestamp: now + (delayMinutes * 60 * 1000),
    minutes: delayMinutes,
    triggered: false
  };

  try {
    const list = getImmediateReminders();
    list.push(reminder);
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}

  // Also schedule notification via setTimeout if window remains open
  setTimeout(() => {
    checkAndFireImmediateReminders();
  }, delayMinutes * 60 * 1000);

  return reminder;
}

export function getImmediateReminders(): ImmediateStudyReminder[] {
  try {
    const raw = localStorage.getItem(REMINDER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function checkAndFireImmediateReminders(): void {
  try {
    const list = getImmediateReminders();
    const now = Date.now();
    let updated = false;

    for (const r of list) {
      if (!r.triggered && now >= r.targetTimestamp) {
        r.triggered = true;
        updated = true;
        playNotificationChime();
        sendNativePushNotification({
          title: `🔔 Reminder: ${r.title}`,
          body: `Time to focus on ${r.topic || 'your daily study goal'}. Start your sprint now!`,
          tag: `immediate-reminder-${r.id}`,
          playSound: true,
          onClickUrl: '/?tab=study_cockpit'
        });
      }
    }

    if (updated) {
      const activeOnly = list.filter(r => !r.triggered || now - r.targetTimestamp < 24 * 3600 * 1000);
      localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(activeOnly));
    }
  } catch (e) {}
}

// Set up periodic check for background reminders and timer synchronization
if (typeof window !== 'undefined') {
  setInterval(() => {
    getPersistedTimer();
    checkAndFireImmediateReminders();
  }, 1000);

  // Sync across windows
  window.addEventListener('storage', (e) => {
    if (e.key === TIMER_STORAGE_KEY) {
      window.dispatchEvent(new CustomEvent('studyplanner:timer-update', {
        detail: getPersistedTimer()
      }));
    }
  });

  if (broadcastChannel) {
    broadcastChannel.onmessage = (e) => {
      if (e.data?.type === 'TIMER_UPDATE') {
        window.dispatchEvent(new CustomEvent('studyplanner:timer-update', {
          detail: e.data.timer
        }));
      }
    };
  }

  // Real-time server sync function
  async function pullServerTimerState() {
    try {
      const res = await fetch('/api/timer/state');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      const currentLocal = getPersistedTimer();
      const serverTimer = data.timer as GlobalTimerSession | null;

      // If server timer exists
      if (serverTimer) {
        if (!currentLocal || currentLocal.isRunning !== serverTimer.isRunning || Math.abs(currentLocal.secondsLeft - serverTimer.secondsLeft) > 2) {
          localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(serverTimer));
          window.dispatchEvent(new CustomEvent('studyplanner:timer-update', { detail: serverTimer }));
        }
      } else if (currentLocal && currentLocal.isRunning) {
        // If server says stopped or null, stop local
        localStorage.removeItem(TIMER_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent('studyplanner:timer-update', { detail: null }));
      }
    } catch (e) {}
  }

  // Pull immediately on startup
  pullServerTimerState();

  // Periodic poll every 2.5s to guarantee sync across tabs & builder preview
  setInterval(pullServerTimerState, 2500);

  // Sync on window focus / visibility change
  window.addEventListener('focus', pullServerTimerState);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pullServerTimerState();
    }
  });

  // Connect to SSE event stream for sub-100ms timer bridging
  try {
    const sse = new EventSource('/api/sync/events?deviceName=TimerClient');
    sse.addEventListener('timer_update', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        const incomingTimer = payload.timer as GlobalTimerSession | null;
        if (incomingTimer) {
          localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(incomingTimer));
          window.dispatchEvent(new CustomEvent('studyplanner:timer-update', { detail: incomingTimer }));
        } else {
          localStorage.removeItem(TIMER_STORAGE_KEY);
          window.dispatchEvent(new CustomEvent('studyplanner:timer-update', { detail: null }));
        }
      } catch (err) {}
    });
  } catch (err) {}
}
