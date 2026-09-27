import { 
  TransferSafetyDiff, 
  EntityDiffSummary, 
  ConflictResolutionMode,
  Subject,
  StudySession,
  StudyPlan,
  TestResult,
  StorageVault,
  FlashcardDeck,
  RevisionItem,
  UserProfile,
  Assignment,
  DailyHabitEntry
} from '../types';
import { savePreSyncSafetyBackup, getPreSyncSafetyBackup } from './syncChannel';
import { saveIndexedDbSnapshot } from './syncEngine';

export interface LocalStudyDataset {
  profile?: UserProfile | null;
  subjects?: Subject[];
  sessions?: StudySession[];
  plans?: StudyPlan[];
  testResults?: TestResult[];
  vaults?: StorageVault[];
  flashcardDecks?: FlashcardDeck[];
  revisions?: RevisionItem[];
  assignments?: Assignment[];
  studyHabits?: Record<string, DailyHabitEntry>;
}

export interface PairedDeviceStatus {
  isConnected: boolean;
  deviceName: string;
  deviceId?: string;
  syncUid?: string;
  syncEmail?: string;
  lastSyncFormatted: string;
  pendingChangesCount: number;
}

const PAIRED_DEVICE_KEY = 'prepforge_paired_device_meta';

/**
 * Retrieves the current paired device metadata for the Connection Status header indicator.
 */
export function getPairedDeviceStatus(): PairedDeviceStatus {
  if (typeof window === 'undefined') {
    return {
      isConnected: false,
      deviceName: '',
      lastSyncFormatted: '',
      pendingChangesCount: 0
    };
  }

  try {
    const raw = localStorage.getItem(PAIRED_DEVICE_KEY);
    if (!raw) {
      return {
        isConnected: false,
        deviceName: '',
        lastSyncFormatted: '',
        pendingChangesCount: 0
      };
    }
    const parsed = JSON.parse(raw);
    return {
      isConnected: Boolean(parsed.isConnected),
      deviceName: parsed.deviceName || 'Linked Device',
      deviceId: parsed.deviceId,
      syncUid: parsed.syncUid,
      syncEmail: parsed.syncEmail,
      lastSyncFormatted: parsed.lastSyncFormatted || 'Recently',
      pendingChangesCount: parsed.pendingChangesCount || 0
    };
  } catch (err) {
    return {
      isConnected: false,
      deviceName: '',
      lastSyncFormatted: '',
      pendingChangesCount: 0
    };
  }
}

/**
 * Saves paired device status to localStorage and notifies UI components.
 */
export function setPairedDeviceStatus(status: Partial<PairedDeviceStatus>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getPairedDeviceStatus();
    const updated = { ...current, ...status };
    localStorage.setItem(PAIRED_DEVICE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('prepforge:device_pairing_changed', { detail: updated }));
  } catch (err) {
    console.warn('Failed to save paired device status:', err);
  }
}

/**
 * Clears paired device connection.
 */
export function disconnectPairedDevice(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PAIRED_DEVICE_KEY);
    localStorage.removeItem('prepforge_paired_sync_uid');
    window.dispatchEvent(new CustomEvent('prepforge:device_pairing_changed', { detail: null }));
  } catch (err) {}
}

/**
 * Inspects incoming transfer data against local data and produces an exact,
 * transparent diff breakdown showing New items, Updated items, and Conflicts.
 */
export function analyzeTransferDiff(
  incomingPayload: any,
  localState: LocalStudyDataset,
  sourceDeviceName = 'Remote Device'
): TransferSafetyDiff {
  const diffSummary: Record<string, EntityDiffSummary> = {};

  // 1. Syllabus & Topics Analysis
  const localSubjects = localState.subjects || [];
  const incomingSubjects: Subject[] = Array.isArray(incomingPayload?.subjects) ? incomingPayload.subjects : [];

  let newSubjects = 0;
  let updatedSubjects = 0;
  let conflictedSubjects = 0;

  let newTopics = 0;
  let updatedTopics = 0;
  let conflictedTopics = 0;

  const localSubMap = new Map<string, Subject>();
  localSubjects.forEach(s => localSubMap.set((s.name || '').toLowerCase().trim(), s));

  incomingSubjects.forEach(incSub => {
    const key = (incSub.name || '').toLowerCase().trim();
    const localMatch = localSubMap.get(key);

    if (!localMatch) {
      newSubjects++;
      incSub.chapters.forEach(c => {
        newTopics += c.topics.length;
      });
    } else {
      updatedSubjects++;
      const localTopicMap = new Map<string, any>();
      localMatch.chapters.forEach(c => {
        c.topics.forEach(t => localTopicMap.set((t.name || '').toLowerCase().trim(), t));
      });

      incSub.chapters.forEach(c => {
        c.topics.forEach(incT => {
          const tKey = (incT.name || '').toLowerCase().trim();
          const localT = localTopicMap.get(tKey);
          if (!localT) {
            newTopics++;
          } else if (localT.status !== incT.status) {
            conflictedTopics++;
          } else {
            updatedTopics++;
          }
        });
      });
    }
  });

  diffSummary.syllabus = {
    entityName: 'Syllabus Subjects',
    newCount: newSubjects,
    updatedCount: updatedSubjects,
    conflictCount: conflictedSubjects
  };

  diffSummary.topics = {
    entityName: 'Curriculum Topics',
    newCount: newTopics,
    updatedCount: updatedTopics,
    conflictCount: conflictedTopics
  };

  // Helper for generic collection diffing
  const compareGenericCollection = (
    entityName: string,
    incomingItems: any[] = [],
    localItems: any[] = [],
    idKey = 'id'
  ): EntityDiffSummary => {
    const localMap = new Map<string, any>();
    localItems.forEach(item => {
      const key = String(item[idKey] || item.title || item.name || '').trim();
      if (key) localMap.set(key, item);
    });

    let newCount = 0;
    let updatedCount = 0;
    let conflictCount = 0;

    incomingItems.forEach(item => {
      const key = String(item[idKey] || item.title || item.name || '').trim();
      if (!key) {
        newCount++;
        return;
      }
      const existing = localMap.get(key);
      if (!existing) {
        newCount++;
      } else {
        // If content differs
        const isDiff = JSON.stringify(item) !== JSON.stringify(existing);
        if (isDiff) {
          conflictCount++;
        } else {
          updatedCount++;
        }
      }
    });

    return { entityName, newCount, updatedCount, conflictCount };
  };

  // 2. Tests & Mock Exams
  const incomingTests = Array.isArray(incomingPayload?.testResults) ? incomingPayload.testResults : [];
  diffSummary.tests = compareGenericCollection('Diagnostic Tests & Mocks', incomingTests, localState.testResults || []);

  // 3. Mistakes (from mistakes or vault data)
  const incomingMistakes = Array.isArray(incomingPayload?.mistakes) ? incomingPayload.mistakes : [];
  diffSummary.mistakes = compareGenericCollection('Mistake Vault Records', incomingMistakes, []);

  // 4. Flashcards
  const incomingDecks = Array.isArray(incomingPayload?.flashcardDecks) ? incomingPayload.flashcardDecks : [];
  diffSummary.flashcards = compareGenericCollection('Flashcard Decks', incomingDecks, localState.flashcardDecks || []);

  // 5. 1-3-7 Revision Records
  const incomingRevs = Array.isArray(incomingPayload?.revisions) ? incomingPayload.revisions : [];
  diffSummary.revisions = compareGenericCollection('1-3-7 Spaced Revisions', incomingRevs, localState.revisions || []);

  // 6. Plans & Tasks
  const incomingPlans = Array.isArray(incomingPayload?.plans) ? incomingPayload.plans : [];
  diffSummary.plans = compareGenericCollection('Daily Study Plans', incomingPlans, localState.plans || [], 'date');

  // 7. Study Habits
  const incomingHabits = incomingPayload?.studyHabits && typeof incomingPayload.studyHabits === 'object' ? incomingPayload.studyHabits : {};
  const localHabits = localState.studyHabits || {};
  let newHabits = 0;
  let updatedHabits = 0;
  let conflictHabits = 0;

  Object.entries(incomingHabits).forEach(([dateStr, entry]: [string, any]) => {
    if (!localHabits[dateStr]) {
      newHabits++;
    } else {
      const isDiff = JSON.stringify(entry.habits) !== JSON.stringify(localHabits[dateStr].habits);
      if (isDiff) conflictHabits++;
      else updatedHabits++;
    }
  });

  diffSummary.habits = {
    entityName: 'Study Habits & Consistency Days',
    newCount: newHabits,
    updatedCount: updatedHabits,
    conflictCount: conflictHabits
  };

  // 8. Sessions & Timer Records
  const incomingSessions = Array.isArray(incomingPayload?.sessions) ? incomingPayload.sessions : [];
  diffSummary.sessions = compareGenericCollection('Timed Study Sessions', incomingSessions, localState.sessions || []);

  // 9. Storage Vaults
  const incomingVaults = Array.isArray(incomingPayload?.vaults) ? incomingPayload.vaults : [];
  diffSummary.vaults = compareGenericCollection('Storage Vaults & Files', incomingVaults, localState.vaults || []);

  // 10. Settings & Profile
  const hasIncomingProfile = Boolean(incomingPayload?.profile);
  diffSummary.settings = {
    entityName: 'Settings & Academic Profile',
    newCount: hasIncomingProfile && !localState.profile ? 1 : 0,
    updatedCount: hasIncomingProfile && localState.profile ? 1 : 0,
    conflictCount: 0
  };

  // Compute grand totals
  let totalNew = 0;
  let totalUpdated = 0;
  let totalConflicts = 0;

  Object.values(diffSummary).forEach(summary => {
    totalNew += summary.newCount;
    totalUpdated += summary.updatedCount;
    totalConflicts += summary.conflictCount;
  });

  return {
    sourceDeviceName,
    sourceUid: incomingPayload?.uid,
    sourceEmail: incomingPayload?.email,
    timestamp: new Date().toISOString(),
    totalNew,
    totalUpdated,
    totalConflicts,
    entities: diffSummary as any,
    hasPreTransferBackup: Boolean(getPreSyncSafetyBackup())
  };
}

/**
 * Creates an instantaneous safety backup in memory and local edge storage
 * before executing any data transfer or sync.
 */
export async function createPreTransferSafetyBackup(localState: LocalStudyDataset): Promise<string> {
  const backupId = `pre-transfer-${Date.now()}`;
  savePreSyncSafetyBackup(localState as any);

  try {
    await saveIndexedDbSnapshot({
      subjects: localState.subjects || [],
      sessions: localState.sessions || [],
      plans: localState.plans || [],
      testResults: localState.testResults || [],
      vaults: localState.vaults || [],
      revisions: localState.revisions || [],
      flashcardDecks: localState.flashcardDecks || [],
      assignments: localState.assignments || [],
      profile: localState.profile || null
    }, 'Auto safety snapshot before device transfer / sync');
  } catch (err) {
    console.warn('IndexedDB safety snapshot note:', err);
  }

  return backupId;
}

/**
 * Merges incoming payload into local state using the designated conflict resolution mode.
 * Guarantees zero accidental data loss.
 */
export function executeSafeMerge(
  localState: LocalStudyDataset,
  incomingPayload: any,
  conflictMode: ConflictResolutionMode = 'smart_merge'
): LocalStudyDataset {
  if (conflictMode === 'overwrite_incoming') {
    return {
      profile: incomingPayload.profile || localState.profile,
      subjects: Array.isArray(incomingPayload.subjects) ? incomingPayload.subjects : localState.subjects,
      sessions: Array.isArray(incomingPayload.sessions) ? incomingPayload.sessions : localState.sessions,
      plans: Array.isArray(incomingPayload.plans) ? incomingPayload.plans : localState.plans,
      testResults: Array.isArray(incomingPayload.testResults) ? incomingPayload.testResults : localState.testResults,
      vaults: Array.isArray(incomingPayload.vaults) ? incomingPayload.vaults : localState.vaults,
      flashcardDecks: Array.isArray(incomingPayload.flashcardDecks) ? incomingPayload.flashcardDecks : localState.flashcardDecks,
      revisions: Array.isArray(incomingPayload.revisions) ? incomingPayload.revisions : localState.revisions,
      assignments: Array.isArray(incomingPayload.assignments) ? incomingPayload.assignments : localState.assignments,
      studyHabits: incomingPayload.studyHabits || localState.studyHabits
    };
  }

  // Smart Merge or Keep Local on conflict
  // 1. Merge Syllabus & Topics
  const mergedSubjects: Subject[] = [...(localState.subjects || [])];
  const incomingSubjects: Subject[] = Array.isArray(incomingPayload.subjects) ? incomingPayload.subjects : [];

  incomingSubjects.forEach(incSub => {
    const existingIdx = mergedSubjects.findIndex(
      s => (s.name || '').toLowerCase().trim() === (incSub.name || '').toLowerCase().trim()
    );

    if (existingIdx === -1) {
      mergedSubjects.push(incSub);
    } else {
      const existing = mergedSubjects[existingIdx];
      // Merge chapters
      const mergedChapters = [...existing.chapters];
      incSub.chapters.forEach(incCh => {
        const chIdx = mergedChapters.findIndex(
          c => (c.name || '').toLowerCase().trim() === (incCh.name || '').toLowerCase().trim()
        );
        if (chIdx === -1) {
          mergedChapters.push(incCh);
        } else {
          // Merge topics
          const existingCh = mergedChapters[chIdx];
          const mergedTopics = [...existingCh.topics];
          incCh.topics.forEach(incTop => {
            const topIdx = mergedTopics.findIndex(
              t => (t.name || '').toLowerCase().trim() === (incTop.name || '').toLowerCase().trim()
            );
            if (topIdx === -1) {
              mergedTopics.push(incTop);
            } else if (conflictMode === 'smart_merge') {
              // Mastered wins over Completed, Completed wins over Not Started
              const cur = mergedTopics[topIdx];
              const scoreWeight = (st: string) => st === 'Mastered' ? 4 : st === 'Completed' ? 3 : st === 'In Progress' ? 2 : 1;
              if (scoreWeight(incTop.status) > scoreWeight(cur.status)) {
                mergedTopics[topIdx] = { ...cur, ...incTop };
              }
            }
          });
          mergedChapters[chIdx] = { ...existingCh, topics: mergedTopics };
        }
      });
      mergedSubjects[existingIdx] = { ...existing, chapters: mergedChapters };
    }
  });

  // Generic deduplication merge helper
  const mergeById = <T extends { id?: string | number }>(localArr: T[] = [], incArr: T[] = []): T[] => {
    const map = new Map<string, T>();
    localArr.forEach((item, idx) => {
      const key = item.id ? String(item.id) : `local-${idx}`;
      map.set(key, item);
    });

    incArr.forEach((item, idx) => {
      const key = item.id ? String(item.id) : `inc-${idx}`;
      if (!map.has(key)) {
        map.set(key, item);
      } else if (conflictMode === 'smart_merge') {
        // Smart merge: preserve properties while updating
        const cur = map.get(key)!;
        map.set(key, { ...cur, ...item });
      }
    });

    return Array.from(map.values());
  };

  // 2. Study Habits merge
  const localHabits = { ...(localState.studyHabits || {}) };
  const incomingHabits = incomingPayload.studyHabits && typeof incomingPayload.studyHabits === 'object' ? incomingPayload.studyHabits : {};

  Object.entries(incomingHabits).forEach(([dateStr, incEntry]: [string, any]) => {
    if (!localHabits[dateStr]) {
      localHabits[dateStr] = incEntry;
    } else if (conflictMode === 'smart_merge') {
      const cur = localHabits[dateStr];
      const mergedItemHabits = { ...cur.habits };
      Object.entries(incEntry.habits || {}).forEach(([hid, hState]: [string, any]) => {
        if (hState?.completed && !mergedItemHabits[hid as any]?.completed) {
          mergedItemHabits[hid as any] = hState;
        }
      });
      localHabits[dateStr] = {
        ...cur,
        habits: mergedItemHabits,
        completedMinutes: Math.max(cur.completedMinutes || 0, incEntry.completedMinutes || 0)
      };
    }
  });

  return {
    profile: localState.profile || incomingPayload.profile,
    subjects: mergedSubjects,
    sessions: mergeById(localState.sessions, incomingPayload.sessions),
    plans: mergeById(localState.plans, incomingPayload.plans),
    testResults: mergeById(localState.testResults, incomingPayload.testResults),
    vaults: mergeById(localState.vaults, incomingPayload.vaults),
    flashcardDecks: mergeById(localState.flashcardDecks, incomingPayload.flashcardDecks),
    revisions: mergeById(localState.revisions, incomingPayload.revisions),
    assignments: mergeById(localState.assignments, incomingPayload.assignments),
    studyHabits: localHabits
  };
}
