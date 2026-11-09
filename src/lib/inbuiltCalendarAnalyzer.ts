/**
 * Inbuilt Calendar Analyzer
 * 
 * Central scheduling engine that takes analyzed study plans and converts them
 * into definitive, scheduled Inbuilt Application Calendar Events.
 * 
 * Flow:
 * Existing Study Plan Analysis
 *   ↓
 * Topics / Sessions identified for scheduling
 *   ↓
 * Inbuilt Calendar Analyzer
 *   ↓
 * Inbuilt Application Calendar (SOURCE OF TRUTH)
 *   ↓
 * Google Calendar ➔ Google Tasks ➔ Zapier ➔ Gmail
 * 
 * Preserves generated dates, start times, end times, durations, deadlines,
 * and priorities. Employs persistent internal calendar event IDs that track:
 * Study Plan Item ➔ In-App Calendar Event ➔ Google Calendar Event ➔ Google Task.
 * 
 * External services synchronize strictly FROM these finalized in-app events,
 * updating existing records in-place and preventing duplicates.
 */

import { StudyPlan, StudyPlanTopic, InAppCalendarEvent, CalendarSyncStatus } from '../types';
import { syncInAppEventToGoogleCalendar, deleteCalendarEvent } from './googleCalendarService';
import { syncInAppEventToGoogleTask, deleteGoogleTask, toggleGoogleTaskStatus, getOrCreateStudyTaskList } from './googleTasksService';

export interface AnalyzerOptions {
  defaultStartTime?: string; // e.g. "18:00" or "6:00 PM"
  staggerSessions?: boolean;
}

/**
 * Normalizes various human and ISO date strings into standard "YYYY-MM-DD" format.
 * Examples handled:
 * - "2026-09-30" ➔ "2026-09-30"
 * - "30 September", "30th September", "September 30", "30 Sep 2026", "Sep 30" ➔ "2026-09-30"
 * - "Today", "Tomorrow" ➔ calculated relative to current date
 */
export function normalizeToIsoDate(rawDateStr?: string, fallbackDate?: string): string {
  const today = new Date();
  const defaultIso = fallbackDate || today.toISOString().split('T')[0];

  if (!rawDateStr || !rawDateStr.trim()) {
    return defaultIso;
  }

  const clean = rawDateStr.trim();

  // If already standard ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  const lower = clean.toLowerCase();
  if (lower === 'today') {
    return today.toISOString().split('T')[0];
  }
  if (lower === 'tomorrow') {
    const tmr = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    return tmr.toISOString().split('T')[0];
  }

  const monthsMap: Record<string, number> = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11
  };

  // Pattern A: "30 September", "30th September", "30 September 2026"
  const dayMonthMatch = clean.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?/i);
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1], 10);
    const mStr = dayMonthMatch[2].toLowerCase();
    const year = dayMonthMatch[3] ? parseInt(dayMonthMatch[3], 10) : today.getFullYear();
    if (monthsMap[mStr] !== undefined) {
      const month = monthsMap[mStr];
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayFormatted = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dayFormatted}`;
      }
    }
  }

  // Pattern B: "September 30", "September 30th", "September 30, 2026"
  const monthDayMatch = clean.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i);
  if (monthDayMatch) {
    const mStr = monthDayMatch[1].toLowerCase();
    const day = parseInt(monthDayMatch[2], 10);
    const year = monthDayMatch[3] ? parseInt(monthDayMatch[3], 10) : today.getFullYear();
    if (monthsMap[mStr] !== undefined) {
      const month = monthsMap[mStr];
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayFormatted = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dayFormatted}`;
      }
    }
  }

  // Direct date parse fallback
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return defaultIso;
}

/**
 * Formats an ISO date ("2026-09-30") into human readable format: "30 September".
 */
export function formatHumanDate(isoDateStr: string): string {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    if (!isNaN(dateObj.getTime())) {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const currentYear = new Date().getFullYear();
      return `${d} ${monthNames[m]}${y !== currentYear ? ` ${y}` : ''}`;
    }
  }
  return isoDateStr;
}

/**
 * Converts a time string (12h or 24h, e.g. "6:00 PM", "18:00", "09:30 AM") to total minutes from midnight.
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 18 * 60; // Default 6:00 PM

  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');

  // Strip AM/PM
  const numericPart = clean.replace(/[^0-9:]/g, '');
  const parts = numericPart.split(':');
  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;

  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  return Math.min(23 * 60 + 59, Math.max(0, hours * 60 + minutes));
}

/**
 * Formats total minutes from midnight into 24h format "HH:mm".
 */
export function minutesTo24HourTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formats total minutes from midnight into human 12-hour format (e.g. "6:00 PM", "7:00 PM", "9:30 AM").
 */
export function minutesTo12HourTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  let h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  
  if (h === 0) {
    h = 12;
  } else if (h > 12) {
    h -= 12;
  }

  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Calculates end time from:
 * Start Time + Duration
 * It does so consistently: E.g., Start: 6:00 PM, Duration: 60 minutes -> End: 7:00 PM.
 */
export function calculateConsistentEndTime(
  startTimeStr: string,
  durationMinutes: number
): {
  startTime24: string;
  startTime12: string;
  endTime24: string;
  endTime12: string;
  durationMinutes: number;
} {
  const startMins = timeStringToMinutes(startTimeStr);
  const duration = Math.max(15, Math.round(durationMinutes || 60));
  const endMins = Math.min(23 * 60 + 59, startMins + duration);

  return {
    startTime24: minutesTo24HourTime(startMins),
    startTime12: minutesTo12HourTime(startMins),
    endTime24: minutesTo24HourTime(endMins),
    endTime12: minutesTo12HourTime(endMins),
    durationMinutes: duration
  };
}

/**
 * Parses any embedded time range from notes or titles
 * (e.g. "6:00 PM - 7:00 PM", "6:00 PM to 7:00 PM", "18:00-19:00", "09:00 to 10:30").
 */
export function extractEmbeddedTimeRange(text: string): { startTime?: string; endTime?: string; durationMinutes?: number } | null {
  if (!text) return null;

  const rangeRegex = /([0-9]{1,2}(?::[0-9]{2})?\s*(?:AM|PM|am|pm)?)\s*(?:-|–|—|to)\s*([0-9]{1,2}(?::[0-9]{2})?\s*(?:AM|PM|am|pm)?)/i;
  const match = text.match(rangeRegex);

  if (match) {
    const rawStart = match[1].trim();
    const rawEnd = match[2].trim();
    const startMins = timeStringToMinutes(rawStart);
    const endMins = timeStringToMinutes(rawEnd);

    if (endMins > startMins) {
      return {
        startTime: minutesTo12HourTime(startMins),
        endTime: minutesTo12HourTime(endMins),
        durationMinutes: endMins - startMins
      };
    }
  }

  // Single time match: "at 6:00 PM", "from 6:00 PM", "@ 6:00 PM", "starts 18:00"
  const singleRegex = /(?:at|from|@|starts)\s*([0-9]{1,2}(?::[0-9]{2})?\s*(?:AM|PM|am|pm)?)/i;
  const singleMatch = text.match(singleRegex);
  if (singleMatch) {
    const rawStart = singleMatch[1].trim();
    const startMins = timeStringToMinutes(rawStart);
    return {
      startTime: minutesTo12HourTime(startMins)
    };
  }

  return null;
}

/**
 * Standard staggered start times for study days (Slot 1: 09:00, Slot 2: 11:00, Slot 3: 14:00, Slot 4: 16:00, Slot 5: 18:00 / 6:00 PM).
 */
const DEFAULT_STAGGERED_START_SLOTS = [
  '6:00 PM', // Slot 1: Evening Standard (6:00 PM)
  '7:15 PM', // Slot 2: Evening Second Session
  '8:30 PM', // Slot 3: Night Focus
  '9:00 AM', // Slot 4: Morning Focus
  '11:00 AM', // Slot 5: Midday Sprint
  '2:00 PM', // Slot 6: Afternoon Deep Work
  '4:00 PM'  // Slot 7: Pre-Evening
];

/**
 * Analyzes a single StudyPlanTopic from an existing study plan, preserving all
 * generated properties, and converts it into a full InAppCalendarEvent.
 * 
 * Example input:
 * Biology
 * Chapter 10 — Animalia
 * Topic: Arthropoda
 * Date: 30 September
 * Time: 6:00 PM–7:00 PM
 * Duration: 60 minutes
 * 
 * -> Output: InAppCalendarEvent with exact date, 6:00 PM start, 7:00 PM end, 60m duration,
 * deadline 7:00 PM, unique persistent calendarEventId, and external synchronization mapping.
 */
export function analyzeStudyTopicIntoCalendarEvent(
  plan: StudyPlan,
  topic: StudyPlanTopic,
  topicIndex: number = 0,
  options?: AnalyzerOptions
): InAppCalendarEvent {
  // 1. Date normalization: Preserves generated date e.g. "30 September" -> "2026-09-30"
  const rawDate = topic.date || plan.date;
  const planDate = normalizeToIsoDate(rawDate, plan.date || new Date().toISOString().split('T')[0]);

  // 2. Duration: Preserve already generated duration; fallback to 60 if missing
  const duration = topic.estimatedMinutes && topic.estimatedMinutes > 0
    ? topic.estimatedMinutes
    : 60;

  // 3. Start Time & End Time extraction
  let determinedStartTime = topic.startTime || '';
  let determinedEndTime = topic.endTime || '';

  // If start time was not directly on topic, check embedded text in topicName, reason, completionDetails, or plan reasoning
  if (!determinedStartTime) {
    const textToScan = `${topic.topicName || ''} ${topic.reason || ''} ${topic.completionDetails || ''} ${plan.reasoning || ''}`;
    const embedded = extractEmbeddedTimeRange(textToScan);
    if (embedded?.startTime) {
      determinedStartTime = embedded.startTime;
      if (embedded.endTime) {
        determinedEndTime = embedded.endTime;
      }
    }
  }

  // If still no start time, use user option or staggered slot for the day
  if (!determinedStartTime) {
    if (options?.defaultStartTime) {
      determinedStartTime = options.defaultStartTime;
    } else {
      const slotIdx = topicIndex % DEFAULT_STAGGERED_START_SLOTS.length;
      determinedStartTime = DEFAULT_STAGGERED_START_SLOTS[slotIdx];
    }
  }

  // Calculate consistent end time:
  // Start: 6:00 PM + Duration: 60 minutes -> End: 7:00 PM
  const timeCalc = calculateConsistentEndTime(determinedStartTime, duration);
  const startTime = timeCalc.startTime12; // E.g. "6:00 PM"
  const endTime = determinedEndTime 
    ? minutesTo12HourTime(timeStringToMinutes(determinedEndTime))
    : timeCalc.endTime12; // E.g. "7:00 PM"

  // 4. Deadline: Preserves explicit deadline or computes as the session end time on this date
  const deadlineDisplay = topic.deadline || endTime;

  // 5. Unique Inbuilt Calendar Event ID:
  // Must remain attached throughout synchronization to allow:
  // Study Plan Item -> In-App Calendar Event -> Google Calendar Event -> Google Task
  const calendarEventId = topic.calendarEventId || `cal-evt-${plan.id}-${topic.id || `tp-${topicIndex}`}`;

  // 6. External IDs (preserves existing Google Calendar Event ID and Google Task ID)
  const googleCalendarEventId = topic.googleCalendarEventId || undefined;
  const googleTaskId = topic.googleTaskId || undefined;

  // 7. Synchronization Status
  const syncStatus: CalendarSyncStatus = {
    inAppCalendarSynced: true,
    googleCalendarSynced: Boolean(googleCalendarEventId),
    googleCalendarSyncError: topic.syncStatus?.googleCalendarSyncError,
    googleTasksSynced: Boolean(googleTaskId),
    googleTasksSyncError: topic.syncStatus?.googleTasksSyncError,
    accountabilityActive: true,
    lastSyncedAt: topic.syncStatus?.lastSyncedAt || new Date().toISOString()
  };

  const humanDate = formatHumanDate(planDate);

  return {
    id: calendarEventId,
    planId: plan.id,
    planTopicId: topic.id,
    subjectName: topic.subjectName || 'Academic Study',
    chapterName: topic.chapterName || '',
    topicName: topic.topicName || topic.subjectName,
    date: planDate,
    startTime,
    endTime,
    durationMinutes: duration,
    deadline: deadlineDisplay,
    priority: topic.priority || 'Medium',
    reason: topic.reason || plan.reasoning || '',
    notes: `[StudyFlow-Event-Id:${calendarEventId}] Scheduled: ${humanDate} • ${startTime}–${endTime} (${duration}m). Deadline: ${deadlineDisplay}`,
    completed: Boolean(topic.completed),
    completedAt: topic.completedAt,
    googleCalendarEventId,
    googleTaskId,
    syncStatus,
    createdAt: plan.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Inbuilt Calendar Analyzer Main Entrypoint:
 * Converts an entire StudyPlan into definitive InAppCalendarEvents,
 * and updates the StudyPlan itself with preserved start/end times, deadlines, and IDs.
 */
export function analyzeStudyPlanIntoCalendar(
  plan: StudyPlan,
  options?: AnalyzerOptions
): {
  plan: StudyPlan;
  events: InAppCalendarEvent[];
} {
  if (!plan || !Array.isArray(plan.topics)) {
    return { plan, events: [] };
  }

  const events: InAppCalendarEvent[] = [];
  const updatedTopics: StudyPlanTopic[] = plan.topics.map((t, idx) => {
    const event = analyzeStudyTopicIntoCalendarEvent(plan, t, idx, options);
    events.push(event);

    // Write back scheduling fields onto the StudyPlanTopic so the plan stores the exact schedule
    return {
      ...t,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      deadline: event.deadline,
      calendarEventId: event.id,
      googleCalendarEventId: event.googleCalendarEventId,
      googleTaskId: event.googleTaskId,
      syncStatus: event.syncStatus
    };
  });

  const updatedPlan: StudyPlan = {
    ...plan,
    topics: updatedTopics,
    calendarEvents: events,
    updatedAt: new Date().toISOString()
  };

  return {
    plan: updatedPlan,
    events
  };
}

/**
 * Batch processes multiple study plans through the Inbuilt Calendar Analyzer.
 */
export function batchAnalyzeStudyPlansIntoCalendar(
  plans: StudyPlan[],
  options?: AnalyzerOptions
): {
  updatedPlans: StudyPlan[];
  allEvents: InAppCalendarEvent[];
} {
  const updatedPlans: StudyPlan[] = [];
  const allEvents: InAppCalendarEvent[] = [];

  plans.forEach(p => {
    const res = analyzeStudyPlanIntoCalendar(p, options);
    updatedPlans.push(res.plan);
    allEvents.push(...res.events);
  });

  return {
    updatedPlans,
    allEvents
  };
}

/**
 * Extracts all InAppCalendarEvents across all saved StudyPlans.
 * Inbuilt Calendar = Primary Source of Truth.
 */
export function getAllInAppCalendarEvents(plans: StudyPlan[]): InAppCalendarEvent[] {
  const events: InAppCalendarEvent[] = [];
  const seenIds = new Set<string>();

  (plans || []).forEach(plan => {
    // 1. Collect stored calendarEvents
    const existingEvents = plan.calendarEvents || [];
    existingEvents.forEach(evt => {
      if (!seenIds.has(evt.id)) {
        seenIds.add(evt.id);
        events.push(evt);
      }
    });

    // 2. Ensure every topic in plan.topics has a corresponding event even if added dynamically
    (plan.topics || []).forEach((t, idx) => {
      const alreadyRepresented = existingEvents.some(
        e => (t.calendarEventId && e.id === t.calendarEventId) || 
             (e.topicName === t.topicName && (e.date === t.date || e.date === plan.date))
      );
      if (!alreadyRepresented) {
        const generated = analyzeStudyTopicIntoCalendarEvent(plan, t, idx);
        if (!seenIds.has(generated.id)) {
          seenIds.add(generated.id);
          events.push(generated);
        }
      }
    });
  });

  return events;
}

/**
 * Synchronizes a finalized in-app calendar event to BOTH Google Calendar and Google Tasks.
 * 
 * Rules:
 * - In-App Calendar = Source of Truth
 * - External services synchronize FROM finalized in-app calendar
 * - If Google Calendar event exists -> update it; if not -> create it
 * - If Google Task exists -> update it; if not -> create it
 * - Zero duplicates!
 */
export async function synchronizeInAppEventToExternalServices(
  event: InAppCalendarEvent,
  tokenOverride?: string,
  options?: { reminderMinutes?: number; calendarId?: string; syncToTasks?: boolean; taskListId?: string }
): Promise<{
  updatedEvent: InAppCalendarEvent;
  googleCalendarStatus: 'created' | 'updated';
  googleTasksStatus: 'created' | 'updated' | 'skipped';
}> {
  // 1. Synchronize to Google Calendar (Option A: target specific calendarId e.g. dedicated study calendar)
  const reminderMinutes = options?.reminderMinutes !== undefined ? options.reminderMinutes : 0;
  const calendarId = options?.calendarId || 'primary';
  const calRes = await syncInAppEventToGoogleCalendar(event, tokenOverride, reminderMinutes, calendarId);

  // 2. Synchronize to Google Tasks ONLY IF explicitly enabled
  let taskRes: { googleTaskId?: string; status: 'created' | 'updated' | 'skipped' } = {
    googleTaskId: event.googleTaskId,
    status: 'skipped'
  };

  if (options?.syncToTasks) {
    const res = await syncInAppEventToGoogleTask(event, tokenOverride);
    taskRes = { googleTaskId: res.googleTaskId, status: res.status };
  }

  const updatedSyncStatus: CalendarSyncStatus = {
    inAppCalendarSynced: true,
    googleCalendarSynced: true,
    googleTasksSynced: Boolean(taskRes.googleTaskId),
    accountabilityActive: true,
    lastSyncedAt: new Date().toISOString()
  };

  const updatedEvent: InAppCalendarEvent = {
    ...event,
    googleCalendarEventId: calRes.googleCalendarEventId,
    googleTaskId: taskRes.googleTaskId || event.googleTaskId,
    syncStatus: updatedSyncStatus,
    updatedAt: new Date().toISOString()
  };

  return {
    updatedEvent,
    googleCalendarStatus: calRes.status,
    googleTasksStatus: taskRes.status
  };
}

/**
 * Batch synchronizes all InAppCalendarEvents from all study plans into Google Calendar & optionally Google Tasks.
 * Updates plans with returned googleCalendarEventId and googleTaskId, preventing duplicates on repeated syncs.
 */
export async function batchSynchronizeInAppCalendar(
  plans: StudyPlan[],
  tokenOverride?: string,
  onProgress?: (current: number, total: number, itemName: string) => void,
  options?: { reminderMinutes?: number; calendarId?: string; syncToTasks?: boolean; taskListId?: string }
): Promise<{
  updatedPlans: StudyPlan[];
  syncedEvents: InAppCalendarEvent[];
  count: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const syncedEvents: InAppCalendarEvent[] = [];

  // 1. Gather all events from plans
  const { updatedPlans } = batchAnalyzeStudyPlansIntoCalendar(plans);
  const allEvents = getAllInAppCalendarEvents(updatedPlans);
  const total = allEvents.length;

  // Map to hold updated events by ID
  const updatedEventMap = new Map<string, InAppCalendarEvent>();

  for (let i = 0; i < total; i++) {
    const event = allEvents[i];
    if (onProgress) {
      onProgress(i + 1, total, `${event.subjectName}: ${event.topicName}`);
    }

    try {
      const res = await synchronizeInAppEventToExternalServices(event, tokenOverride, options);
      updatedEventMap.set(event.id, res.updatedEvent);
      syncedEvents.push(res.updatedEvent);
      // Small debounce to avoid quota throttle
      await new Promise(r => setTimeout(r, 120));
    } catch (err: any) {
      console.warn(`Sync error for event ${event.id}:`, err);
      errors.push(`[${event.topicName}] ${err.message || 'Sync failed'}`);
    }
  }

  // 2. Write back external IDs to plans & topics
  const finalizedPlans: StudyPlan[] = updatedPlans.map(plan => {
    const newTopics = plan.topics.map(t => {
      const matched = updatedEventMap.get(t.calendarEventId || '');
      if (matched) {
        return {
          ...t,
          calendarEventId: matched.id,
          googleCalendarEventId: matched.googleCalendarEventId,
          googleTaskId: matched.googleTaskId,
          syncStatus: matched.syncStatus
        };
      }
      return t;
    });

    const newCalendarEvents = (plan.calendarEvents || []).map(evt => {
      return updatedEventMap.get(evt.id) || evt;
    });

    return {
      ...plan,
      topics: newTopics,
      calendarEvents: newCalendarEvents,
      updatedAt: new Date().toISOString()
    };
  });

  return {
    updatedPlans: finalizedPlans,
    syncedEvents,
    count: syncedEvents.length,
    errors
  };
}

/**
 * Deletes an event from external services (Google Calendar & Google Tasks) when cancelled/deleted in-app.
 */
export async function deleteInAppEventFromExternalServices(
  event: InAppCalendarEvent,
  tokenOverride?: string
): Promise<void> {
  const promises: Promise<any>[] = [];

  if (event.googleCalendarEventId) {
    promises.push(deleteCalendarEvent(event.googleCalendarEventId, tokenOverride).catch(err => {
      console.warn('Failed to delete Google Calendar event:', err);
    }));
  }

  if (event.googleTaskId) {
    promises.push(deleteGoogleTask('@default', event.googleTaskId).catch(err => {
      console.warn('Failed to delete Google Task:', err);
    }));
  }

  await Promise.allSettled(promises);
}

/**
 * Toggles an event's completion in external services (Google Tasks & Google Calendar note) for accountability.
 */
export async function toggleInAppEventCompletionExternal(
  event: InAppCalendarEvent,
  completed: boolean,
  tokenOverride?: string
): Promise<void> {
  if (event.googleTaskId) {
    try {
      const taskList = await getOrCreateStudyTaskList();
      await toggleGoogleTaskStatus(taskList.id, event.googleTaskId, completed);
    } catch (err) {
      console.warn('Failed to toggle Google Task completion:', err);
    }
  }
}

/**
 * Option G: Adaptive Catch-Up & Incomplete Work Rollover.
 * Scans study plans for incomplete topics from past days (before today),
 * and intelligently rolls them forward into today and upcoming available days.
 * Preserves completed work and syllabus structure completely.
 */
export function rolloverIncompleteStudyPlanTopics(
  plans: StudyPlan[],
  targetDateStr?: string
): {
  rolledOverCount: number;
  updatedPlans: StudyPlan[];
  message: string;
} {
  const todayStr = targetDateStr || new Date().toISOString().split('T')[0];
  const incompletePastTopics: Array<{ planId: string; topic: StudyPlanTopic }> = [];

  // 1. Identify incomplete topics from dates before today
  plans.forEach(plan => {
    (plan.topics || []).forEach(t => {
      const topicDate = t.date || plan.date;
      if (topicDate && topicDate < todayStr && !t.completed) {
        incompletePastTopics.push({ planId: plan.id, topic: t });
      }
    });
  });

  if (incompletePastTopics.length === 0) {
    return {
      rolledOverCount: 0,
      updatedPlans: plans,
      message: 'You are completely caught up! No past incomplete topics found.'
    };
  }

  // 2. Map existing plans by date for easy lookup
  const plansByDate = new Map<string, StudyPlan>();
  plans.forEach(p => {
    if (p.date) plansByDate.set(p.date, p);
  });

  // Calculate upcoming target dates starting from today
  const targetDates: string[] = [];
  const base = new Date(todayStr);
  for (let d = 0; d < 7; d++) {
    const cur = new Date(base.getTime() + d * 24 * 60 * 60 * 1000);
    targetDates.push(cur.toISOString().split('T')[0]);
  }

  let dateIndex = 0;
  const newTopicsByDate = new Map<string, StudyPlanTopic[]>();

  // Remove the incomplete past topics from their old plans
  const pastPlanIds = new Set(incompletePastTopics.map(x => x.planId));
  const incompleteTopicIds = new Set(incompletePastTopics.map(x => x.topic.id));

  // Distribute incomplete topics across upcoming dates (max 2 catch-up topics per day)
  incompletePastTopics.forEach(({ topic }, idx) => {
    const assignedDate = targetDates[Math.min(targetDates.length - 1, Math.floor(idx / 2))];
    const updatedTopic: StudyPlanTopic = {
      ...topic,
      date: assignedDate,
      reason: topic.reason ? `[Catch-Up] ${topic.reason}` : '[Catch-Up Rollover Session]',
      startTime: undefined, // Let analyzer assign next optimal study slot
      endTime: undefined,
      deadline: undefined
    };

    if (!newTopicsByDate.has(assignedDate)) {
      newTopicsByDate.set(assignedDate, []);
    }
    newTopicsByDate.get(assignedDate)!.push(updatedTopic);
  });

  // 3. Rebuild updated plans
  const updatedPlans: StudyPlan[] = plans.map(p => {
    let topics = (p.topics || []).filter(t => !incompleteTopicIds.has(t.id));

    // If this plan is on one of our target dates, append the rolled over topics
    if (p.date && newTopicsByDate.has(p.date)) {
      topics = [...topics, ...newTopicsByDate.get(p.date)!];
      newTopicsByDate.delete(p.date);
    }

    return {
      ...p,
      topics,
      updatedAt: new Date().toISOString()
    };
  });

  // If any target dates didn't have existing study plans, create new catch-up study plans
  newTopicsByDate.forEach((catchUpTopics, dateStr) => {
    const newPlan: StudyPlan = {
      id: `plan-catchup-${dateStr}`,
      userId: plans[0]?.userId || 'default-user',
      title: `⚡ Catch-Up Study Session (${formatHumanDate(dateStr)})`,
      date: dateStr,
      topics: catchUpTopics,
      availableHours: Math.max(2, Math.ceil(catchUpTopics.reduce((acc, t) => acc + (t.estimatedMinutes || 45), 0) / 60)),
      reasoning: 'Adaptive rollover catch-up plan for pending topics.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    updatedPlans.push(newPlan);
  });

  // Re-run through analyzer to ensure clean, consistent start/end times
  const batchRes = batchAnalyzeStudyPlansIntoCalendar(updatedPlans);

  return {
    rolledOverCount: incompletePastTopics.length,
    updatedPlans: batchRes.updatedPlans,
    message: `✓ Successfully rolled over ${incompletePastTopics.length} pending topic(s) into your upcoming schedule without losing any progress!`
  };
}
