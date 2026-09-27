import { Subject, StudySession, RevisionItem, TestResult, Assignment, StudyPlan, TestPreparationTimeline, DayWorkloadDiagnostic, TestSloAudit } from '../types';
import { loadMistakes } from './mistakeVaultStorage';

export interface Spaced137TopicCard {
  id: string;
  revisionId?: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  sloName?: string;
  sloCode?: string;
  initialStudyDate: string; // YYYY-MM-DD
  daysSinceInitialStudy: number;
  currentStage: 'day1' | 'day3' | 'day7' | 'graduated' | 'overdue';
  dueDate: string; // YYYY-MM-DD
  dueStatus: 'due_today' | 'due_tomorrow' | 'upcoming' | 'overdue' | 'completed';
  daysOverdue?: number;
  isTransferredDate?: boolean;
  originalCadenceDate?: string;
  priority: 'High' | 'Medium' | 'Low';
  relatedTest?: {
    testTitle: string;
    testDate: string;
    daysUntilTest: number;
  };
  uncuredMistakesCount: number;
  lastStudiedSessionDuration?: number;
  revisionHistory: Array<{
    stage: 'day1' | 'day3' | 'day7';
    date: string;
    completed: boolean;
  }>;
}

export interface StudiedTopicOption {
  subjectName: string;
  chapterName: string;
  topicName: string;
  sloName?: string;
  sloCode?: string;
  firstStudiedDate: string;
  lastStudiedDate: string;
  totalTimeMinutes: number;
  sessionsCount: number;
  status: string;
  isAlreadyIn137: boolean;
  source: 'timer_session' | 'syllabus_record' | 'revision_history';
}

/**
 * Returns ONLY topics that have actually been studied or revised.
 * A topic is eligible only if there is a real record:
 * - A logged StudySession with duration > 0, OR
 * - A syllabus topic with timeSpentMinutes > 0 or lastStudiedAt set or status Completed/Mastered/Needs Revision, OR
 * - An existing revision item with time or completed revision.
 * Completely unstudied topics are strictly excluded.
 */
export function getStudiedTopicsList(
  subjects: Subject[],
  sessions: StudySession[],
  revisions: RevisionItem[]
): StudiedTopicOption[] {
  const result: StudiedTopicOption[] = [];
  const processedKeys = new Set<string>();

  // Set of topics already in 1-3-7
  const in137Set = new Set<string>();
  revisions.forEach(r => {
    if (r.cycleStage || r.initialStudyDate || (r.reason && r.reason.includes('1-3-7'))) {
      in137Set.add(`${r.subjectName.toLowerCase()}:::${r.topicName.toLowerCase()}`);
    }
  });

  // 1. From logged StudySessions
  sessions.forEach(sess => {
    if (!sess.topicName || !sess.subjectName) return;
    const key = `${sess.subjectName.toLowerCase()}:::${sess.topicName.toLowerCase()}`;
    const sessDate = toLocalDateString(sess.startTime || sess.date || new Date());

    if (!processedKeys.has(key)) {
      processedKeys.add(key);

      // Resolve chapter and SLO hierarchy
      const subj = subjects.find(s => s.name.toLowerCase() === sess.subjectName.toLowerCase());
      let chName = sess.chapterName || '';
      let sloName = sess.sloName;
      let sloCode = sess.sloCode;
      let topicStatus = 'Studied';

      if (subj) {
        for (const c of subj.chapters) {
          const t = c.topics.find(top => top.name.toLowerCase() === sess.topicName.toLowerCase());
          if (t) {
            chName = c.name;
            topicStatus = t.status;
            if (!sloName && t.subtopics && t.subtopics.length > 0) {
              sloName = t.subtopics[0].name;
              sloCode = t.subtopics[0].sloCode || 'SLO-1';
            }
            break;
          }
        }
      }

      // Calculate aggregated time across sessions
      const matched = sessions.filter(s => 
        s.subjectName.toLowerCase() === sess.subjectName.toLowerCase() &&
        s.topicName.toLowerCase() === sess.topicName.toLowerCase()
      );
      const totalMins = matched.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
      const dates = matched.map(s => toLocalDateString(s.startTime || s.date || new Date())).sort();

      result.push({
        subjectName: sess.subjectName,
        chapterName: chName,
        topicName: sess.topicName,
        sloName,
        sloCode,
        firstStudiedDate: dates[0] || sessDate,
        lastStudiedDate: dates[dates.length - 1] || sessDate,
        totalTimeMinutes: totalMins,
        sessionsCount: matched.length,
        status: topicStatus,
        isAlreadyIn137: in137Set.has(key),
        source: 'timer_session'
      });
    }
  });

  // 2. From Syllabus topics that have logged study time or completion status
  subjects.forEach(sub => {
    sub.chapters.forEach(ch => {
      ch.topics.forEach(top => {
        const key = `${sub.name.toLowerCase()}:::${top.name.toLowerCase()}`;
        if (!processedKeys.has(key)) {
          const hasTime = (top.timeSpentMinutes || 0) > 0;
          const hasLastStudied = !!top.lastStudiedAt;
          const isStudiedStatus = top.status === 'Completed' || top.status === 'Mastered' || top.status === 'Needs Revision' || top.status === 'In Progress';

          // Strictly filter out unstudied topics!
          if (hasTime || hasLastStudied || isStudiedStatus) {
            processedKeys.add(key);
            const firstDate = top.lastStudiedAt ? toLocalDateString(top.lastStudiedAt) : toLocalDateString(new Date());
            
            result.push({
              subjectName: sub.name,
              chapterName: ch.name,
              topicName: top.name,
              sloName: top.subtopics?.[0]?.name,
              sloCode: top.subtopics?.[0]?.sloCode,
              firstStudiedDate: firstDate,
              lastStudiedDate: firstDate,
              totalTimeMinutes: top.timeSpentMinutes || 30,
              sessionsCount: top.sessionsCount || 1,
              status: top.status,
              isAlreadyIn137: in137Set.has(key),
              source: 'syllabus_record'
            });
          }
        }
      });
    });
  });

  // 3. From revisions that have been studied/completed
  revisions.forEach(rev => {
    const key = `${rev.subjectName.toLowerCase()}:::${rev.topicName.toLowerCase()}`;
    if (!processedKeys.has(key)) {
      processedKeys.add(key);
      const studyDate = toLocalDateString(rev.initialStudyDate || rev.lastStudied || new Date());
      result.push({
        subjectName: rev.subjectName,
        chapterName: rev.chapterName || '',
        topicName: rev.topicName,
        sloName: rev.linkedSloNames?.[0],
        sloCode: rev.linkedSloIds?.[0],
        firstStudiedDate: studyDate,
        lastStudiedDate: studyDate,
        totalTimeMinutes: rev.totalTimeSpentMinutes || rev.timeSpentMinutes || 30,
        sessionsCount: rev.sessionsCount || 1,
        status: rev.status === 'Completed' ? 'Mastered' : 'Needs Revision',
        isAlreadyIn137: in137Set.has(key),
        source: 'revision_history'
      });
    }
  });

  return result.sort((a, b) => b.lastStudiedDate.localeCompare(a.lastStudiedDate));
}

/**
 * Normalizes any date string or Date object to YYYY-MM-DD in local time
 */
export function toLocalDateString(d: Date | string): string {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates Day 1, Day 3, and Day 7 milestones given a Day 0 study date
 */
export function calculate137Milestones(initialDateStr: string) {
  const base = new Date(initialDateStr);
  base.setHours(0, 0, 0, 0);

  const day1 = new Date(base);
  day1.setDate(base.getDate() + 1);

  const day3 = new Date(base);
  day3.setDate(base.getDate() + 3);

  const day7 = new Date(base);
  day7.setDate(base.getDate() + 7);

  return {
    day0: toLocalDateString(base),
    day1: toLocalDateString(day1),
    day3: toLocalDateString(day3),
    day7: toLocalDateString(day7)
  };
}

/**
 * Analyzes sessions, existing revisions, mistakes, and upcoming tests to compile the full 1-3-7 pipeline
 */
export function build137RevisionPipeline(
  subjects: Subject[],
  sessions: StudySession[],
  revisions: RevisionItem[],
  testResults: TestResult[] = [],
  assignments: Assignment[] = []
): Spaced137TopicCard[] {
  const todayStr = toLocalDateString(new Date());
  const todayDate = new Date(todayStr);
  const mistakeBank = loadMistakes();

  // Find upcoming tests from assignments and testResults
  const upcomingTests = assignments
    .filter(a => (a.type === 'Test' || a.type === 'Quiz' || a.title.toLowerCase().includes('exam') || a.title.toLowerCase().includes('test')) && a.dueDate >= todayStr)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Key: "Subject:::Topic"
  const topicMap = new Map<string, {
    subjectName: string;
    chapterName: string;
    topicName: string;
    sloName?: string;
    sloCode?: string;
    firstStudyDate: string;
    lastStudyDate: string;
    lastDuration: number;
    sessionsCount: number;
  }>();

  // 1. First, seed topicMap from explicitly tracked 1-3-7 RevisionItems to preserve their immutable Day 0 initialStudyDate
  revisions.forEach(rev => {
    const key = `${(rev.subjectName || '').toLowerCase()}:::${rev.topicName.toLowerCase()}`;
    const initialDate = rev.initialStudyDate || rev.lastStudied || todayStr;
    topicMap.set(key, {
      subjectName: rev.subjectName,
      chapterName: rev.chapterName || '',
      topicName: rev.topicName,
      firstStudyDate: toLocalDateString(initialDate),
      lastStudyDate: toLocalDateString(rev.lastStudied || initialDate),
      lastDuration: rev.lastSessionDurationMinutes || 45,
      sessionsCount: rev.sessionsCount || 1,
      sloName: rev.linkedSloNames?.[0],
      sloCode: rev.linkedSloIds?.[0]
    });
  });

  // 2. Discover additional topics from logged StudySessions without overwriting established initialStudyDate
  sessions.forEach(sess => {
    if (!sess.topicName) return;
    const key = `${(sess.subjectName || '').toLowerCase()}:::${sess.topicName.toLowerCase()}`;
    const sessDateStr = toLocalDateString(sess.startTime || sess.date || new Date());
    const existing = topicMap.get(key);

    if (!existing) {
      topicMap.set(key, {
        subjectName: sess.subjectName,
        chapterName: sess.chapterName || '',
        topicName: sess.topicName,
        sloName: sess.sloName,
        sloCode: sess.sloCode,
        firstStudyDate: sessDateStr,
        lastStudyDate: sessDateStr,
        lastDuration: sess.durationMinutes || 45,
        sessionsCount: 1
      });
    } else {
      // If no explicit initialStudyDate was fixed on existing revision, keep earliest date as firstStudyDate
      const matchedRev = revisions.find(r => `${(r.subjectName || '').toLowerCase()}:::${r.topicName.toLowerCase()}` === key);
      if (!matchedRev?.initialStudyDate && sessDateStr < existing.firstStudyDate) {
        existing.firstStudyDate = sessDateStr;
      }
      if (sessDateStr > existing.lastStudyDate) {
        existing.lastStudyDate = sessDateStr;
        existing.lastDuration = sess.durationMinutes || existing.lastDuration;
      }
      if (sess.sloName) existing.sloName = sess.sloName;
      if (sess.sloCode) existing.sloCode = sess.sloCode;
      existing.sessionsCount += 1;
    }
  });

  const cards: Spaced137TopicCard[] = [];

  topicMap.forEach((entry, _key) => {
    // Look up Subject -> Chapter -> Topic -> SLO hierarchy
    const subjObj = subjects.find(s => s.name.toLowerCase() === entry.subjectName.toLowerCase());
    let resolvedChapterName = entry.chapterName;
    let resolvedSloName: string | undefined;
    let resolvedSloCode: string | undefined;

    if (subjObj) {
      for (const ch of subjObj.chapters) {
        const topObj = ch.topics.find(t => t.name.toLowerCase() === entry.topicName.toLowerCase());
        if (topObj) {
          resolvedChapterName = ch.name;
          if (entry.sloName || entry.sloCode) {
            resolvedSloName = entry.sloName;
            resolvedSloCode = entry.sloCode;
          } else if (topObj.subtopics && topObj.subtopics.length > 0) {
            resolvedSloName = topObj.subtopics[0].name;
            resolvedSloCode = topObj.subtopics[0].sloCode || `SLO-1`;
          }
          break;
        }
      }
    }

    // Milestones from immutable Day 0 initial study date (Day 0: 0h, Day 1: +24h, Day 3: +72h, Day 7: +168h)
    const milestones = calculate137Milestones(entry.firstStudyDate);
    const day0Date = new Date(milestones.day0);
    const daysSinceInitial = Math.max(0, Math.floor((todayDate.getTime() - day0Date.getTime()) / (1000 * 60 * 60 * 24)));

    // Uncured mistakes for this topic
    const mistakesForTopic = mistakeBank.filter(m => 
      m.topicName?.toLowerCase() === entry.topicName.toLowerCase() && m.cureStatus !== 'cured'
    );

    // Associated upcoming test
    const relatedTest = upcomingTests.find(t => 
      ((t.subjectName || '').toLowerCase() === entry.subjectName.toLowerCase()) ||
      t.title.toLowerCase().includes(entry.subjectName.toLowerCase()) ||
      t.title.toLowerCase().includes(entry.topicName.toLowerCase())
    );

    let relatedTestInfo;
    if (relatedTest) {
      const testD = new Date(relatedTest.dueDate);
      const daysUntil = Math.max(0, Math.floor((testD.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)));
      relatedTestInfo = {
        testTitle: relatedTest.title,
        testDate: relatedTest.dueDate,
        daysUntilTest: daysUntil
      };
    }

    // Check revision record
    const existingRev = revisions.find(r => 
      r.subjectName.toLowerCase() === entry.subjectName.toLowerCase() &&
      r.topicName.toLowerCase() === entry.topicName.toLowerCase()
    );

    const completedStageSet = new Set<string>(existingRev?.completedStages || []);

    // Check study sessions logged on or after the respective milestone dates
    const topicSessions = sessions.filter(s =>
      s.subjectName.toLowerCase() === entry.subjectName.toLowerCase() &&
      s.topicName.toLowerCase() === entry.topicName.toLowerCase()
    );

    const hasDay1Session = topicSessions.some(s => {
      const d = toLocalDateString(s.startTime || s.date || '');
      return d >= milestones.day1 && d < milestones.day3;
    });

    const hasDay3Session = topicSessions.some(s => {
      const d = toLocalDateString(s.startTime || s.date || '');
      return d >= milestones.day3 && d < milestones.day7;
    });

    const hasDay7Session = topicSessions.some(s => {
      const d = toLocalDateString(s.startTime || s.date || '');
      return d >= milestones.day7;
    });

    const day1Done = completedStageSet.has('day1') || 
      existingRev?.cycleStage === 'day3' || 
      existingRev?.cycleStage === 'day7' || 
      hasDay1Session;

    const day3Done = completedStageSet.has('day3') || 
      existingRev?.cycleStage === 'day7' || 
      hasDay3Session;

    const day7Done = completedStageSet.has('day7') || 
      Boolean(existingRev?.isGraduated) ||
      (existingRev?.status === 'Completed' && (existingRev?.cycleStage === 'day7' || daysSinceInitial >= 7)) ||
      hasDay7Session;

    // Determine current 1-3-7 stage and target due date:
    let currentStage: 'day1' | 'day3' | 'day7' | 'graduated' | 'overdue' = 'day1';
    let targetDueDate = milestones.day1;

    if (day7Done || existingRev?.isGraduated || (daysSinceInitial >= 8 && day3Done)) {
      // Day 7 completed or graduated -> topic is Mastered & Completed
      currentStage = 'graduated';
      targetDueDate = milestones.day7;
    } else if (day3Done || (daysSinceInitial >= 3 && day1Done)) {
      currentStage = 'day7';
      targetDueDate = milestones.day7;
    } else if (day1Done || (daysSinceInitial >= 1)) {
      currentStage = 'day3';
      targetDueDate = milestones.day3;
    } else {
      currentStage = 'day1';
      targetDueDate = milestones.day1;
    }

    const isCompleted = currentStage === 'graduated';

    // Check if the user has explicitly transferred/rescheduled this topic's due date
    const originalMilestoneDue = targetDueDate;
    let isTransferredDate = false;
    if (existingRev?.dueDate && !isCompleted && existingRev.dueDate !== targetDueDate) {
      targetDueDate = existingRev.dueDate;
      isTransferredDate = true;
    }

    // Calculate due status
    let dueStatus: 'due_today' | 'due_tomorrow' | 'upcoming' | 'overdue' | 'completed' = 'upcoming';
    const targetDateObj = new Date(targetDueDate);
    const diffDaysFromTarget = Math.floor((targetDateObj.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    if (isCompleted) {
      dueStatus = 'completed';
    } else if (diffDaysFromTarget < 0) {
      dueStatus = 'overdue';
    } else if (diffDaysFromTarget === 0) {
      dueStatus = 'due_today';
    } else if (diffDaysFromTarget === 1) {
      dueStatus = 'due_tomorrow';
    } else {
      dueStatus = 'upcoming';
    }

    // Priority computation:
    // If test is within 5 days OR has uncured mistakes -> High Priority
    let priority: 'High' | 'Medium' | 'Low' = 'Medium';
    if (mistakesForTopic.length > 0 || (relatedTestInfo && relatedTestInfo.daysUntilTest <= 5) || dueStatus === 'overdue') {
      priority = 'High';
    } else if (daysSinceInitial > 14) {
      priority = 'Low';
    }

    cards.push({
      id: `137-${entry.subjectName}-${entry.topicName}`.replace(/\s+/g, '-').toLowerCase(),
      revisionId: existingRev?.id,
      subjectName: entry.subjectName,
      chapterName: resolvedChapterName,
      topicName: entry.topicName,
      sloName: resolvedSloName,
      sloCode: resolvedSloCode,
      initialStudyDate: milestones.day0,
      daysSinceInitialStudy: daysSinceInitial,
      currentStage,
      dueDate: targetDueDate,
      dueStatus,
      daysOverdue: diffDaysFromTarget < 0 ? Math.abs(diffDaysFromTarget) : undefined,
      isTransferredDate,
      originalCadenceDate: isTransferredDate ? originalMilestoneDue : undefined,
      priority,
      relatedTest: relatedTestInfo,
      uncuredMistakesCount: mistakesForTopic.length,
      lastStudiedSessionDuration: entry.lastDuration,
      revisionHistory: [
        { stage: 'day1', date: milestones.day1, completed: day1Done },
        { stage: 'day3', date: milestones.day3, completed: day3Done },
        { stage: 'day7', date: milestones.day7, completed: day7Done }
      ]
    });
  });

  // Sort: Overdue & Due Today first, then by priority High -> Medium -> Low
  return cards.sort((a, b) => {
    const statusOrder = { overdue: 0, due_today: 1, due_tomorrow: 2, upcoming: 3, completed: 4 };
    if (statusOrder[a.dueStatus] !== statusOrder[b.dueStatus]) {
      return statusOrder[a.dueStatus] - statusOrder[b.dueStatus];
    }
    const prioOrder = { High: 0, Medium: 1, Low: 2 };
    return prioOrder[a.priority] - prioOrder[b.priority];
  });
}

/**
 * Builds Test Preparation Timelines from Calendar events/assignments
 */
export function buildTestPreparationTimelines(
  subjects: Subject[],
  assignments: Assignment[],
  sessions: StudySession[],
  revisions: RevisionItem[]
): TestPreparationTimeline[] {
  const todayStr = toLocalDateString(new Date());
  const todayDate = new Date(todayStr);
  const mistakeBank = loadMistakes();

  const testAssignments = assignments.filter(a => 
    (a.type === 'Test' || a.type === 'Quiz' || a.title.toLowerCase().includes('exam') || a.title.toLowerCase().includes('test')) &&
    a.dueDate >= todayStr
  );

  return testAssignments.map(test => {
    const testDate = new Date(test.dueDate);
    const daysRemaining = Math.max(1, Math.floor((testDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Find matching subject
    const subject = subjects.find(s => 
      ((s.name || '').toLowerCase() === (test.subjectName || '').toLowerCase()) ||
      test.title.toLowerCase().includes((s.name || '').toLowerCase())
    ) || subjects[0];

    // Collect all topics and SLOs in this subject
    const includedTopics: string[] = [];
    const auditedSlos: TestSloAudit[] = [];

    if (subject) {
      subject.chapters.forEach(ch => {
        ch.topics.forEach(t => {
          includedTopics.push(t.name);
          const mistakesCount = mistakeBank.filter(m => m.topicName.toLowerCase() === t.name.toLowerCase() && m.cureStatus !== 'cured').length;
          const has137 = revisions.some(r => r.topicName.toLowerCase() === t.name.toLowerCase());

          if (t.subtopics && t.subtopics.length > 0) {
            t.subtopics.forEach(st => {
              auditedSlos.push({
                sloId: st.id,
                sloName: st.name,
                topicName: t.name,
                chapterName: ch.name,
                subjectName: subject.name,
                masteryStatus: t.status,
                hasUncuredMistakes: mistakesCount > 0,
                mistakesCount,
                daysSinceLastRevision: 4,
                isCoveredIn137: has137,
                revisionUrgency: mistakesCount > 0 ? 'immediate' : has137 ? 'scheduled' : 'mastered'
              });
            });
          } else {
            auditedSlos.push({
              sloId: `slo-${t.id}`,
              sloName: t.name,
              topicName: t.name,
              chapterName: ch.name,
              subjectName: subject.name,
              masteryStatus: t.status,
              hasUncuredMistakes: mistakesCount > 0,
              mistakesCount,
              daysSinceLastRevision: 3,
              isCoveredIn137: has137,
              revisionUrgency: mistakesCount > 0 ? 'immediate' : 'scheduled'
            });
          }
        });
      });
    }

    const prepStatus: 'on_track' | 'needs_attention' | 'critical_rush' = 
      daysRemaining <= 2 ? 'critical_rush' : daysRemaining <= 6 ? 'needs_attention' : 'on_track';

    const slosPerDay = Math.ceil(Math.max(1, auditedSlos.length / daysRemaining));
    const mistakeDrillsPerDay = Math.ceil(Math.max(1, auditedSlos.filter(s => s.hasUncuredMistakes).length / daysRemaining));

    return {
      testId: test.id,
      testTitle: test.title,
      subjectName: subject?.name || test.subjectName || 'General',
      testDate: test.dueDate,
      daysRemaining,
      estimatedWeightMarks: (test as any).totalMarks || 100,
      includedTopics: includedTopics.slice(0, 10),
      auditedSlos: auditedSlos.slice(0, 12),
      preparationStatus: prepStatus,
      dailyTargetQuota: {
        recommendedHoursPerDay: daysRemaining <= 2 ? 3.5 : 2.0,
        slosPerDay,
        mistakeDrillsPerDay
      },
      preparationPhases: [
        {
          phaseName: 'Foundation & Coverage',
          dateRange: `T-${daysRemaining} to T-${Math.max(1, Math.round(daysRemaining * 0.6))}`,
          actionableTasks: [
            `Audit core syllabus definitions and SLO formulas`,
            `Complete initial study sessions for unstarted topics (${includedTopics.slice(0, 2).join(', ')})`
          ],
          isCurrentPhase: daysRemaining > 4
        },
        {
          phaseName: 'Targeted 1-3-7 Deep Revision',
          dateRange: `T-${Math.max(2, Math.round(daysRemaining * 0.6))} to T-3`,
          actionableTasks: [
            `Clear all pending Day 1, 3, and 7 spaced revision intervals`,
            `Review flagged traps in Mistake Vault for ${subject?.name}`
          ],
          isCurrentPhase: daysRemaining <= 4 && daysRemaining > 2
        },
        {
          phaseName: 'Mistake Autopsy & Mock Papers',
          dateRange: `T-2 to T-1`,
          actionableTasks: [
            `Attempt 1 full timed mock paper under exam conditions`,
            `Spot-the-blunder marking & verify high-frequency mark schemes`
          ],
          isCurrentPhase: daysRemaining <= 2 && daysRemaining > 1
        },
        {
          phaseName: 'Pre-Exam High-Yield Sprint',
          dateRange: `Exam Eve (T-0)`,
          actionableTasks: [
            `1-Page AI Cheat Sheet glance over formulas & units`,
            `Light 10-minute Feynman oral recall & rest`
          ],
          isCurrentPhase: daysRemaining <= 1
        }
      ]
    };
  });
}

/**
 * Calculates Multi-Month Workload across days
 */
export function calculateMultiMonthWorkload(
  plans: StudyPlan[],
  revisions: RevisionItem[],
  assignments: Assignment[],
  daysAhead: number = 30
): DayWorkloadDiagnostic[] {
  const result: DayWorkloadDiagnostic[] = [];
  const today = new Date();

  for (let i = 0; i < daysAhead; i++) {
    const curDate = new Date(today);
    curDate.setDate(today.getDate() + i);
    const dateStr = toLocalDateString(curDate);

    // Plans for this day
    const dayPlans = plans.filter(p => p.date === dateStr);
    let plannedTasksCount = 0;
    let totalCommitmentHours = 0;

    dayPlans.forEach(p => {
      plannedTasksCount += p.topics.length;
      p.topics.forEach(t => {
        totalCommitmentHours += (t.estimatedMinutes || (t as any).durationMinutes || 45) / 60;
      });
    });

    // 1-3-7 Revisions due on this day
    const dayRevs = revisions.filter(r => r.dueDate === dateStr && r.status !== 'Completed');
    const revisionsDue137Count = dayRevs.length;
    totalCommitmentHours += revisionsDue137Count * 0.5; // estimated 30 mins per revision drill

    // Tests on this day
    const dayTests = assignments.filter(a => a.dueDate === dateStr && (a.type === 'Test' || a.type === 'Quiz' || a.title.toLowerCase().includes('test')));
    const isTestDay = dayTests.length > 0;
    if (isTestDay) totalCommitmentHours += 2.0;

    // Detect conflicts and pressure level
    const conflicts: string[] = [];
    if (isTestDay && revisionsDue137Count > 2) {
      conflicts.push(`Test scheduled on same day as ${revisionsDue137Count} spaced revisions.`);
    }
    if (totalCommitmentHours > 5.5) {
      conflicts.push(`Overload warning: ${totalCommitmentHours.toFixed(1)} hours scheduled exceeds safe daily ceiling.`);
    }

    let pressureLevel: 'optimal' | 'moderate' | 'overloaded' | 'burnout_risk' = 'optimal';
    if (totalCommitmentHours > 6.0) pressureLevel = 'burnout_risk';
    else if (totalCommitmentHours > 4.5 || (isTestDay && plannedTasksCount > 3)) pressureLevel = 'overloaded';
    else if (totalCommitmentHours > 2.5 || isTestDay) pressureLevel = 'moderate';

    result.push({
      date: dateStr,
      totalCommitmentHours: Number(totalCommitmentHours.toFixed(1)),
      plannedTasksCount,
      revisionsDue137Count,
      isTestDay,
      testNames: dayTests.map(t => t.title),
      pressureLevel,
      conflicts
    });
  }

  return result;
}
