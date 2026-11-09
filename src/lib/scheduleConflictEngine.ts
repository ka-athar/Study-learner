/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  StudyPlan, 
  StudyPlanTopic, 
  InAppCalendarEvent, 
  Assignment, 
  ExamDate, 
  RevisionItem, 
  UserProfile, 
  ScheduleConflict, 
  ScheduleDiagnosisSummary, 
  ScheduleRescheduleProposal,
  ScheduleConflictAffectedItem
} from '../types';
import { 
  timeStringToMinutes, 
  minutesTo12HourTime, 
  calculateConsistentEndTime,
  analyzeStudyTopicIntoCalendarEvent
} from './inbuiltCalendarAnalyzer';

interface TimeInterval {
  id: string;
  name: string;
  subject: string;
  type: 'plan_topic' | 'calendar_event' | 'assignment' | 'exam' | 'revision';
  startMin: number;
  endMin: number;
  durationMin: number;
  date: string;
  originalTopic?: StudyPlanTopic;
  planId?: string;
}

/**
 * Standard study time slots with 15-minute mental breaks
 */
const OPTIMAL_STUDY_WINDOWS = [
  { start: '5:00 PM', startMin: 17 * 60 },
  { start: '6:15 PM', startMin: 18 * 60 + 15 },
  { start: '7:30 PM', startMin: 19 * 60 + 30 },
  { start: '8:45 PM', startMin: 20 * 60 + 45 },
  { start: '9:00 AM', startMin: 9 * 60 },
  { start: '10:30 AM', startMin: 10 * 60 + 30 },
  { start: '2:00 PM', startMin: 14 * 60 },
  { start: '3:30 PM', startMin: 15 * 60 + 30 }
];

export function diagnoseScheduleConflicts(params: {
  plans: StudyPlan[];
  inAppEvents?: InAppCalendarEvent[];
  assignments?: Assignment[];
  examDates?: ExamDate[];
  revisions?: RevisionItem[];
  userProfile?: UserProfile | null;
  targetDate?: string; // Optional: evaluate specific day or next 14 days
  capacityHoursPerDay?: number;
}): ScheduleDiagnosisSummary {
  const {
    plans,
    inAppEvents = [],
    assignments = [],
    examDates = [],
    revisions = [],
    userProfile,
    targetDate,
    capacityHoursPerDay = 3.5
  } = params;

  const todayStr = new Date().toISOString().split('T')[0];
  const maxDailyMinutes = Math.round(capacityHoursPerDay * 60);

  const conflicts: ScheduleConflict[] = [];
  const proposals: ScheduleRescheduleProposal[] = [];
  const overloadedDaysSet = new Set<string>();
  let totalOverloadedMinutes = 0;

  // 1. Group items by date
  const itemsByDate = new Map<string, TimeInterval[]>();

  // Ingest Study Plans
  plans.forEach(plan => {
    const pDate = plan.date || todayStr;
    if (targetDate && pDate !== targetDate) return;

    (plan.topics || []).forEach((t, idx) => {
      const topicDate = t.date || pDate;
      const duration = t.estimatedMinutes || 45;
      
      let startMin = 18 * 60 + (idx * 60); // Default 6:00 PM staggered
      if (t.startTime) {
        startMin = timeStringToMinutes(t.startTime);
      }
      let endMin = startMin + duration;
      if (t.endTime) {
        endMin = timeStringToMinutes(t.endTime);
      }

      const item: TimeInterval = {
        id: t.id || `plan-t-${idx}`,
        name: t.topicName,
        subject: t.subjectName,
        type: 'plan_topic',
        startMin,
        endMin,
        durationMin: duration,
        date: topicDate,
        originalTopic: t,
        planId: plan.id
      };

      if (!itemsByDate.has(topicDate)) itemsByDate.set(topicDate, []);
      itemsByDate.get(topicDate)!.push(item);
    });
  });

  // Ingest In-App Events not linked to above plans
  const existingTopicIds = new Set(
    plans.flatMap(p => (p.topics || []).map(t => t.id))
  );

  inAppEvents.forEach(ev => {
    if (ev.planTopicId && existingTopicIds.has(ev.planTopicId)) return;
    if (targetDate && ev.date !== targetDate) return;

    const startMin = timeStringToMinutes(ev.startTime || '6:00 PM');
    const duration = ev.durationMinutes || 60;
    const endMin = timeStringToMinutes(ev.endTime || minutesTo12HourTime(startMin + duration));

    const item: TimeInterval = {
      id: ev.id,
      name: ev.topicName,
      subject: ev.subjectName,
      type: 'calendar_event',
      startMin,
      endMin,
      durationMin: duration,
      date: ev.date
    };

    if (!itemsByDate.has(ev.date)) itemsByDate.set(ev.date, []);
    itemsByDate.get(ev.date)!.push(item);
  });

  // Ingest assignments due
  assignments.forEach(a => {
    if (a.status === 'Completed' || a.status === 'Submitted' || !a.dueDate) return;
    if (targetDate && a.dueDate !== targetDate) return;

    // Default assignment block: 4:00 PM - 5:30 PM (90 mins)
    const item: TimeInterval = {
      id: a.id,
      name: `[Assignment] ${a.title}`,
      subject: a.subjectName || 'General',
      type: 'assignment',
      startMin: 16 * 60,
      endMin: 17 * 60 + 30,
      durationMin: 90,
      date: a.dueDate
    };

    if (!itemsByDate.has(a.dueDate)) itemsByDate.set(a.dueDate, []);
    itemsByDate.get(a.dueDate)!.push(item);
  });

  // 2. Scan each date for conflicts
  const allDates = Array.from(itemsByDate.keys()).sort();

  // Helper: map of available capacities for future rescheduling
  const dailyTotalMinutesMap = new Map<string, number>();
  allDates.forEach(d => {
    const totalMins = (itemsByDate.get(d) || []).reduce((acc, it) => acc + it.durationMin, 0);
    dailyTotalMinutesMap.set(d, totalMins);
  });

  allDates.forEach(dateStr => {
    const items = itemsByDate.get(dateStr) || [];
    const isPast = dateStr < todayStr;
    const isExamDay = examDates.some(e => e.date === dateStr);
    const dayExam = examDates.find(e => e.date === dateStr);

    // A. Check Past Incomplete Backlog
    if (isPast) {
      const incompletePastTopics = items.filter(it => 
        it.type === 'plan_topic' && !it.originalTopic?.completed
      );

      if (incompletePastTopics.length > 0) {
        conflicts.push({
          id: `conflict-past-${dateStr}`,
          type: 'overdue_uncompleted',
          severity: 'warning',
          date: dateStr,
          title: `Overdue Tasks (${incompletePastTopics.length}) from ${dateStr}`,
          description: `These planned sessions were not marked complete on ${dateStr} and need smart catch-up redistribution.`,
          affectedItems: incompletePastTopics.map(it => ({
            id: it.id,
            name: it.name,
            subject: it.subject,
            time: minutesTo12HourTime(it.startMin),
            duration: it.durationMin,
            date: dateStr,
            type: it.type
          })),
          suggestedResolution: 'Auto-reschedule these tasks into upcoming low-load study days.',
          autoResolvable: true
        });

        // Generate proposals to roll them forward
        incompletePastTopics.forEach(it => {
          if (it.originalTopic) {
            const proposal = findNextFeasibleSlot(
              it.originalTopic, 
              it.subject, 
              todayStr, 
              dailyTotalMinutesMap, 
              maxDailyMinutes
            );
            if (proposal) proposals.push(proposal);
          }
        });
      }
    }

    // B. Check Exam Day Overload
    if (isExamDay) {
      const nonExamMins = items
        .filter(it => it.type === 'plan_topic')
        .reduce((acc, it) => acc + it.durationMin, 0);

      if (nonExamMins > 60) {
        conflicts.push({
          id: `conflict-exam-${dateStr}`,
          type: 'exam_day_overload',
          severity: 'critical',
          date: dateStr,
          title: `Exam Day Clash: ${dayExam?.subjectName || 'Exam'} on ${dateStr}`,
          description: `Scheduled ${nonExamMins} minutes of regular topics on the same day as your official board exam. This risks cognitive exhaustion right before the test.`,
          affectedItems: items.map(it => ({
            id: it.id,
            name: it.name,
            subject: it.subject,
            time: minutesTo12HourTime(it.startMin),
            duration: it.durationMin,
            date: dateStr,
            type: it.type
          })),
          suggestedResolution: 'Move non-essential topics to post-exam recovery days and reserve this day for brief formula review only.',
          autoResolvable: true
        });

        // Reschedule regular topics away from exam day
        items.filter(it => it.type === 'plan_topic' && it.originalTopic).forEach(it => {
          const proposal = findNextFeasibleSlot(
            it.originalTopic!, 
            it.subject, 
            addDaysToDate(dateStr, 1), 
            dailyTotalMinutesMap, 
            maxDailyMinutes
          );
          if (proposal) {
            proposal.reason = `Relocated away from ${dayExam?.subjectName || 'Exam'} date to protect exam focus.`;
            proposals.push(proposal);
          }
        });
      }
    }

    // C. Check Daily Overcapacity
    const totalMinutes = items.reduce((acc, it) => acc + it.durationMin, 0);
    if (totalMinutes > maxDailyMinutes && !isPast) {
      overloadedDaysSet.add(dateStr);
      const excess = totalMinutes - maxDailyMinutes;
      totalOverloadedMinutes += excess;

      conflicts.push({
        id: `conflict-capacity-${dateStr}`,
        type: 'daily_overcapacity',
        severity: 'critical',
        date: dateStr,
        title: `Overloaded Day: ${Math.round(totalMinutes / 60 * 10) / 10}h scheduled (Limit: ${capacityHoursPerDay}h)`,
        description: `This date has ${totalMinutes}m of scheduled work, exceeding your recommended limit by ${excess}m. This leads to burnout and diminishing retention.`,
        affectedItems: items.map(it => ({
          id: it.id,
          name: it.name,
          subject: it.subject,
          time: minutesTo12HourTime(it.startMin),
          duration: it.durationMin,
          date: dateStr,
          type: it.type
        })),
        suggestedResolution: `Rebalance lowest-priority sessions (+${excess}m) to adjacent days with available capacity.`,
        autoResolvable: true
      });

      // Shift lower priority or trailing tasks to other days
      const planTopics = items.filter(it => it.type === 'plan_topic' && it.originalTopic && !it.originalTopic.completed);
      let cumulativeTrim = 0;
      for (let i = planTopics.length - 1; i >= 0 && cumulativeTrim < excess; i--) {
        const candidate = planTopics[i];
        if (candidate.originalTopic && !proposals.some(p => p.taskId === candidate.id)) {
          const proposal = findNextFeasibleSlot(
            candidate.originalTopic, 
            candidate.subject, 
            addDaysToDate(dateStr, 1), 
            dailyTotalMinutesMap, 
            maxDailyMinutes
          );
          if (proposal) {
            proposal.reason = `Redistributed to resolve ${excess}m overcapacity on ${dateStr}.`;
            proposals.push(proposal);
            cumulativeTrim += candidate.durationMin;
          }
        }
      }
    }

    // D. Check Direct Time Overlaps
    if (!isPast && items.length > 1) {
      const sorted = [...items].sort((a, b) => a.startMin - b.startMin);
      for (let i = 0; i < sorted.length - 1; i++) {
        const cur = sorted[i];
        const nxt = sorted[i + 1];

        // If next task starts before current task finishes -> OVERLAP!
        if (nxt.startMin < cur.endMin) {
          const overlapMinutes = cur.endMin - nxt.startMin;
          conflicts.push({
            id: `conflict-overlap-${dateStr}-${cur.id}-${nxt.id}`,
            type: 'time_overlap',
            severity: 'critical',
            date: dateStr,
            title: `Time Clash: "${cur.name}" & "${nxt.name}"`,
            description: `Both sessions overlap by ${overlapMinutes} minutes (${minutesTo12HourTime(nxt.startMin)} to ${minutesTo12HourTime(cur.endMin)}). A student cannot be in two sessions simultaneously!`,
            affectedItems: [
              {
                id: cur.id,
                name: cur.name,
                subject: cur.subject,
                time: `${minutesTo12HourTime(cur.startMin)} – ${minutesTo12HourTime(cur.endMin)}`,
                duration: cur.durationMin,
                date: dateStr,
                type: cur.type
              },
              {
                id: nxt.id,
                name: nxt.name,
                subject: nxt.subject,
                time: `${minutesTo12HourTime(nxt.startMin)} – ${minutesTo12HourTime(nxt.endMin)}`,
                duration: nxt.durationMin,
                date: dateStr,
                type: nxt.type
              }
            ],
            suggestedResolution: `Stagger second session by ${overlapMinutes + 15} minutes, including a 15-minute mental rest buffer.`,
            autoResolvable: true
          });

          // Propose shifting the subsequent item down by 15 min rest buffer
          if (nxt.type === 'plan_topic' && nxt.originalTopic && !proposals.some(p => p.taskId === nxt.id)) {
            const newStartMin = cur.endMin + 15; // 15m buffer
            const newEndMin = newStartMin + nxt.durationMin;
            proposals.push({
              taskId: nxt.id,
              taskName: nxt.name,
              subjectName: nxt.subject,
              originalDate: dateStr,
              originalStartTime: minutesTo12HourTime(nxt.startMin),
              originalEndTime: minutesTo12HourTime(nxt.endMin),
              proposedDate: dateStr,
              proposedStartTime: minutesTo12HourTime(newStartMin),
              proposedEndTime: minutesTo12HourTime(newEndMin),
              durationMinutes: nxt.durationMin,
              reason: `Shifted start time to eliminate ${overlapMinutes}m clash with "${cur.name}" and add 15m mental break.`,
              selected: true
            });
          }
        }
      }
    }
  });

  return {
    conflicts,
    criticalCount: conflicts.filter(c => c.severity === 'critical').length,
    warningCount: conflicts.filter(c => c.severity === 'warning').length,
    overloadedDays: Array.from(overloadedDaysSet),
    totalOverloadedMinutes,
    proposals
  };
}

/**
 * Helper to find the next available day with study capacity
 */
function findNextFeasibleSlot(
  topic: StudyPlanTopic,
  subject: string,
  startDateStr: string,
  dailyLoadMap: Map<string, number>,
  maxDailyMinutes: number
): ScheduleRescheduleProposal | null {
  const duration = topic.estimatedMinutes || 45;
  let candidateDate = startDateStr;

  for (let offset = 0; offset < 10; offset++) {
    const curDate = addDaysToDate(startDateStr, offset);
    const currentMins = dailyLoadMap.get(curDate) || 0;

    if (currentMins + duration <= maxDailyMinutes) {
      // Found open day!
      dailyLoadMap.set(curDate, currentMins + duration);

      // Pick clean staggered time slot
      const slotIndex = Math.min(
        OPTIMAL_STUDY_WINDOWS.length - 1,
        Math.floor(currentMins / 60)
      );
      const chosenWindow = OPTIMAL_STUDY_WINDOWS[slotIndex] || OPTIMAL_STUDY_WINDOWS[0];
      const startMin = chosenWindow.startMin;
      const endMin = startMin + duration;

      return {
        taskId: topic.id,
        taskName: topic.topicName,
        subjectName: subject,
        originalDate: topic.date || startDateStr,
        originalStartTime: topic.startTime,
        originalEndTime: topic.endTime,
        proposedDate: curDate,
        proposedStartTime: minutesTo12HourTime(startMin),
        proposedEndTime: minutesTo12HourTime(endMin),
        durationMinutes: duration,
        reason: `Rebalanced to ${curDate} (${minutesTo12HourTime(startMin)}–${minutesTo12HourTime(endMin)}) with open capacity.`,
        selected: true
      };
    }
  }

  // Fallback to tomorrow evening
  const fallbackDate = addDaysToDate(startDateStr, 1);
  return {
    taskId: topic.id,
    taskName: topic.topicName,
    subjectName: subject,
    originalDate: topic.date || startDateStr,
    originalStartTime: topic.startTime,
    originalEndTime: topic.endTime,
    proposedDate: fallbackDate,
    proposedStartTime: '7:00 PM',
    proposedEndTime: '7:45 PM',
    durationMinutes: duration,
    reason: `Shifted forward to next available study window.`,
    selected: true
  };
}

/**
 * Executes approved rescheduling proposals across StudyPlans.
 * Ensures two-way synchronization between StudyPlans and InAppCalendarEvents.
 */
export function applyAutoRescheduleProposals(
  plans: StudyPlan[],
  proposals: ScheduleRescheduleProposal[]
): {
  updatedPlans: StudyPlan[];
  appliedCount: number;
} {
  const selectedProposals = proposals.filter(p => p.selected);
  if (selectedProposals.length === 0) {
    return { updatedPlans: plans, appliedCount: 0 };
  }

  const proposalMap = new Map(selectedProposals.map(p => [p.taskId, p]));
  let appliedCount = 0;

  // Track tasks that move to a new date
  const tasksMovingToDate = new Map<string, StudyPlanTopic[]>();

  // 1. Update existing plans: adjust times, or remove topics that move to a new date
  const updatedPlans: StudyPlan[] = plans.map(plan => {
    const updatedTopics: StudyPlanTopic[] = [];

    (plan.topics || []).forEach(t => {
      const prop = proposalMap.get(t.id);
      if (!prop) {
        updatedTopics.push(t);
        return;
      }

      appliedCount++;
      const isMovingToDifferentDate = prop.proposedDate !== (plan.date || t.date);

      if (isMovingToDifferentDate) {
        // Collect to inject into target date's plan
        const movedTopic: StudyPlanTopic = {
          ...t,
          date: prop.proposedDate,
          startTime: prop.proposedStartTime,
          endTime: prop.proposedEndTime,
          deadline: prop.proposedEndTime,
          reason: `[Auto-Rebalanced] ${t.reason || prop.reason}`
        };
        if (!tasksMovingToDate.has(prop.proposedDate)) {
          tasksMovingToDate.set(prop.proposedDate, []);
        }
        tasksMovingToDate.get(prop.proposedDate)!.push(movedTopic);
      } else {
        // Updated in place on same day
        updatedTopics.push({
          ...t,
          startTime: prop.proposedStartTime,
          endTime: prop.proposedEndTime,
          deadline: prop.proposedEndTime,
          reason: `[Auto-Rebalanced] ${t.reason || prop.reason}`
        });
      }
    });

    return {
      ...plan,
      topics: updatedTopics,
      updatedAt: new Date().toISOString()
    };
  });

  // 2. Inject moved tasks into their destination date plans
  tasksMovingToDate.forEach((movedTopics, targetDate) => {
    const targetPlan = updatedPlans.find(p => p.date === targetDate);
    if (targetPlan) {
      targetPlan.topics = [...(targetPlan.topics || []), ...movedTopics];
    } else {
      // Create new clean study plan for that date
      const newPlan: StudyPlan = {
        id: `plan-auto-${targetDate}-${Date.now()}`,
        userId: plans[0]?.userId || 'student',
        title: `Rebalanced Study Plan (${targetDate})`,
        date: targetDate,
        topics: movedTopics,
        availableHours: Math.ceil(movedTopics.reduce((a, b) => a + (b.estimatedMinutes || 45), 0) / 60),
        reasoning: 'Auto-rescheduled and rebalanced by AI Study Engine to eliminate timetable conflicts.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      updatedPlans.push(newPlan);
    }
  });

  // 3. Regenerate calendarEvents on all affected plans for 100% calendar parity
  updatedPlans.forEach(plan => {
    plan.calendarEvents = (plan.topics || []).map((t, idx) => 
      analyzeStudyTopicIntoCalendarEvent(plan, t, idx)
    );
  });

  return {
    updatedPlans,
    appliedCount
  };
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
