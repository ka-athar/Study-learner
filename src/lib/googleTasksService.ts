/**
 * Google Tasks Integration Service
 * Real-time task synchronization, task list management, and task item tracking via Google Tasks API v1.
 */

import { getOrRequestWorkspaceToken, getCachedWorkspaceToken } from './googleAuthService';
import { StudyPlan, RevisionItem, ExamDate, InAppCalendarEvent } from '../types';
import { formatHumanDate } from './inbuiltCalendarAnalyzer';

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
  selfLink?: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  updated?: string;
  parent?: string;
  position?: string;
  links?: Array<{ href: string; type: string; description?: string }>;
}

/**
 * Lists all task lists for the current user.
 */
export async function listTaskLists(tokenOverride?: string): Promise<GoogleTaskList[]> {
  const token = tokenOverride || getCachedWorkspaceToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn(`Failed to fetch task lists (${response.status})`, err);
      return [];
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.warn('Network error fetching task lists:', error);
    return [];
  }
}

/**
 * Finds or creates a dedicated "StudyFlow Academic Tasks" list.
 */
export async function getOrCreateStudyTaskList(): Promise<GoogleTaskList> {
  const lists = await listTaskLists();
  const existing = lists.find(l => l.title === 'StudyFlow Academic Tasks' || l.title === 'Study Tasks');
  if (existing) return existing;

  const token = await getOrRequestWorkspaceToken(true);
  const createRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'StudyFlow Academic Tasks'
    })
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create task list (${createRes.status})`);
  }

  return await createRes.json();
}

/**
 * Lists tasks in a specific task list.
 */
export async function listTasks(taskListId: string = '@default', tokenOverride?: string): Promise<GoogleTaskItem[]> {
  const token = tokenOverride || getCachedWorkspaceToken();
  if (!token) {
    return [];
  }

  const params = new URLSearchParams({
    showCompleted: 'true',
    showHidden: 'true',
    maxResults: '100'
  });

  try {
    const response = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn(`Tasks fetch returned status ${response.status}`, err);
      return [];
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.warn('Network error fetching tasks:', error);
    return [];
  }
}

/**
 * Creates a new task in Google Tasks.
 */
export async function createGoogleTask(
  task: {
    title: string;
    notes?: string;
    dueDate?: string; // YYYY-MM-DD
    taskListId?: string;
  }
): Promise<GoogleTaskItem> {
  const token = await getOrRequestWorkspaceToken();
  const taskListId = task.taskListId || '@default';

  const body: any = {
    title: task.title,
    notes: task.notes || 'Created by StudyFlow Study Planner',
    status: 'needsAction'
  };

  if (task.dueDate) {
    // Google Tasks requires RFC 3339 timestamp with T00:00:00.000Z
    const cleanDate = task.dueDate.split('T')[0];
    body.due = `${cleanDate}T00:00:00.000Z`;
  }

  const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create task in Google Tasks (${response.status})`);
  }

  return await response.json();
}

/**
 * Updates an existing task in Google Tasks.
 */
export async function updateGoogleTask(
  taskListId: string = '@default',
  taskId: string,
  updates: {
    title?: string;
    notes?: string;
    dueDate?: string; // YYYY-MM-DD
    status?: 'needsAction' | 'completed';
  },
  tokenOverride?: string
): Promise<GoogleTaskItem> {
  const token = tokenOverride || await getOrRequestWorkspaceToken();
  const body: any = {};

  if (updates.title !== undefined) body.title = updates.title;
  if (updates.notes !== undefined) body.notes = updates.notes;
  if (updates.status !== undefined) body.status = updates.status;
  if (updates.dueDate) {
    const cleanDate = updates.dueDate.split('T')[0];
    body.due = `${cleanDate}T00:00:00.000Z`;
  }

  const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to update task in Google Tasks (${response.status})`);
  }

  return await response.json();
}

/**
 * Synchronizes a finalized InAppCalendarEvent to Google Tasks.
 * If event already has a googleTaskId, updates it in place.
 * Otherwise creates a new Google Task.
 * Never creates duplicates!
 */
export async function syncInAppEventToGoogleTask(
  event: InAppCalendarEvent,
  tokenOverride?: string
): Promise<{ googleTaskId: string; status: 'created' | 'updated' }> {
  const taskList = await getOrCreateStudyTaskList();
  const taskListId = taskList.id;

  const title = `${event.subjectName}${event.chapterName ? ` — ${event.chapterName}` : ''} — ${event.topicName}`;
  const notes = [
    `Scheduled:\n${formatHumanDate(event.date)}, ${event.startTime}`,
    `Duration:\n${event.durationMinutes} minutes`,
    `Deadline:\n${event.deadline}`,
    `Priority:\n${event.priority}`,
    `In-App Calendar Event ID: [StudyFlow-Event-Id:${event.id}]`,
    event.planId ? `Study Plan ID: [StudyFlow-Plan-Id:${event.planId}]` : null,
    'Accountability: Monitored via Zapier -> Gmail'
  ].filter(Boolean).join('\n\n');

  const payload = {
    title,
    notes,
    dueDate: event.date,
    status: (event.completed ? 'completed' : 'needsAction') as 'needsAction' | 'completed'
  };

  // If Google Task ID exists, update it
  if (event.googleTaskId) {
    try {
      const updated = await updateGoogleTask(taskListId, event.googleTaskId, payload, tokenOverride);
      return { googleTaskId: updated.id, status: 'updated' };
    } catch (err: any) {
      // If 404 (deleted from Google Tasks directly), recreate it
      if (err?.message?.includes('404') || err?.message?.includes('Not Found')) {
        const created = await createGoogleTask({
          title: payload.title,
          notes: payload.notes,
          dueDate: payload.dueDate,
          taskListId
        });
        if (event.completed) {
          await toggleGoogleTaskStatus(taskListId, created.id, true);
        }
        return { googleTaskId: created.id, status: 'created' };
      }
      throw err;
    }
  }

  // Otherwise check if a matching task already exists to prevent duplicates
  try {
    const existingTasks = await listTasks(taskListId, tokenOverride);
    const matched = existingTasks.find(t => {
      if (t.notes && t.notes.includes(`[StudyFlow-Event-Id:${event.id}]`)) return true;
      // Also match normalized title + due date
      const cleanExisting = (t.title || '').replace(/[📖📚🔄📌🎯\[\]]/g, '').trim().toLowerCase();
      const cleanTarget = title.replace(/[📖📚🔄📌🎯\[\]]/g, '').trim().toLowerCase();
      return (cleanExisting === cleanTarget || cleanExisting.includes(event.topicName.toLowerCase())) &&
             (!t.due || t.due.startsWith(event.date));
    });

    if (matched) {
      const updated = await updateGoogleTask(taskListId, matched.id, payload, tokenOverride);
      return { googleTaskId: updated.id, status: 'updated' };
    }
  } catch (searchErr) {
    console.warn('Could not query tasks for deduplication:', searchErr);
  }

  // Otherwise create new task
  const created = await createGoogleTask({
    title: payload.title,
    notes: payload.notes,
    dueDate: payload.dueDate,
    taskListId
  });

  if (event.completed) {
    await toggleGoogleTaskStatus(taskListId, created.id, true);
  }

  return { googleTaskId: created.id, status: 'created' };
}

/**
 * Toggles a task's status between 'completed' and 'needsAction'.
 */
export async function toggleGoogleTaskStatus(
  taskListId: string = '@default',
  taskId: string,
  completed: boolean
): Promise<GoogleTaskItem> {
  const token = await getOrRequestWorkspaceToken();
  const payload: any = {
    status: completed ? 'completed' : 'needsAction'
  };

  if (!completed) {
    payload.completed = null;
  }

  const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to update task status (${response.status})`);
  }

  return await response.json();
}

/**
 * Deletes a task from Google Tasks.
 */
export async function deleteGoogleTask(taskListId: string = '@default', taskId: string): Promise<boolean> {
  const token = await getOrRequestWorkspaceToken();
  const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok && response.status !== 404) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to delete task (${response.status})`);
  }

  return true;
}

export const GOOGLE_TASKS_TRANSFERRED_KEY = 'studyflow_transferred_google_tasks_v1';

export interface TransferredTaskRecord {
  taskId: string;
  transferredAt: string;
  title: string;
  dueDate?: string;
}

/**
 * Retrieves the local cache of items already transferred to Google Tasks.
 */
export function getTransferredGoogleTaskIds(): Record<string, TransferredTaskRecord> {
  try {
    const raw = localStorage.getItem(GOOGLE_TASKS_TRANSFERRED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Marks an item as transferred to Google Tasks to prevent repeated transfers.
 */
export function markGoogleTaskTransferred(itemKey: string, taskId: string, title: string, dueDate?: string) {
  try {
    const map = getTransferredGoogleTaskIds();
    map[itemKey] = {
      taskId,
      transferredAt: new Date().toISOString(),
      title,
      dueDate
    };
    localStorage.setItem(GOOGLE_TASKS_TRANSFERRED_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Could not persist transferred Google Task record:', e);
  }
}

/**
 * Checks if a specific study item has already been transferred to Google Tasks.
 */
export function isItemTransferredToGoogleTasks(itemKey: string): boolean {
  const map = getTransferredGoogleTaskIds();
  return Boolean(map[itemKey]);
}

/**
 * Clears the transferred tasks cache if user wants to reset transfer states.
 */
export function clearTransferredGoogleTaskCache() {
  try {
    localStorage.removeItem(GOOGLE_TASKS_TRANSFERRED_KEY);
  } catch (e) {}
}

export interface SingleTaskTransferItem {
  id: string; // unique item id
  type: 'session' | 'plan_topic' | 'revision' | 'exam' | 'manual';
  title: string;
  notes?: string;
  dueDate?: string; // YYYY-MM-DD
  completed?: boolean;
  taskListId?: string;
}

/**
 * Transfers a SINGLE study item (study session, topic, revision) to Google Tasks.
 * Enforces strict ONE-TIME transfer rule:
 * If this item was already transferred, it avoids duplicate creation.
 */
export async function transferSingleTaskToGoogleTasks(
  item: SingleTaskTransferItem,
  options: { force?: boolean; tokenOverride?: string } = {}
): Promise<{ 
  success: boolean; 
  status: 'created' | 'updated' | 'already_transferred'; 
  googleTaskId: string; 
  message: string;
}> {
  const itemKey = `${item.type}:${item.id}`;
  const transferredMap = getTransferredGoogleTaskIds();
  const existingRecord = transferredMap[itemKey];

  const taskList = await getOrCreateStudyTaskList();
  const taskListId = item.taskListId || taskList.id;

  // 1. If already transferred and force is not specified, return existing record
  if (existingRecord && !options.force) {
    return {
      success: true,
      status: 'already_transferred',
      googleTaskId: existingRecord.taskId,
      message: `Already transferred to Google Tasks on ${new Date(existingRecord.transferredAt).toLocaleDateString()} (Duplicates prevented).`
    };
  }

  // 2. Format title & notes with StudyFlow tracking tag
  const title = item.title;
  const notes = [
    item.notes || '',
    `[StudyFlow-Item-Key:${itemKey}]`,
    `[StudyFlow-Source:${item.type}]`,
    `Transferred: ${new Date().toLocaleString()}`
  ].filter(Boolean).join('\n\n');

  // 3. Query existing tasks in Google Tasks to prevent duplication across devices
  let matchingExistingId: string | null = null;
  try {
    const existingTasks = await listTasks(taskListId, options.tokenOverride);
    const matched = existingTasks.find(t => {
      if (t.notes && t.notes.includes(`[StudyFlow-Item-Key:${itemKey}]`)) return true;
      if (existingRecord && t.id === existingRecord.taskId) return true;
      const cleanExisting = (t.title || '').replace(/[📖📚🔄📌🎯⚡\[\]]/g, '').trim().toLowerCase();
      const cleanTarget = title.replace(/[📖📚🔄📌🎯⚡\[\]]/g, '').trim().toLowerCase();
      return (cleanExisting === cleanTarget) && (!t.due || !item.dueDate || t.due.startsWith(item.dueDate));
    });
    if (matched) {
      matchingExistingId = matched.id;
    }
  } catch (err) {
    console.warn('Could not query tasks for deduplication in transferSingleTaskToGoogleTasks:', err);
  }

  // 4. Update if exists, or create new
  if (matchingExistingId) {
    const updated = await updateGoogleTask(
      taskListId,
      matchingExistingId,
      {
        title,
        notes,
        dueDate: item.dueDate,
        status: item.completed ? 'completed' : 'needsAction'
      },
      options.tokenOverride
    );
    markGoogleTaskTransferred(itemKey, updated.id, title, item.dueDate);
    return {
      success: true,
      status: 'updated',
      googleTaskId: updated.id,
      message: `Updated existing task in Google Tasks ("${title}").`
    };
  }

  const created = await createGoogleTask({
    title,
    notes,
    dueDate: item.dueDate,
    taskListId
  });

  if (item.completed) {
    await toggleGoogleTaskStatus(taskListId, created.id, true);
  }

  markGoogleTaskTransferred(itemKey, created.id, title, item.dueDate);

  return {
    success: true,
    status: 'created',
    googleTaskId: created.id,
    message: `✓ Transferred 1 item to Google Tasks ("${title}").`
  };
}

/**
 * Batch syncs study plan topics and spaced revisions into Google Tasks.
 * Strictly respects 1-time transfer rule to prevent recurring/duplicate tasks.
 */
export async function syncPlansAndRevisionsToGoogleTasks(
  items: {
    plans?: StudyPlan[];
    revisions?: RevisionItem[];
    examDates?: ExamDate[];
  },
  onProgress?: (current: number, total: number, taskName: string) => void,
  options: { force?: boolean; selectedItemKeys?: string[] } = {}
): Promise<{ success: boolean; createdCount: number; skippedCount: number; errors: string[] }> {
  const taskList = await getOrCreateStudyTaskList();
  const taskListId = taskList.id;
  const errors: string[] = [];
  let createdCount = 0;
  let skippedCount = 0;

  const transferredMap = getTransferredGoogleTaskIds();

  // Fetch current Google Tasks list once to perform bulk deduplication
  let existingTasks: GoogleTaskItem[] = [];
  try {
    existingTasks = await listTasks(taskListId);
  } catch (e) {
    console.warn('Could not pre-fetch Google Tasks for deduplication:', e);
  }

  const tasksToQueue: Array<{ key: string; title: string; notes: string; dueDate?: string; completed?: boolean }> = [];

  // 1. Study Plan Topics
  (items.plans || []).forEach(plan => {
    (plan.topics || []).forEach(tp => {
      const key = `plan_topic:${plan.id}-${tp.id || tp.topicName}`;
      if (!tp.completed) {
        tasksToQueue.push({
          key,
          title: `📖 [${tp.subjectName}] ${tp.topicName}`,
          notes: `Chapter: ${tp.chapterName}\nEstimated: ${tp.estimatedMinutes}m | Priority: ${tp.priority}\nPlan: ${plan.title || 'Daily Target'}\nSynced from StudyFlow`,
          dueDate: plan.date,
          completed: false
        });
      }
    });
  });

  // 2. Spaced Revisions Due
  (items.revisions || []).forEach(rev => {
    const key = `revision:${rev.id}`;
    if (rev.status !== 'Completed') {
      tasksToQueue.push({
        key,
        title: `🔄 Revise: ${rev.topicName} (${rev.subjectName})`,
        notes: `Chapter: ${rev.chapterName}\nPriority: ${rev.priority}\nDue Date: ${rev.dueDate}\nReason: ${rev.reason || 'Spaced Repetition'}`,
        dueDate: rev.dueDate,
        completed: false
      });
    }
  });

  // 3. Exam Targets
  (items.examDates || []).forEach(exam => {
    const key = `exam:${exam.id}`;
    tasksToQueue.push({
      key,
      title: `🎯 EXAM: ${exam.examName} (${exam.subjectName})`,
      notes: `Target Exam Date: ${exam.date}\nCountdown active in StudyFlow.`,
      dueDate: exam.date,
      completed: false
    });
  });

  // Filter by selectedItemKeys if user selected specific items
  const filteredQueue = options.selectedItemKeys && options.selectedItemKeys.length > 0
    ? tasksToQueue.filter(t => options.selectedItemKeys!.includes(t.key))
    : tasksToQueue;

  const total = filteredQueue.length;
  for (let i = 0; i < total; i++) {
    const item = filteredQueue[i];
    if (onProgress) onProgress(i + 1, total, item.title);

    // Check if already transferred in local registry
    if (transferredMap[item.key] && !options.force) {
      skippedCount++;
      continue;
    }

    // Check if already present in Google Tasks (by item tag or normalized title + date)
    const cleanTarget = item.title.replace(/[📖📚🔄📌🎯⚡\[\]]/g, '').trim().toLowerCase();
    const alreadyInGoogleTasks = existingTasks.find(t => {
      if (t.notes && t.notes.includes(`[StudyFlow-Item-Key:${item.key}]`)) return true;
      const cleanExisting = (t.title || '').replace(/[📖📚🔄📌🎯⚡\[\]]/g, '').trim().toLowerCase();
      return cleanExisting === cleanTarget && (!t.due || !item.dueDate || t.due.startsWith(item.dueDate));
    });

    if (alreadyInGoogleTasks && !options.force) {
      markGoogleTaskTransferred(item.key, alreadyInGoogleTasks.id, item.title, item.dueDate);
      skippedCount++;
      continue;
    }

    try {
      const notesWithTag = `${item.notes}\n\n[StudyFlow-Item-Key:${item.key}]`;
      const created = await createGoogleTask({
        title: item.title,
        notes: notesWithTag,
        dueDate: item.dueDate,
        taskListId
      });
      markGoogleTaskTransferred(item.key, created.id, item.title, item.dueDate);
      createdCount++;
      await new Promise(r => setTimeout(r, 120));
    } catch (e: any) {
      errors.push(`Failed to add task "${item.title}": ${e.message}`);
    }
  }

  return {
    success: errors.length === 0,
    createdCount,
    skippedCount,
    errors
  };
}

/**
 * Scans Google Tasks for duplicate study tasks (matching [StudyFlow-Event-Id] or identical normalized title + due date),
 * keeps one canonical task, and removes all redundant duplicates.
 */
export async function cleanDuplicateGoogleTasks(
  tokenOverride?: string
): Promise<{ checkedCount: number; removedDuplicatesCount: number; errors: string[] }> {
  const token = tokenOverride || await getOrRequestWorkspaceToken();
  const taskList = await getOrCreateStudyTaskList();
  const tasks = await listTasks(taskList.id, token);
  const seenTaskKeys = new Map<string, string>(); // key -> canonical taskId
  let removedCount = 0;
  const errors: string[] = [];

  for (const t of tasks) {
    let key = '';
    const idMatch = t.notes?.match(/\[StudyFlow-Event-Id:([^\]]+)\]/);
    if (idMatch && idMatch[1]) {
      // Normalize cal-evt-planId-tp-0 to cal-evt-planId-0
      key = `id:${idMatch[1].replace(/-tp-(\d+)/, '-$1').trim()}`;
    } else {
      const cleanTitle = (t.title || '').replace(/[📖📚🔄📌🎯\[\]]/g, '').trim().toLowerCase();
      const cleanDue = (t.due || '').split('T')[0];
      key = `title:${cleanTitle}::${cleanDue}`;
    }

    if (seenTaskKeys.has(key)) {
      // Duplicate task found! Remove redundant copy
      try {
        await deleteGoogleTask(taskList.id, t.id);
        removedCount++;
        await new Promise(r => setTimeout(r, 120));
      } catch (err: any) {
        errors.push(`Failed to remove duplicate task "${t.title}": ${err.message}`);
      }
    } else {
      seenTaskKeys.set(key, t.id);
    }
  }

  return {
    checkedCount: tasks.length,
    removedDuplicatesCount: removedCount,
    errors
  };
}
