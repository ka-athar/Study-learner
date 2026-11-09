/**
 * Google Calendar Integration Service
 * Real-time synchronization with user's Google Calendar via Google Calendar API v3.
 */

import { getOrRequestWorkspaceToken, getCachedWorkspaceToken } from './googleAuthService';
import { StudyPlan, ExamDate, RevisionItem, TestResult, Assignment, InAppCalendarEvent } from '../types';
import { timeStringToMinutes, minutesTo24HourTime } from './inbuiltCalendarAnalyzer';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  htmlLink?: string;
  colorId?: string;
  location?: string;
}

/**
 * Finds or creates a dedicated secondary Google Calendar: "StudyFlow Academic Schedule" (Option A).
 * Keeps personal events 100% separate from study timetables.
 */
export async function getOrCreateAcademicCalendar(tokenOverride?: string): Promise<{ id: string; summary: string }> {
  const token = tokenOverride || await getOrRequestWorkspaceToken();
  try {
    const listRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (listRes.ok) {
      const data = await listRes.json();
      const existing = (data.items || []).find((c: any) => 
        c.summary === 'StudyFlow Academic Schedule' || c.summary === 'StudyFlow Schedule'
      );
      if (existing) {
        return { id: existing.id, summary: existing.summary };
      }
    }

    // Create the dedicated secondary calendar
    const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: 'StudyFlow Academic Schedule',
        description: 'Dedicated academic study schedule managed by StudyFlow. Can be toggled on/off without affecting personal calendar events.'
      })
    });
    if (createRes.ok) {
      const created = await createRes.json();
      return { id: created.id, summary: created.summary };
    }
  } catch (err) {
    console.warn('Could not create dedicated secondary calendar, falling back to primary:', err);
  }
  return { id: 'primary', summary: 'Primary Calendar' };
}

/**
 * Lists events from a Google Calendar for a date range.
 */
export async function listCalendarEvents(
  timeMin?: string,
  timeMax?: string,
  tokenOverride?: string,
  calendarId: string = 'primary'
): Promise<GoogleCalendarEvent[]> {
  const token = tokenOverride || getCachedWorkspaceToken();
  if (!token) {
    return [];
  }

  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  if (timeMin) params.append('timeMin', new Date(timeMin).toISOString());
  if (timeMax) params.append('timeMax', new Date(timeMax).toISOString());

  try {
    const encodedCalId = encodeURIComponent(calendarId);
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn(`Calendar fetch failed with status ${response.status}`, err);
      return [];
    }

    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || '(Untitled Event)',
      description: item.description || '',
      start: item.start || {},
      end: item.end || {},
      htmlLink: item.htmlLink,
      colorId: item.colorId,
      location: item.location
    }));
  } catch (error) {
    console.warn('Network error fetching calendar events:', error);
    return [];
  }
}

/**
 * Creates a single event on the user's primary Google Calendar.
 * Handles 12-hour and 24-hour time formats, and uses clean notification settings.
 */
export async function createCalendarEvent(
  event: {
    summary: string;
    description?: string;
    startDate: string; // YYYY-MM-DD
    startTime?: string; // HH:mm or 12h e.g. "6:00 PM"
    durationMinutes?: number;
    colorId?: string;
    createMeetLink?: boolean;
    reminders?: {
      useDefault?: boolean;
      overrides?: Array<{ method: 'popup' | 'email'; minutes: number }>;
    };
  },
  tokenOverride?: string,
  calendarId: string = 'primary'
): Promise<GoogleCalendarEvent> {
  const token = tokenOverride || await getOrRequestWorkspaceToken();

  let startBody: any;
  let endBody: any;

  if (event.startTime) {
    const startMins = timeStringToMinutes(event.startTime);
    const start24 = minutesTo24HourTime(startMins);
    const startDateTime = new Date(`${event.startDate}T${start24}:00`);
    const duration = Math.max(15, event.durationMinutes || 60);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

    startBody = { dateTime: startDateTime.toISOString() };
    endBody = { dateTime: endDateTime.toISOString() };
  } else {
    // All-day event
    const nextDay = new Date(event.startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    startBody = { date: event.startDate };
    endBody = { date: nextDayStr };
  }

  // Single gentle notification 10 minutes before start (avoids notification flooding)
  const defaultReminders = {
    useDefault: false,
    overrides: [
      { method: 'popup', minutes: 10 }
    ],
  };

  const payload: any = {
    summary: event.summary,
    description: event.description || 'Created by StudyFlow Study Planner [StudyFlow]',
    start: startBody,
    end: endBody,
    reminders: event.reminders || defaultReminders,
  };

  if (event.colorId) {
    payload.colorId = event.colorId;
  }

  // Automatic Google Meet Study Room Links
  if (event.createMeetLink) {
    payload.conferenceData = {
      createRequest: {
        requestId: `study-meet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        conferenceSolutionKey: {
          type: 'hangoutsMeet'
        }
      }
    };
  }

  const encodedCalId = encodeURIComponent(calendarId);
  const url = event.createMeetLink 
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events?conferenceDataVersion=1`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events`;

  const response = await fetch(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    // If conference creation failed (e.g. quota on Google Meet video links), automatically retry as standard event
    if (event.createMeetLink) {
      return createCalendarEvent({ ...event, createMeetLink: false }, token, calendarId);
    }
    throw new Error(err.error?.message || `Failed to create calendar event (${response.status})`);
  }

  return await response.json();
}

/**
 * Updates an existing event on the user's Google Calendar.
 */
export async function updateCalendarEvent(
  eventId: string,
  event: {
    summary: string;
    description?: string;
    startDate: string; // YYYY-MM-DD
    startTime?: string; // HH:mm or 12h
    durationMinutes?: number;
    colorId?: string;
    reminders?: {
      useDefault?: boolean;
      overrides?: Array<{ method: 'popup' | 'email'; minutes: number }>;
    };
  },
  tokenOverride?: string,
  calendarId: string = 'primary'
): Promise<GoogleCalendarEvent> {
  const token = tokenOverride || await getOrRequestWorkspaceToken();

  let startBody: any;
  let endBody: any;

  if (event.startTime) {
    const startMins = timeStringToMinutes(event.startTime);
    const start24 = minutesTo24HourTime(startMins);
    const startDateTime = new Date(`${event.startDate}T${start24}:00`);
    const duration = Math.max(15, event.durationMinutes || 60);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

    startBody = { dateTime: startDateTime.toISOString() };
    endBody = { dateTime: endDateTime.toISOString() };
  } else {
    const nextDay = new Date(event.startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    startBody = { date: event.startDate };
    endBody = { date: nextDayStr };
  }

  const defaultReminders = {
    useDefault: false,
    overrides: [
      { method: 'popup', minutes: 10 }
    ],
  };

  const payload: any = {
    summary: event.summary,
    description: event.description || 'Created by StudyFlow Study Planner [StudyFlow]',
    start: startBody,
    end: endBody,
    reminders: event.reminders || defaultReminders,
  };

  if (event.colorId) {
    payload.colorId = event.colorId;
  }

  const encodedCalId = encodeURIComponent(calendarId);
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to update calendar event (${response.status})`);
  }

  return await response.json();
}

/**
 * Synchronizes a finalized InAppCalendarEvent to Google Calendar.
 * If event already has a googleCalendarEventId, updates it in place.
 * If not, checks Google Calendar for an existing event with matching ID/summary to avoid duplicates.
 * Never creates duplicates!
 */
export async function syncInAppEventToGoogleCalendar(
  event: InAppCalendarEvent,
  tokenOverride?: string,
  reminderMinutes: number = 10,
  calendarId: string = 'primary'
): Promise<{ googleCalendarEventId: string; status: 'created' | 'updated' }> {
  const token = tokenOverride || await getOrRequestWorkspaceToken();

  const summary = `${event.subjectName}${event.chapterName ? ` — ${event.chapterName}` : ''} — ${event.topicName}`;
  const description = [
    `${event.subjectName}${event.chapterName ? ` — ${event.chapterName}` : ''} — ${event.topicName}`,
    `Scheduled: ${event.date} • ${event.startTime}–${event.endTime} (${event.durationMinutes} mins)`,
    `Deadline: ${event.deadline}`,
    `Priority: ${event.priority}`,
    event.reason ? `Goal: ${event.reason}` : null,
    `[StudyFlow-Event-Id:${event.id}]`,
    event.planId ? `[StudyFlow-Plan-Id:${event.planId}]` : null
  ].filter(Boolean).join('\n');

  const remindersConfig = reminderMinutes > 0
    ? { useDefault: false, overrides: [{ method: 'popup' as const, minutes: reminderMinutes }] }
    : reminderMinutes === 0
    ? { useDefault: false, overrides: [] }
    : { useDefault: true };

  const payload = {
    summary,
    description,
    startDate: event.date,
    startTime: event.startTime,
    durationMinutes: event.durationMinutes,
    colorId: event.priority === 'High' ? '11' : '9', // Flamingo (urgent red) or Blueberry (blue)
    reminders: remindersConfig
  };

  // 1. If Google Calendar event ID exists on event, update it directly
  if (event.googleCalendarEventId) {
    try {
      const updated = await updateCalendarEvent(event.googleCalendarEventId, payload, token, calendarId);
      return { googleCalendarEventId: updated.id, status: 'updated' };
    } catch (updateErr: any) {
      // If 404 (event was deleted from Google Calendar directly), check or recreate
      if (!updateErr?.message?.includes('404') && !updateErr?.message?.includes('Not Found')) {
        throw updateErr;
      }
    }
  }

  // 2. Query Google Calendar for existing event with this StudyFlow ID to prevent duplicates
  try {
    const existingEvents = await listCalendarEvents(
      `${event.date}T00:00:00Z`,
      `${event.date}T23:59:59Z`,
      token,
      calendarId
    );
    const matched = existingEvents.find(e => 
      (e.description && e.description.includes(`[StudyFlow-Event-Id:${event.id}]`)) ||
      (e.summary === summary && (e.start.dateTime?.startsWith(event.date) || e.start.date === event.date))
    );

    if (matched) {
      const updated = await updateCalendarEvent(matched.id, payload, token, calendarId);
      return { googleCalendarEventId: matched.id, status: 'updated' };
    }
  } catch (searchErr) {
    console.warn('Could not check existing calendar events for deduplication:', searchErr);
  }

  // 3. Otherwise create new event and return ID
  const created = await createCalendarEvent(payload, token, calendarId);
  return { googleCalendarEventId: created.id, status: 'created' };
}

/**
 * Scans Google Calendar in the given date range, detects duplicate StudyFlow events
 * (matching [StudyFlow-Event-Id:...] or duplicate summary + date/time), deletes the duplicates,
 * and preserves one canonical event.
 */
export async function cleanDuplicateGoogleCalendarEvents(
  startDate?: string,
  endDate?: string,
  tokenOverride?: string,
  calendarId: string = 'primary'
): Promise<{ checkedCount: number; removedDuplicatesCount: number; errors: string[] }> {
  const token = tokenOverride || await getOrRequestWorkspaceToken();
  const timeMin = startDate ? `${startDate}T00:00:00Z` : undefined;
  const timeMax = endDate ? `${endDate}T23:59:59Z` : undefined;

  const events = await listCalendarEvents(timeMin, timeMax, token, calendarId);
  const seenEventKeys = new Map<string, string>(); // key -> canonical eventId
  let removedCount = 0;
  const errors: string[] = [];

  for (const evt of events) {
    // Only manage StudyFlow events to avoid touching user's personal events
    const isStudyFlow = evt.description?.includes('[StudyFlow') || evt.summary.includes('[StudyFlow]');
    if (!isStudyFlow) continue;

    const startDateStr = (evt.start.dateTime || evt.start.date || '').substring(0, 10);
    const startTimeStr = evt.start.dateTime ? evt.start.dateTime.substring(11, 16) : '';

    // 1. Normalized Event ID (normalizes cal-evt-planId-tp-0 and cal-evt-planId-0)
    let idKey = '';
    const idMatch = evt.description?.match(/\[StudyFlow-Event-Id:([^\]]+)\]/);
    if (idMatch && idMatch[1]) {
      const normalizedId = idMatch[1].replace(/-tp-(\d+)/, '-$1').trim();
      idKey = `id:${normalizedId}`;
    }

    // 2. Normalized Semantic Key (strips emojis, tags, and compares clean subject/topic on date)
    const cleanSummary = (evt.summary || '')
      .replace(/[📖📚🔄📌🎯]/g, '')
      .replace(/\[StudyFlow\]/gi, '')
      .replace(/\s*—\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const semanticKey = `sem:${startDateStr}::${cleanSummary}`;
    const timeKey = startTimeStr ? `time:${startDateStr}T${startTimeStr}::${cleanSummary}` : '';

    const isDuplicate = 
      (idKey && seenEventKeys.has(idKey)) ||
      seenEventKeys.has(semanticKey) ||
      (timeKey && seenEventKeys.has(timeKey));

    if (isDuplicate) {
      // Duplicate found! Delete redundant copy
      try {
        await deleteCalendarEvent(evt.id, token, calendarId);
        removedCount++;
        await new Promise(r => setTimeout(r, 120)); // Polite rate limit
      } catch (delErr: any) {
        errors.push(`Failed to delete duplicate "${evt.summary}": ${delErr.message}`);
      }
    } else {
      if (idKey) seenEventKeys.set(idKey, evt.id);
      seenEventKeys.set(semanticKey, evt.id);
      if (timeKey) seenEventKeys.set(timeKey, evt.id);
    }
  }

  return {
    checkedCount: events.length,
    removedDuplicatesCount: removedCount,
    errors
  };
}

/**
 * Deletes an event from Google Calendar.
 */
export async function deleteCalendarEvent(
  eventId: string,
  tokenOverride?: string,
  calendarId: string = 'primary'
): Promise<boolean> {
  const token = tokenOverride || await getOrRequestWorkspaceToken();
  const encodedCalId = encodeURIComponent(calendarId);
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.ok;
}

/**
 * Batch sync study plans, exams, revisions, tests, and assignments to Google Calendar.
 * Supports auto-generating Google Meet study room links and color-coded time blocking.
 */
export async function syncStudyPlansToGoogleCalendar(
  items: {
    plans?: StudyPlan[];
    examDates?: ExamDate[];
    revisions?: RevisionItem[];
    testResults?: TestResult[];
    assignments?: Assignment[];
    autoCreateMeetLinks?: boolean;
    preferredStartTime?: string; // e.g. "09:00", "14:00", "17:00"
    scheduleEachTopicIndividually?: boolean;
    reminderSetting?: '10m' | '5m' | 'default' | 'none' | 'intensive';
  },
  onProgress?: (current: number, total: number, itemName: string) => void
): Promise<{ success: boolean; createdCount: number; updatedCount: number; errors: string[] }> {
  const token = await getOrRequestWorkspaceToken();
  const errors: string[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  const autoCreateMeet = items.autoCreateMeetLinks !== false;
  const defaultStartTime = items.preferredStartTime || '09:00';
  const schedulePerTopic = Boolean(items.scheduleEachTopicIndividually);
  const reminderMode = items.reminderSetting || '10m';

  // Build reminder payload based on user selection (defaults to 1 gentle 10m popup)
  const remindersPayload = reminderMode === 'none'
    ? { useDefault: false, overrides: [] }
    : reminderMode === 'default'
    ? { useDefault: true }
    : reminderMode === '5m'
    ? { useDefault: false, overrides: [{ method: 'popup' as const, minutes: 5 }] }
    : reminderMode === 'intensive'
    ? { useDefault: false, overrides: [{ method: 'popup' as const, minutes: 10 }, { method: 'popup' as const, minutes: 30 }] }
    : { useDefault: false, overrides: [{ method: 'popup' as const, minutes: 10 }] }; // '10m' default

  // Flatten items into event tasks
  const tasksToCreate: Array<{
    eventIdTag: string;
    summary: string;
    description: string;
    startDate: string;
    startTime?: string;
    durationMinutes?: number;
    colorId?: string;
    createMeetLink?: boolean;
  }> = [];

  // 1. Study Plans (Color: '9' Blueberry / Blue or '11' if urgent)
  (items.plans || []).forEach(plan => {
    if (plan.date) {
      if (schedulePerTopic && Array.isArray(plan.topics) && plan.topics.length > 0) {
        // Stagger each topic across the day so each topic triggers its own phone notification alarm
        const startSlots = ['09:00', '11:00', '14:00', '16:00', '18:30', '20:00'];
        plan.topics.forEach((t, tIdx) => {
          const slot = t.startTime || startSlots[tIdx % startSlots.length];
          const eventIdTag = t.calendarEventId || `cal-evt-${plan.id}-${t.id || `tp-${tIdx}`}`;
          tasksToCreate.push({
            eventIdTag: `[StudyFlow-Event-Id:${eventIdTag}]`,
            summary: `📖 [${t.subjectName}] ${t.topicName} [StudyFlow]`,
            description: `Chapter: ${t.chapterName || 'Core Curriculum'}\nEstimated Duration: ${t.estimatedMinutes || 45} mins\nPriority: ${t.priority || 'Medium'}\nReason: ${t.reason || 'Syllabus goal'}\n[StudyFlow-Event-Id:${eventIdTag}]\n[StudyFlow-Plan-Id:${plan.id}]`,
            startDate: plan.date,
            startTime: slot,
            durationMinutes: t.estimatedMinutes || 45,
            colorId: t.priority === 'High' ? '11' : '9',
            createMeetLink: autoCreateMeet
          });
        });
      } else {
        const topicSummaries = plan.topics?.map(t => `${t.subjectName}: ${t.topicName} (~${t.estimatedMinutes}m)`).join('\n• ') || '';
        const totalMinutes = plan.topics?.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0) || ((plan.availableHours || 2) * 60);

        tasksToCreate.push({
          eventIdTag: `[StudyFlow-Plan-Id:${plan.id}]`,
          summary: `📚 ${plan.title || 'Academic Study Session'} [StudyFlow]`,
          description: `Scheduled Topics:\n• ${topicSummaries}\n\nReasoning: ${plan.reasoning || 'Daily academic study goal.'}\n[StudyFlow-Plan-Id:${plan.id}]`,
          startDate: plan.date,
          startTime: defaultStartTime,
          durationMinutes: totalMinutes,
          colorId: '9', // Blueberry / Blue
          createMeetLink: autoCreateMeet
        });
      }
    }
  });

  // 2. Exam Dates (Color: '11' Flamingo / Urgent Red)
  (items.examDates || []).forEach(exam => {
    if (exam.date) {
      tasksToCreate.push({
        eventIdTag: `[StudyFlow-Exam-Id:${exam.id}]`,
        summary: `🎯 EXAM: ${exam.examName} (${exam.subjectName}) [StudyFlow]`,
        description: `Subject: ${exam.subjectName}\nExam: ${exam.examName}\nTarget date locked in StudyPlanner.\n[StudyFlow-Exam-Id:${exam.id}]`,
        startDate: exam.date,
        startTime: '09:00',
        durationMinutes: 180,
        colorId: '11' // Red / Urgent
      });
    }
  });

  // 3. Spaced Revisions (Color: '5' Banana / Warm Amber)
  (items.revisions || []).forEach(rev => {
    if (rev.dueDate && rev.status !== 'Completed') {
      const isWeak = rev.priority === 'High';
      tasksToCreate.push({
        eventIdTag: `[StudyFlow-Rev-Id:${rev.id}]`,
        summary: `🔄 Revision: ${rev.topicName} (${rev.subjectName}) [StudyFlow]`,
        description: `Subject: ${rev.subjectName}\nChapter: ${rev.chapterName}\nPriority: ${rev.priority}\nLast Studied: ${rev.lastStudied || 'N/A'}\nReason: ${rev.reason || 'Spaced Repetition Review'}\n[StudyFlow-Rev-Id:${rev.id}]`,
        startDate: rev.dueDate,
        startTime: defaultStartTime === '09:00' ? '16:00' : '10:30',
        durationMinutes: 45,
        colorId: isWeak ? '11' : '5', // Urgent Red if High priority, else Amber
        createMeetLink: autoCreateMeet
      });
    }
  });

  // 4. Test Results / Mock Tests (Color: '3' Grape / Purple)
  (items.testResults || []).forEach(test => {
    if (test.date) {
      const datePart = test.date.includes('T') ? test.date.split('T')[0] : test.date;
      tasksToCreate.push({
        eventIdTag: `[StudyFlow-Test-Id:${test.id}]`,
        summary: `📝 Test Assessment: ${test.testName || test.subjectName + ' Mock Test'} [StudyFlow]`,
        description: `Subject: ${test.subjectName || 'General Academic'}\nScore: ${test.score !== undefined ? `${test.score}` : 'Recorded'}\nTotal Questions/Marks: ${test.questionsCount || test.totalMarks || 'N/A'}\nNotes: ${test.notes || 'Saved in StudyPlanner Tests Vault'}\n[StudyFlow-Test-Id:${test.id}]`,
        startDate: datePart,
        durationMinutes: 60,
        colorId: '3' // Grape / Purple
      });
    }
  });

  // 5. Assignments & Deadlines (Color: '6' Tangerine / Orange)
  (items.assignments || []).forEach(asg => {
    if (asg.dueDate) {
      tasksToCreate.push({
        eventIdTag: `[StudyFlow-Asg-Id:${asg.id}]`,
        summary: `📌 Assignment: ${asg.title} (${asg.subjectName || 'Coursework'}) [StudyFlow]`,
        description: `Subject: ${asg.subjectName || 'Academic'}\nPriority: ${asg.priority || 'Medium'}\nStatus: ${asg.status || 'Pending'}\nDue Date: ${asg.dueDate}\n[StudyFlow-Asg-Id:${asg.id}]`,
        startDate: asg.dueDate,
        colorId: '6' // Tangerine / Orange
      });
    }
  });

  // Pre-fetch existing events from Google Calendar to prevent duplicates
  let existingEventsMap = new Map<string, string>(); // eventIdTag -> googleEventId
  try {
    const dates = tasksToCreate.map(t => t.startDate).sort();
    if (dates.length > 0) {
      const minDate = `${dates[0]}T00:00:00Z`;
      const maxDate = `${dates[dates.length - 1]}T23:59:59Z`;
      const gEvents = await listCalendarEvents(minDate, maxDate, token);
      gEvents.forEach(ge => {
        // Match by eventIdTag in description or by summary + date
        tasksToCreate.forEach(t => {
          if (ge.description?.includes(t.eventIdTag)) {
            existingEventsMap.set(t.eventIdTag, ge.id);
          } else if (ge.summary === t.summary && (ge.start.dateTime?.startsWith(t.startDate) || ge.start.date === t.startDate)) {
            existingEventsMap.set(t.eventIdTag, ge.id);
          }
        });
      });
    }
  } catch (err) {
    console.warn('Could not pre-fetch existing Google Calendar events for deduplication:', err);
  }

  const total = tasksToCreate.length;
  for (let i = 0; i < total; i++) {
    const t = tasksToCreate[i];
    if (onProgress) onProgress(i + 1, total, t.summary);

    const eventPayload = {
      summary: t.summary,
      description: t.description,
      startDate: t.startDate,
      startTime: t.startTime,
      durationMinutes: t.durationMinutes,
      colorId: t.colorId,
      createMeetLink: t.createMeetLink,
      reminders: remindersPayload
    };

    try {
      const existingGoogleId = existingEventsMap.get(t.eventIdTag);
      if (existingGoogleId) {
        // Update existing event instead of creating duplicate!
        await updateCalendarEvent(existingGoogleId, eventPayload, token);
        updatedCount++;
      } else {
        const created = await createCalendarEvent(eventPayload, token);
        existingEventsMap.set(t.eventIdTag, created.id);
        createdCount++;
      }
      // Polite rate-limiting between API requests
      await new Promise(r => setTimeout(r, 120));
    } catch (e: any) {
      errors.push(`Failed to sync "${t.summary}": ${e.message}`);
    }
  }

  return {
    success: errors.length === 0,
    createdCount,
    updatedCount,
    errors
  };
}

export interface CalendarRescheduleProposal {
  planId: string;
  planTitle: string;
  originalDate: string;
  calendarDate: string;
  calendarEventId: string;
  summary: string;
  topicName?: string;
  oldDate?: string;
  newDate?: string;
  oldTime?: string;
  newTime?: string;
}

export type CalendarRescheduleItem = CalendarRescheduleProposal;

/**
 * Two-Way Reschedule Sync:
 * Inspects Google Calendar events to detect if any StudyFlow study blocks were dragged or rescheduled
 * in Google Calendar on the student's phone or desktop.
 */
export async function detectCalendarReschedules(params: StudyPlan[] | {
  plans: StudyPlan[];
  timeMin?: string;
  timeMax?: string;
}): Promise<CalendarRescheduleProposal[]> {
  try {
    const plansList: StudyPlan[] = Array.isArray(params) ? params : (params.plans || []);
    const timeMinParam = Array.isArray(params) ? undefined : params.timeMin;
    const timeMaxParam = Array.isArray(params) ? undefined : params.timeMax;

    const now = new Date();
    const defaultMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const defaultMax = new Date(now.getFullYear(), now.getMonth() + 2, 28).toISOString();

    const events = await listCalendarEvents(
      timeMinParam || defaultMin,
      timeMaxParam || defaultMax
    );

    const proposals: CalendarRescheduleProposal[] = [];

    events.forEach(event => {
      const desc = event.description || '';
      const summary = event.summary || '';

      // Match event to plan ID either via tag in description or title
      const match = desc.match(/\[StudyFlow-Plan-Id:([^\]]+)\]/);
      let matchedPlan: StudyPlan | undefined;

      if (match && match[1]) {
        matchedPlan = plansList.find(p => p.id === match[1]);
      } else if (summary.includes('[StudyFlow]')) {
        const cleanTitle = summary.replace('[StudyFlow]', '').replace('📚', '').trim();
        matchedPlan = plansList.find(p => p.title.trim() === cleanTitle);
      }

      if (matchedPlan) {
        // Get event date
        let calDate = '';
        if (event.start?.date) {
          calDate = event.start.date;
        } else if (event.start?.dateTime) {
          calDate = event.start.dateTime.split('T')[0];
        }

        if (calDate && matchedPlan.date && calDate !== matchedPlan.date) {
          proposals.push({
            planId: matchedPlan.id,
            planTitle: matchedPlan.title,
            originalDate: matchedPlan.date,
            calendarDate: calDate,
            calendarEventId: event.id,
            summary: event.summary,
            topicName: matchedPlan.title,
            oldDate: matchedPlan.date,
            newDate: calDate
          });
        }
      }
    });

    return proposals;
  } catch (err) {
    console.warn('[GoogleCalendarService] detectCalendarReschedules failed:', err);
    return [];
  }
}

/**
 * Applies detected Google Calendar reschedules back to local StudyFlow study plans.
 * Supports both (proposals, plans) and (plans, proposals).
 */
export function applyCalendarReschedules(
  arg1: any,
  arg2: any
): StudyPlan[] {
  let plans: StudyPlan[] = [];
  let proposals: CalendarRescheduleProposal[] = [];

  if (Array.isArray(arg1) && arg1.length > 0 && ('planId' in arg1[0] || 'calendarEventId' in arg1[0])) {
    proposals = arg1 as CalendarRescheduleProposal[];
    plans = arg2 as StudyPlan[];
  } else if (Array.isArray(arg2) && arg2.length > 0 && ('planId' in arg2[0] || 'calendarEventId' in arg2[0])) {
    proposals = arg2 as CalendarRescheduleProposal[];
    plans = arg1 as StudyPlan[];
  } else {
    plans = (Array.isArray(arg1) ? arg1 : []) as StudyPlan[];
    proposals = (Array.isArray(arg2) ? arg2 : []) as CalendarRescheduleProposal[];
  }

  const map = new Map<string, string>();
  proposals.forEach(p => map.set(p.planId, p.calendarDate || p.newDate || ''));

  return plans.map(plan => {
    if (map.has(plan.id)) {
      return {
        ...plan,
        date: map.get(plan.id)!,
        updatedAt: new Date().toISOString()
      };
    }
    return plan;
  });
}

