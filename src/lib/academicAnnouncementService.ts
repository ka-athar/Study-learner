/**
 * Academic Announcement & Notice Board Service (Option 9)
 * 
 * Manages institutional notices, board exam alerts, daily study directives,
 * teacher updates (via Google Classroom), and personal academic milestones.
 * Designed with soothing eye-comfort principles and persistent storage.
 */

export type AnnouncementCategory = 
  | 'exam'        // Board dates, mock exams, paper schedules
  | 'syllabus'    // Curriculum milestones, topic coverage notices
  | 'revision'    // 1-3-7 cadence alerts, retention warnings
  | 'teacher'     // Google Classroom notices, mentor remarks
  | 'study_habit' // Daily focus directives, streak notices
  | 'urgent';     // High priority academic deadlines

export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export interface AcademicAnnouncement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  date: string; // ISO date YYYY-MM-DD
  time?: string;
  author: string; // e.g., "Board Controller", "Academic Mentor", "Classroom Stream", "Self"
  pinned: boolean;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  relatedSubjectId?: string;
  source: 'system' | 'google_classroom' | 'mentor' | 'custom';
}

const STORAGE_KEY = 'studyos_academic_announcements_v1';

// Seed default academic notices with eye-comfort, high-utility academic directives
const DEFAULT_ANNOUNCEMENTS: AcademicAnnouncement[] = [
  {
    id: 'ann-fbise-2025-01',
    title: '📢 Annual Examination & Board Schedule Reminder',
    content: 'Final board examinations approach in Q2. Review prioritized high-weightage chapters in Physics & Mathematics. Ensure all 1-3-7 spaced revisions are cleared weekly.',
    category: 'exam',
    priority: 'urgent',
    date: new Date().toISOString().split('T')[0],
    author: 'Board Examination Advisory',
    pinned: true,
    read: false,
    actionLabel: 'View Exam Readiness',
    source: 'system'
  },
  {
    id: 'ann-137-cadence-02',
    title: '🧠 1-3-7 Memory Preservation Directive',
    content: 'Topics covered today enter your Day-1 revision cycle tomorrow morning. Active recall at 24h prevents up to 70% forgetting curve decay. Check your Revision Center.',
    category: 'revision',
    priority: 'important',
    date: new Date().toISOString().split('T')[0],
    author: 'Cognitive Science Engine',
    pinned: true,
    read: false,
    actionLabel: 'Open 1-3-7 Cycle',
    source: 'system'
  },
  {
    id: 'ann-distraction-free-03',
    title: '🖨️ Distraction-Free Study Protocol (A4 Docket)',
    content: 'When studying complex formulas, keep mobile devices in another room. Generate and print your Distraction-Free A4 Study Docket for a 90-minute phone-free deep sprint.',
    category: 'study_habit',
    priority: 'normal',
    date: new Date().toISOString().split('T')[0],
    author: 'Senior Study Council',
    pinned: false,
    read: false,
    actionLabel: 'Print A4 Docket',
    source: 'system'
  },
  {
    id: 'ann-senior-locker-04',
    title: '🏛️ Senior Resource Locker is Active',
    content: 'Senior topper notes, past exam trap breakdowns, and formula cheat sheets have been indexed in your Locker. Bookmark high-yield references for active review.',
    category: 'syllabus',
    priority: 'normal',
    date: new Date().toISOString().split('T')[0],
    author: 'Senior Peer Mentors',
    pinned: false,
    read: false,
    actionLabel: 'Open Senior Locker',
    source: 'system'
  }
];

export function loadAcademicAnnouncements(): AcademicAnnouncement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveAcademicAnnouncements(DEFAULT_ANNOUNCEMENTS);
      return DEFAULT_ANNOUNCEMENTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_ANNOUNCEMENTS;
  } catch (e) {
    console.warn('Failed to load academic announcements:', e);
    return DEFAULT_ANNOUNCEMENTS;
  }
}

export function saveAcademicAnnouncements(announcements: AcademicAnnouncement[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(announcements));
    notifyListeners(announcements);
  } catch (e) {
    console.warn('Failed to save academic announcements:', e);
  }
}

export function addAcademicAnnouncement(ann: Omit<AcademicAnnouncement, 'id' | 'date'> & { date?: string }): AcademicAnnouncement {
  const all = loadAcademicAnnouncements();
  const newAnn: AcademicAnnouncement = {
    ...ann,
    id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    date: ann.date || new Date().toISOString().split('T')[0]
  };
  const updated = [newAnn, ...all];
  saveAcademicAnnouncements(updated);
  return newAnn;
}

export function togglePinAnnouncement(id: string): void {
  const all = loadAcademicAnnouncements();
  const updated = all.map(a => a.id === id ? { ...a, pinned: !a.pinned } : a);
  saveAcademicAnnouncements(updated);
}

export function markAnnouncementRead(id: string): void {
  const all = loadAcademicAnnouncements();
  const updated = all.map(a => a.id === id ? { ...a, read: true } : a);
  saveAcademicAnnouncements(updated);
}

export function markAllAnnouncementsRead(): void {
  const all = loadAcademicAnnouncements();
  const updated = all.map(a => ({ ...a, read: true }));
  saveAcademicAnnouncements(updated);
}

export function deleteAcademicAnnouncement(id: string): void {
  const all = loadAcademicAnnouncements();
  const updated = all.filter(a => a.id !== id);
  saveAcademicAnnouncements(updated);
}

// Import announcements from Google Classroom stream if user is signed in
export function importGoogleClassroomAnnouncements(classroomAnnouncements: Array<{
  id: string;
  text: string;
  courseTitle?: string;
  creationTime?: string;
  authorName?: string;
}>): number {
  if (!classroomAnnouncements || classroomAnnouncements.length === 0) return 0;
  
  const existing = loadAcademicAnnouncements();
  let importedCount = 0;
  
  const newItems: AcademicAnnouncement[] = [];

  for (const cAnn of classroomAnnouncements) {
    const existingIndex = existing.findIndex(e => e.id === `gc-${cAnn.id}`);
    if (existingIndex === -1 && cAnn.text) {
      const datePart = cAnn.creationTime ? cAnn.creationTime.split('T')[0] : new Date().toISOString().split('T')[0];
      const titleSnippet = cAnn.text.slice(0, 60).replace(/\n/g, ' ') + (cAnn.text.length > 60 ? '...' : '');
      
      newItems.push({
        id: `gc-${cAnn.id}`,
        title: `🏫 ${cAnn.courseTitle ? `[${cAnn.courseTitle}] ` : ''}${titleSnippet}`,
        content: cAnn.text,
        category: 'teacher',
        priority: 'important',
        date: datePart,
        author: cAnn.authorName || (cAnn.courseTitle ? `${cAnn.courseTitle} Teacher` : 'Classroom Teacher'),
        pinned: false,
        read: false,
        source: 'google_classroom'
      });
      importedCount++;
    }
  }

  if (importedCount > 0) {
    saveAcademicAnnouncements([...newItems, ...existing]);
  }

  return importedCount;
}

// Subscription listener pattern for real-time reactivity
type Listener = (announcements: AcademicAnnouncement[]) => void;
const listeners: Set<Listener> = new Set();

function notifyListeners(announcements: AcademicAnnouncement[]) {
  listeners.forEach(fn => {
    try {
      fn(announcements);
    } catch (e) {
      console.warn('Listener error in announcement service:', e);
    }
  });
}

export function subscribeAcademicAnnouncements(listener: Listener): () => void {
  listeners.add(listener);
  listener(loadAcademicAnnouncements());
  return () => {
    listeners.delete(listener);
  };
}
