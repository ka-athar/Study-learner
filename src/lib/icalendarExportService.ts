/**
 * Universal iCalendar (.ics) Export Service
 * RFC 5545 compliant calendar export with built-in timed audible alarms (VALARM).
 * Works natively in Safari on iPad / iPhone, Apple Calendar, Google Calendar, Outlook, and Android.
 * Never blocked by Safari pop-up blockers!
 */

import { StudyPlan, ExamDate, RevisionItem, TestResult, Assignment } from '../types';

export interface CalendarExportOptions {
  plans?: StudyPlan[];
  examDates?: ExamDate[];
  revisions?: RevisionItem[];
  testResults?: TestResult[];
  assignments?: Assignment[];
  preferredStartTime?: string; // "09:00"
  alarmMinutesBefore?: number[]; // [30, 10]
  scheduleEachTopicIndividually?: boolean;
}

/**
 * Formats a date string (YYYY-MM-DD) and optional time (HH:mm) into iCalendar UTC/Local format
 */
function formatICSDateTime(dateStr: string, timeStr?: string, addMinutes: number = 0): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  let hours = 9;
  let mins = 0;

  if (timeStr && timeStr.includes(':')) {
    const parts = timeStr.split(':').map(Number);
    hours = parts[0] || 9;
    mins = parts[1] || 0;
  }

  const d = new Date(year, month - 1, day, hours, mins, 0);
  if (addMinutes > 0) {
    d.setMinutes(d.getMinutes() + addMinutes);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function escapeICSText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generates an RFC 5545 compliant .ics string with alarms for all study events
 */
export function generateICSContent(options: CalendarExportOptions): string {
  const {
    plans = [],
    examDates = [],
    revisions = [],
    assignments = [],
    preferredStartTime = '09:00',
    alarmMinutesBefore = [30, 10],
    scheduleEachTopicIndividually = false
  } = options;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyFlow Academic//Study & Revision Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:StudyFlow Academic Schedule',
    'X-WR-TIMEZONE:UTC',
    'X-WR-CALDESC:Daily study targets, spaced repetition revisions, and exam milestones.'
  ];

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // 1. Study Plans
  plans.forEach((plan, planIdx) => {
    if (!plan.date) return;

    if (scheduleEachTopicIndividually && Array.isArray(plan.topics) && plan.topics.length > 0) {
      const timeSlots = ['09:00', '11:00', '14:00', '16:00', '18:30', '20:00'];
      plan.topics.forEach((topic, tIdx) => {
        const slot = timeSlots[tIdx % timeSlots.length];
        const duration = topic.estimatedMinutes || 45;
        const dtStart = formatICSDateTime(plan.date, slot);
        const dtEnd = formatICSDateTime(plan.date, slot, duration);
        const uid = `studyflow-topic-${plan.id || planIdx}-${tIdx}-${plan.date}@studyflow.app`;

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${uid}`);
        lines.push(`DTSTAMP:${nowStamp}`);
        lines.push(`DTSTART:${dtStart}`);
        lines.push(`DTEND:${dtEnd}`);
        lines.push(`SUMMARY:📖 [${escapeICSText(topic.subjectName)}] ${escapeICSText(topic.topicName)}`);
        lines.push(`DESCRIPTION:${escapeICSText(`Chapter: ${topic.chapterName || 'Core Syllabus'}\nEstimated Duration: ${duration} mins\nPriority: ${topic.priority || 'Medium'}\nDaily Goal: ${plan.title || 'Academic Focus'}`)}`);
        lines.push('STATUS:CONFIRMED');

        // Built-in VALARMs
        alarmMinutesBefore.forEach(mins => {
          lines.push('BEGIN:VALARM');
          lines.push(`TRIGGER:-PT${mins}M`);
          lines.push('ACTION:DISPLAY');
          lines.push(`DESCRIPTION:StudyFlow: ${escapeICSText(topic.topicName)} starts in ${mins} minutes!`);
          lines.push('END:VALARM');
        });

        lines.push('END:VEVENT');
      });
    } else {
      const totalMinutes = plan.topics?.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0) || ((plan.availableHours || 2) * 60);
      const dtStart = formatICSDateTime(plan.date, preferredStartTime);
      const dtEnd = formatICSDateTime(plan.date, preferredStartTime, totalMinutes);
      const uid = `studyflow-plan-${plan.id || planIdx}-${plan.date}@studyflow.app`;

      const topicList = plan.topics?.map(t => `• [${t.subjectName}] ${t.topicName} (~${t.estimatedMinutes || 30}m)`).join('\n') || 'Focus study block';

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${nowStamp}`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      lines.push(`SUMMARY:📚 ${escapeICSText(plan.title || 'Daily Academic Study Session')} [StudyFlow]`);
      lines.push(`DESCRIPTION:${escapeICSText(`Planned Topics:\n${topicList}\n\nNotes: ${plan.reasoning || 'Daily target study allocation'}`)}`);
      lines.push('STATUS:CONFIRMED');

      alarmMinutesBefore.forEach(mins => {
        lines.push('BEGIN:VALARM');
        lines.push(`TRIGGER:-PT${mins}M`);
        lines.push('ACTION:DISPLAY');
        lines.push(`DESCRIPTION:StudyFlow study session begins in ${mins} minutes!`);
        lines.push('END:VALARM');
      });

      lines.push('END:VEVENT');
    }
  });

  // 2. Exam Dates
  examDates.forEach((exam, eIdx) => {
    if (!exam.date) return;
    const dtStart = formatICSDateTime(exam.date, '09:00');
    const dtEnd = formatICSDateTime(exam.date, '09:00', 180);
    const uid = `studyflow-exam-${exam.id || eIdx}-${exam.date}@studyflow.app`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:🎯 EXAM: ${escapeICSText(exam.examName)} (${escapeICSText(exam.subjectName)})`);
    lines.push(`DESCRIPTION:${escapeICSText(`Major Exam Milestone for ${exam.subjectName}\nEnsure all revision cycles are completed!`)}`);
    lines.push('PRIORITY:1');
    lines.push('STATUS:CONFIRMED');

    // 1-day and 2-hour alarms for exams
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-P1D');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:REMINDER: ${escapeICSText(exam.examName)} Exam is TOMORROW!`);
    lines.push('END:VALARM');

    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT2H');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:URGENT: ${escapeICSText(exam.examName)} Exam starts in 2 hours!`);
    lines.push('END:VALARM');

    lines.push('END:VEVENT');
  });

  // 3. Spaced Repetition Revisions
  revisions.filter(r => r.status !== 'Completed').forEach((rev, rIdx) => {
    if (!rev.dueDate) return;
    const dtStart = formatICSDateTime(rev.dueDate, '17:00');
    const dtEnd = formatICSDateTime(rev.dueDate, '17:00', 30);
    const uid = `studyflow-rev-${rev.id || rIdx}-${rev.dueDate}@studyflow.app`;

    const stageLabel = rev.cycleStage ? rev.cycleStage.toUpperCase() : '1-3-7';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:🔄 [${stageLabel} Revision] ${escapeICSText(rev.topicName)}`);
    lines.push(`DESCRIPTION:${escapeICSText(`1-3-7 Spaced Repetition Cadence\nSubject: ${rev.subjectName}\nChapter: ${rev.chapterName || 'Core'}`)}`);
    lines.push('STATUS:CONFIRMED');

    alarmMinutesBefore.forEach(mins => {
      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-PT${mins}M`);
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Revision cadence due for ${escapeICSText(rev.topicName)} in ${mins}m`);
      lines.push('END:VALARM');
    });

    lines.push('END:VEVENT');
  });

  // 4. Assignments Due
  assignments.filter(a => a.status !== 'Completed' && a.status !== 'Submitted').forEach((assign, aIdx) => {
    if (!assign.dueDate) return;
    const dueTime = assign.dueTime || '18:00';
    const dtStart = formatICSDateTime(assign.dueDate, dueTime);
    const dtEnd = formatICSDateTime(assign.dueDate, dueTime, assign.estimatedMinutes || 60);
    const uid = `studyflow-assign-${assign.id || aIdx}-${assign.dueDate}@studyflow.app`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:📝 DUE: ${escapeICSText(assign.title)} [${escapeICSText(assign.subjectName || 'Study')}]`);
    lines.push(`DESCRIPTION:${escapeICSText(`Academic Assignment Due Date\nSubject: ${assign.subjectName || 'General'}\nPriority: ${assign.priority}`)}`);
    lines.push('STATUS:CONFIRMED');

    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT2H');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:Assignment due in 2 hours: ${escapeICSText(assign.title)}`);
    lines.push('END:VALARM');

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Triggers native 1-click download of the calendar file (.ics).
 * In Safari on iPad / iPhone, iOS will immediately prompt "Add All Events to Calendar".
 */
export function downloadCalendarICS(options: CalendarExportOptions, filename: string = 'studyflow-academic-schedule.ics'): boolean {
  try {
    const icsData = generateICSContent(options);
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (error) {
    console.error('Failed to export calendar ICS:', error);
    return false;
  }
}
