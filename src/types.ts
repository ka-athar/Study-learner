export type TopicStatus = 
  | 'Not Started' 
  | 'In Progress' 
  | 'Completed' 
  | 'Needs Revision' 
  | 'Weak' 
  | 'Mastered';

export type TopicProgressionState = 
  | 'Studied' 
  | 'Practiced' 
  | 'Tested' 
  | 'Verified' 
  | 'Mastered';

export interface TopicMasteryVerification {
  verifiedAt: string;
  scorePercentage: number;
  passed: boolean;
  totalQuestions: number;
  correctQuestions: number;
  preventedMasteryReasons?: string[];
  recommendedAction?: string;
  assessedSections?: {
    recallPassed: boolean;
    conceptualPassed: boolean;
    applicationPassed: boolean;
    examStylePassed: boolean;
  };
}

export interface Subtopic {
  id: string;
  name: string;
  completed: boolean;
  sloCode?: string; // e.g. "SLO-1.1.2", "LO-3"
  description?: string;
  masteryLevel?: TopicStatus;
  lastRevisedAt?: string;
}

export interface Topic {
  id: string;
  name: string;
  status: TopicStatus;
  subtopics: Subtopic[];
  topicNumber?: string; // e.g. "1.1", "2.3", "Topic 4"
  lastStudiedAt?: string; // ISO date string or timestamp
  weakNotes?: string;
  estimatedMinutes?: number;
  latestTestScore?: string;
  latestTestPercentage?: number;
  testCount?: number;
  timeSpentMinutes?: number;
  sessionsCount?: number;
  progressionState?: TopicProgressionState;
  verifiedMasteryScore?: number;
  verifiedAt?: string;
  masteryVerification?: TopicMasteryVerification;
}

export interface Chapter {
  id: string;
  name: string;
  topics: Topic[];
  language?: 'en' | 'ur';
}

export interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
  color?: string;
  description?: string;
  icon?: string; // Emoji icon (e.g. 🧬, 🧪, ⚛️)
  geminiNotebookUrl?: string; // Link to Google NotebookLM / Gemini Notebook
  linkedSubjectIds?: string[]; // IDs of companion/related subjects linked to this subject
  language?: 'en' | 'ur'; // Language of the subject and its syllabus (Urdu / English)
  boardAffiliation?: ExamBoard; // Educational examination board affiliation
}

export type ExamBoard = 
  | 'fbise' 
  | 'punjab_board' 
  | 'sindh_board' 
  | 'kpk_board' 
  | 'cie_olevel' 
  | 'cie_alevel' 
  | 'mdcat' 
  | 'ecat' 
  | 'cbse' 
  | 'jee_neet' 
  | 'sat_ap' 
  | 'general';

export interface ExamBoardPreset {
  id: ExamBoard;
  name: string;
  shortName: string;
  region: string;
  defaultMinutesPerMark: number; // e.g. 1.5 min per mark, 0.75 for MCQs
  description: string;
  badgeColor: string;
  isUrduSupportive?: boolean;
}

export const EXAM_BOARD_PRESETS: ExamBoardPreset[] = [
  {
    id: 'cie_olevel',
    name: 'Cambridge CIE O-Level / IGCSE',
    shortName: 'CIE O-Level',
    region: 'International / UK',
    defaultMinutesPerMark: 1.5,
    description: 'Structured working, command words (explain, evaluate, calculate) at 1.5m / mark',
    badgeColor: 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30'
  },
  {
    id: 'cie_alevel',
    name: 'Cambridge CIE A-Level',
    shortName: 'CIE A-Level',
    region: 'International / UK',
    defaultMinutesPerMark: 1.6,
    description: 'Rigorous analytical arguments, extended proofs & derivations at 1.6m / mark',
    badgeColor: 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/30'
  },
  {
    id: 'fbise',
    name: 'Federal Board (FBISE Islamabad)',
    shortName: 'FBISE',
    region: 'Pakistan (National/Federal)',
    defaultMinutesPerMark: 1.25,
    description: 'SLO-based conceptual assessment, diagrams, & bilingual Urdu/English options',
    badgeColor: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
    isUrduSupportive: true
  },
  {
    id: 'punjab_board',
    name: 'Punjab Board (BISE Lahore / Rawalpindi)',
    shortName: 'Punjab Board',
    region: 'Pakistan (Punjab)',
    defaultMinutesPerMark: 1.2,
    description: 'Detailed headings, textbook definitions, short/long questions & pairing schemes',
    badgeColor: 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30',
    isUrduSupportive: true
  },
  {
    id: 'sindh_board',
    name: 'Sindh Board (BISE Karachi / Hyderabad)',
    shortName: 'Sindh Board',
    region: 'Pakistan (Sindh)',
    defaultMinutesPerMark: 1.2,
    description: 'Textbook theory, comprehensive definitions & board paper formatting',
    badgeColor: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/30',
    isUrduSupportive: true
  },
  {
    id: 'kpk_board',
    name: 'KPK Board (BISE Peshawar / Abbottabad)',
    shortName: 'KPK Board',
    region: 'Pakistan (Khyber Pakhtunkhwa)',
    defaultMinutesPerMark: 1.2,
    description: 'Conceptual SLO curriculum with structured sections A, B & C',
    badgeColor: 'bg-lime-500/15 text-lime-800 dark:text-lime-300 border-lime-500/30',
    isUrduSupportive: true
  },
  {
    id: 'mdcat',
    name: 'MDCAT / Medical College Admission',
    shortName: 'MDCAT',
    region: 'Medical Entrance (PMDC / NUMS)',
    defaultMinutesPerMark: 0.75, // 45s per MCQ
    description: 'Ultra-fast 45-second MCQ elimination, high accuracy & biological recall',
    badgeColor: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30'
  },
  {
    id: 'ecat',
    name: 'ECAT / Engineering College Admission',
    shortName: 'ECAT',
    region: 'Engineering Entrance (UET / NUST)',
    defaultMinutesPerMark: 0.8,
    description: 'Rapid mathematical manipulation, formula shortcuts & physics reasoning',
    badgeColor: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
  },
  {
    id: 'cbse',
    name: 'CBSE / ICSE Board',
    shortName: 'CBSE',
    region: 'India (National)',
    defaultMinutesPerMark: 1.25,
    description: 'NCERT aligned step-marking, competency-based questions & case studies',
    badgeColor: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30'
  },
  {
    id: 'jee_neet',
    name: 'JEE / NEET Competitive Exam',
    shortName: 'JEE/NEET',
    region: 'Competitive Entrance (NTA)',
    defaultMinutesPerMark: 1.0,
    description: 'High-density calculation & rigorous negative marking penalty protection',
    badgeColor: 'bg-red-500/15 text-red-800 dark:text-red-300 border-red-500/30'
  },
  {
    id: 'sat_ap',
    name: 'US SAT / Advanced Placement (AP)',
    shortName: 'SAT / AP',
    region: 'United States / College Board',
    defaultMinutesPerMark: 1.2,
    description: 'Timed comprehension, digital adaptive testing & multi-step synthesis',
    badgeColor: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30'
  },
  {
    id: 'general',
    name: 'Standard Examination Pace',
    shortName: 'General Exam',
    region: 'Standard',
    defaultMinutesPerMark: 1.3,
    description: 'Balanced pace suited for university midterms, mocks, and general finals',
    badgeColor: 'bg-stone-500/15 text-stone-800 dark:text-stone-300 border-stone-500/30'
  }
];

export interface StudySession {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  subjectName: string;
  chapterName: string;
  topicName: string;
  sloCode?: string; // Specific SLO code (e.g., "SLO-1.1.2")
  sloName?: string; // Specific Learning Objective name
  result: 'Completed' | 'Partially completed' | 'Not completed';
  notes?: string;
  timestamp: number;
  assignmentId?: string;
  assignmentTitle?: string;
  addedTo137?: boolean; // Track if 1-3-7 revision cycle was triggered
  qualityScore?: number; // 0-100 Deep Work Quality Score
  deepWorkRating?: 'Deep Work' | 'Moderate Focus' | 'Fragmented' | 'Shallow';
  focusPercentage?: number; // 0-100% focus rating
  distractionCount?: number;
  difficultyRating?: 'Introductory' | 'Standard' | 'Rigorous' | 'Past Paper Level';
  activeRecallScore?: number; // 0-100% post-session recall check
  outputSummary?: string; // e.g. "Solved 8 questions, 1 summary sheet"
}

export type TopicCompletionStatus = 'Completed' | 'Needs Revision' | 'Partially completed' | 'Mastered';

export interface CalendarSyncStatus {
  inAppCalendarSynced: boolean;
  googleCalendarSynced: boolean;
  googleCalendarSyncError?: string;
  googleTasksSynced: boolean;
  googleTasksSyncError?: string;
  accountabilityActive: boolean;
  lastSyncedAt?: string;
}

export interface InAppCalendarEvent {
  id: string; // Unique internal calendar-event ID
  planId?: string; // Link to parent StudyPlan
  planTopicId?: string; // Link to StudyPlanTopic
  subjectName: string;
  chapterName?: string;
  topicName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "18:00" or "6:00 PM"
  endTime: string; // e.g. "19:00" or "7:00 PM"
  durationMinutes: number; // e.g. 60
  deadline: string; // e.g. "7:00 PM" or "2026-09-30T19:00:00"
  priority: 'High' | 'Medium' | 'Low';
  reason?: string;
  notes?: string;
  completed?: boolean;
  completedAt?: string;

  // External sync mappings
  googleCalendarEventId?: string;
  googleTaskId?: string;

  // Synchronization status indicators
  syncStatus: CalendarSyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudyPlanTopic {
  id: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  estimatedMinutes: number;
  priority: 'High' | 'Medium' | 'Low';
  reason: string;
  completed?: boolean;
  completionDetails?: string;
  completionStatus?: TopicCompletionStatus;
  completedAt?: string;
  
  // Specific scheduling parameters preserved by Calendar Analyzer
  date?: string; // YYYY-MM-DD
  startTime?: string; // e.g. "18:00" or "6:00 PM"
  endTime?: string; // e.g. "19:00" or "7:00 PM"
  deadline?: string; // e.g. "7:00 PM" or "2026-09-30T19:00:00"
  calendarEventId?: string; // Inbuilt Calendar Event ID
  googleCalendarEventId?: string; // External Google Calendar event link
  googleTaskId?: string; // External Google Task link
  syncStatus?: CalendarSyncStatus;

  targetedQuestions?: Array<{
    id: string;
    questionText: string;
    type?: 'mcq' | 'conceptual' | 'numerical';
    marks?: number;
    expectedKey?: string;
  }>;
  linkedMistakeIds?: string[];
}

export interface StudyPlan {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  topics: StudyPlanTopic[];
  reasoning: string;
  availableHours?: number;
  createdAt: string;
  updatedAt?: string;
  calendarEvents?: InAppCalendarEvent[];
}

export interface TopicMistakeAnalysis {
  topicNumber: string;
  topicName: string;
  specificDifficulty?: string;
  conceptualGap?: string;
  tutorPrompt?: string;
}

export interface TestResultAnalysis {
  whatWentWrong: string;
  probableCause: string;
  weakConcept: string;
  whatToRevise: string;
  nextPractice: string;
  tutorPrompts: string[];
  topicBreakdown?: TopicMistakeAnalysis[];
}

export interface PracticeQuestion {
  id: string;
  type: 'mcq' | 'short_answer' | 'conceptual';
  question: string;
  options?: string[];
  correctOptionIndex?: number;
  explanation: string;
  hint?: string;
  topicName?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export interface PracticeQuestionSet {
  id: string;
  subjectName: string;
  chapterName?: string;
  topicName?: string;
  isWeakTopicFocus?: boolean;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
  questions: PracticeQuestion[];
  createdAt: string;
}

export type VaultCategory = 
  | 'exam_prep' 
  | 'project' 
  | 'mock_series' 
  | 'assignment_batch' 
  | 'diagnostic' 
  | 'lab_practicum' 
  | 'textbook'
  | 'coursework'
  | 'Textbook & Coursework'
  | 'custom';

export interface StorageVault {
  id: string;
  userId: string;
  name: string;
  description?: string;
  subjectName: string; // The assigned subject context for this bucket
  chapterName?: string;
  category: VaultCategory;
  color?: string; // Hex or theme color for bucket badge
  icon?: string; // Emoji or icon key
  targetScore?: number; // Target score percentage or raw score
  targetDate?: string; // Target exam/submission date
  maxScore?: number; // Default max marks per test in this bucket
  passingScore?: number;
  createdAt: string;
  updatedAt?: string;
  tags?: string[];
  isArchived?: boolean;
  isLocked?: boolean;
  metadata?: {
    instructor?: string;
    cohortOrSemester?: string;
    courseCode?: string;
    benchmarkNotes?: string;
  };
}

export interface TestResult {
  id: string;
  userId: string;
  vaultId?: string; // Links test result directly to an isolated storage vault bucket / test wallet
  vaultName?: string; // Human-readable bucket title for fast indexing
  testName: string;
  testNumber?: string;
  topicNumber?: string; // e.g. "1.1", "2.3", "Topic 4" - links to specific topic in syllabus
  topicNumbers?: string[]; // Multiple linked topic numbers e.g. ["3.1", "3.2", "3.3"]
  topicId?: string;
  topicIds?: string[]; // Multiple linked topic IDs
  topicName?: string;
  topicNames?: string[]; // Multiple topic names
  chapterName?: string;
  paperCode?: string;
  subjectName: string;
  score: string;
  totalMarks?: number;
  obtainedMarks?: number;
  percentage?: number;
  scorePercentage?: number;
  maxScore?: number;
  date: string;
  mistakes: string;
  struggledTopics: string[];
  correctionPrompts?: string[];
  correctionNotes?: string;
  notes?: string;
  isCorrected?: boolean;
  questionsCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  analysis?: TestResultAnalysis;
  savedQuestionsData?: Array<{
    questionId: string;
    questionNumber: number;
    questionText: string;
    studentAnswer?: string;
    modelAnswer?: string;
    awardedMarks: number;
    totalMarks: number;
    isCorrect: boolean;
    feedback?: string;
    topicName?: string;
    rubricBreakdown?: Array<{ criterion: string; marks: number; awarded: number }>;
  }>;
  classroomPostId?: string;
  classroomCourseId?: string;
  classroomCourseName?: string;
  classroomUrl?: string;
  promptsEmailedTo?: string;
  promptsEmailedAt?: string;
  createdAt?: string;
}

export interface RevisionItem {
  id: string;
  userId: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  lastStudied: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Completed';
  reason?: string;
  timeSpentMinutes?: number;
  totalTimeSpentMinutes?: number;
  sessionsCount?: number;
  lastSessionDurationMinutes?: number;
  completedAt?: string;
  // 1-3-7 Spaced Repetition Engine extensions:
  cycleStage?: 'day1' | 'day3' | 'day7';
  completedStages?: Array<'day1' | 'day3' | 'day7'>;
  isGraduated?: boolean;
  initialStudyDate?: string; // Day 0 initial learning date
  linkedSloIds?: string[]; // Specific SLO / Subtopic IDs covered
  linkedSloNames?: string[]; // Names of specific Learning Objectives
  relatedTestDate?: string; // Upcoming test related to this topic
  relatedTestName?: string;
  isOverdue?: boolean;
  daysOverdue?: number;
}

export interface UserNote {
  id: string;
  userId: string;
  title: string;
  subjectName: string;
  content: string;
  updatedAt: string;
}

export interface BlurtRecalledConcept {
  concept: string;
  detail: string;
}

export interface BlurtKnowledgeGap {
  concept: string;
  explanation: string;
  severity: 'critical' | 'moderate' | 'minor';
}

export interface BlurtMisconception {
  claimed: string;
  correction: string;
}

export interface HandwrittenNotesQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  conceptTested?: string;
  hint?: string;
}

export interface HandwrittenNotesStudySet {
  title: string;
  subjectName: string;
  chapterName?: string;
  topicName: string;
  summary: string;
  extractedText: string;
  diagramNotes?: string;
  keyConcepts: string[];
  quiz: HandwrittenNotesQuizQuestion[];
  flashcards: Flashcard[];
}

export interface BlurtRecallEvaluation {
  id: string;
  topicName: string;
  subjectName: string;
  chapterName?: string;
  date: string;
  timestamp: number;
  blurtText: string;
  promptUsed: string;
  durationSeconds: number;
  recallScore: number; // 0 to 100
  retentionLevel: 'Mastered' | 'Strong' | 'Needs Revision' | 'Weak';
  wordCount: number;
  summaryFeedback: string;
  recalledConcepts: (BlurtRecalledConcept | string)[];
  knowledgeGaps: BlurtKnowledgeGap[];
  misconceptions: BlurtMisconception[];
  actionableAdvice: string[];
  imageUrl?: string;
  extractedText?: string;
  diagramNotes?: string;
  // Deep Diagnostic & Explanation Autopsy:
  whyUnableToExplain?: string; // Root cause why the student struggled to explain to the fullest (e.g. superficial memorization without derivation, vague terminology, missing causal links)
  backlashesAndPitfalls?: string[]; // Academic backlash / examiner deductions if attempted in official FBISE board exams
  keyConceptsMissed?: string[]; // Essential definitions, equations, or laws that were missing
  recommendedRemediation?: string; // Direct concrete next study step to fix this topic
}

export interface ActivityLog {
  id: string;
  userId: string;
  date: string;
  timestamp: number;
  subjectName: string;
  chapterName?: string;
  topicName?: string;
  action: string;
  details: string;
  durationMinutes?: number;
  result?: string;
  scorePercentage?: number;
  blurtRecall?: BlurtRecallEvaluation;
}

export interface ExamDate {
  id: string;
  subjectName: string;
  examName: string;
  date: string; // YYYY-MM-DD
}

export interface ExamNotificationSettings {
  email: string;
  emailEnabled: boolean;
  emailProvider?: 'gmail_api' | 'smtp' | 'auto';
  freeEmailProvider?: 'gmail_app_password' | 'google_workspace_oauth' | 'custom_smtp';
  gmailUser?: string;               // Personal Gmail for 100% free SMTP delivery
  gmailAppPassword?: string;       // 16-char Free Google App Password
  customSmtpHost?: string;
  customSmtpPort?: number;
  customSmtpUser?: string;
  customSmtpPass?: string;
  dailyDigestTime: string; // e.g. "07:00"
  frequency: 'daily' | 'milestones_only' | 'daily_and_milestones';
  milestoneDays: number[];
  includeSyllabusCoverage: boolean;
  includeRevisionSets: boolean;
  includeWeakSpots: boolean;
  // Free Instant Messaging Channels (No Twilio Required)
  instantMessengerChannel?: 'whatsapp_callmebot' | 'telegram' | 'discord_webhook' | 'custom_webhook';
  whatsappEnabled: boolean;
  whatsappNumber?: string;
  whatsappCallMeBotApiKey?: string; // Free CallMeBot WhatsApp API Key (100% free automated WhatsApp)
  telegramEnabled?: boolean;
  telegramChatId?: string;          // Free Telegram Chat ID
  telegramBotToken?: string;        // Optional custom bot token, or system default
  discordWebhookUrl?: string;       // Free Discord incoming webhook
  googleChatWebhookUrl?: string;    // Free Google Chat Space incoming webhook
  customWebhookUrl?: string;        // Free custom incoming webhook
  pushEnabled: boolean;
  pushSoundEnabled?: boolean;
  lastDispatchedDate?: string;
  streakSaverEnabled?: boolean;
  sm2AlertsEnabled?: boolean;
  autoGenerateMeetLinks?: boolean;
}

export interface ScheduledStudyTask {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  subjectName: string;
  chapterName?: string;
  topicName?: string;
  durationMinutes: number;
  completed: boolean;
  priority?: 'High' | 'Medium' | 'Low';
  timeslot?: 'morning' | 'afternoon' | 'evening' | 'night';
  deadlineId?: string;
}

export type TimeslotPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export interface DayTimeslotSchedule {
  date: string; // YYYY-MM-DD
  morning: { available: boolean; note?: string };
  afternoon: { available: boolean; note?: string };
  evening: { available: boolean; note?: string };
  night: { available: boolean; note?: string };
}

export interface DeadlineDistribution {
  id: string;
  title: string;
  targetDate: string; // YYYY-MM-DD
  subjectName: string;
  totalRequiredHours: number;
  mode: 'divide_evenly' | 'divide_weighted' | 'single_day';
  assignedTasksCount?: number;
}

export interface StudyBadge {
  id: string;
  title: string;
  description: string;
  category: 'hours' | 'streak' | 'mastery' | 'discipline';
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  icon: string;
  requirement: number;
  currentValue: number;
  unlocked: boolean;
  unlockedAt?: string;
  unit: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemePalette = 'natural_ethos' | 'nord_studio' | 'obsidian_dark' | 'sunset_amber' | 'royal_indigo' | string;
export type ThemePreset = 'natural_ethos' | 'nord_studio' | 'obsidian_dark' | 'sunset_amber' | 'royal_indigo';

export interface ThemeConfig {
  mode: ThemeMode;
  palette?: ThemePalette;
  preset?: ThemePreset;
  highContrast?: boolean;
  compactMode?: boolean;
}

export interface AcademicYearProfile {
  academicYear: string; // e.g. "2026 - 2027"
  yearLevel: string; // e.g. "Year 1 (Freshman)", "Year 2 (Sophomore)", "Year 3 (Junior)", "Year 4 (Senior)", "Class 12", "Postgrad"
  semesterOrTerm: string; // e.g. "Fall Semester", "Semester 1", "Spring Term", "Annual"
  targetExamYear?: string; // e.g. "2026", "2027"
  institution?: string; // e.g. "University / College / High School"
  majorOrStream?: string; // e.g. "Computer Science & Engineering", "Pre-Med", "General"
  academicYearStartDate?: string; // YYYY-MM-DD
  academicYearEndDate?: string; // YYYY-MM-DD
  targetGpaOrScore?: string; // e.g. "3.8 GPA", "90%+"
  graduationYear?: string; // e.g. "2027"
}

export interface UserProfile {
  uid?: string;
  name?: string;
  displayName: string;
  email: string;
  photoURL?: string;
  subjects?: string[];
  targetHoursPerDay: number;
  studyStreak?: number;
  examDates: ExamDate[];
  createdAt?: string;
  theme?: ThemeConfig;
  themePreference?: ThemeMode;
  themePalette?: ThemePalette;
  // Academic Year Profile Fields
  academicYear?: string;
  yearLevel?: string;
  semesterOrTerm?: string;
  targetExamYear?: string;
  institution?: string;
  majorOrStream?: string;
  academicYearStartDate?: string;
  academicYearEndDate?: string;
  targetGpaOrScore?: string;
  graduationYear?: string;
  geminiNotebookUrl?: string; // Link to Google NotebookLM / Gemini Notebook
  googleChatWebhookUrl?: string; // Persistent Google Chat Space Incoming Webhook URL
  googleChatSpaceLink?: string;  // Direct Google Chat Space link/URL (works for all @gmail.com accounts)
  googleChatConnectionMethod?: 'google_account' | 'space_link' | 'webhook' | 'discord';
  googleChatConfig?: any;
  yearProfile?: AcademicYearProfile;
  language?: 'en' | 'ur';
}

export interface StudyGroupMember {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'admin' | 'member';
  joinedAt: string;
  shareProgress: boolean;
  completedTopicsCount?: number;
  totalTopicsCount?: number;
  studiedHoursThisWeek?: number;
  sharedWeakTopics?: string[];
  sharedMasteredTopics?: string[];
  upcomingExams?: ExamDate[];
}

export interface CollaborativeGoal {
  id: string;
  title: string;
  description?: string;
  type: 'weekly_hours' | 'topics_count' | 'exam_prep' | 'streak_days';
  targetValue: number;
  currentValue: number;
  unit: string; // 'hours' | 'topics' | 'days' | '%'
  deadline?: string;
  completed: boolean;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export interface AIGroupStudySuggestion {
  id: string;
  title: string;
  subjectName: string;
  chapterName?: string;
  topicName: string;
  reason: string;
  urgency: 'High' | 'Medium' | 'Normal';
  recommendedActivity: 'Group Practice Quiz' | 'Concept Breakdown' | 'Problem Solving Session' | 'Peer Teaching & Drill';
  estimatedMinutes: number;
  sessionAgenda?: string[];
  membersBenefited?: string[];
}

export interface GroupChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  timestamp: number;
  type?: 'chat' | 'goal_completed' | 'ai_suggestion' | 'member_joined';
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  groupCode: string;
  subjectFocus: string[];
  isPublic?: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  members: StudyGroupMember[];
  goals: CollaborativeGoal[];
  aiSuggestions?: AIGroupStudySuggestion[];
  messages?: GroupChatMessage[];
  targetExam?: string;
  targetExamDate?: string;
}

export interface Flashcard {
  id: string;
  front: string; // Question, concept, prompt or formula
  back: string; // Answer, explanation, formula breakdown
  mnemonic?: string; // Memory aid or tip
  tags?: string[];
  easeFactor?: number; // SM-2 ease factor default 2.5
  intervalDays?: number; // Days until next review
  repetitions?: number; // Review counter
  nextReviewDate?: string; // YYYY-MM-DD
  lastReviewedAt?: string;
  mastered?: boolean;
}

export interface FlashcardDeck {
  id: string;
  title: string;
  subjectName: string;
  chapterName?: string;
  topicName?: string;
  description?: string;
  cards: Flashcard[];
  createdAt: string;
  updatedAt: string;
  isWeakTopicDeck?: boolean;
}

export type ActiveTab = 
  | 'dashboard' 
  | 'study_cockpit'
  | 'study_habits'
  | 'gemini_notebook'
  | 'boss_battle'
  | 'knowledge_graph'
  | 'examiner_red_pen'
  | 'mistake_vault'
  | 'personal_bests'
  | 'gamification'
  | 'virtual_room'
  | 'blurt_recall'
  | 'knowledge_refurbish'
  | 'marks_recovery'
  | 'paper_auto_forcing'
  | 'missed_work'
  | 'assignments'
  | 'syllabus' 
  | 'planner' 
  | 'classroom'
  | 'groups'
  | 'flashcards'
  | 'timer' 
  | 'calendar' 
  | 'progress' 
  | 'revision' 
  | '137_revision'
  | 'test_prep'
  | 'tests' 
  | 'vaults'
  | 'tutor' 
  | 'activity' 
  | 'data_backup'
  | 'settings';

export type AssignmentType = 
  | 'Homework' 
  | 'Assignment' 
  | 'Project' 
  | 'Test' 
  | 'Quiz' 
  | 'Presentation' 
  | 'Lab work' 
  | 'Other';

export type AssignmentPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type AssignmentStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Submitted' | 'Overdue';

export interface AssignmentAttachment {
  id: string;
  name: string;
  type: 'file' | 'link' | 'vault' | 'drive' | 'classroom';
  url?: string;
  vaultId?: string;
  vaultItemId?: string;
  fileSize?: string;
  addedAt: string;
}

export interface AssignmentSubtask {
  id: string;
  title: string;
  phase: 'research' | 'outline' | 'drafting' | 'review' | 'practice' | 'submission';
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string;
  scheduledDate?: string; // YYYY-MM-DD
  timeslot?: 'morning' | 'afternoon' | 'evening' | 'night';
  linkedPlanTopicId?: string;
}

export interface Assignment {
  id: string;
  userId: string;
  title: string;
  description?: string;
  
  // Optional syllabus link
  subjectId?: string;
  subjectName?: string;
  chapterId?: string;
  chapterName?: string;
  topicId?: string;
  topicName?: string;
  
  type: AssignmentType;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm (e.g. "23:59")
  priority: AssignmentPriority;
  status: AssignmentStatus;
  
  estimatedMinutes?: number;
  timeSpentMinutes?: number;
  notes?: string;
  attachments?: AssignmentAttachment[];
  
  // Preparation & Subtasks
  subtasks?: AssignmentSubtask[];
  hasPrepPlan?: boolean;
  
  // Linked sessions & results
  linkedSessionIds?: string[];
  linkedTestResultId?: string;
  linkedVaultIds?: string[];
  
  // Workspace / Classroom link
  googleClassroomPostId?: string;
  googleCalendarEventId?: string;
  googleTasksId?: string;
  
  // Reminder settings
  reminderEnabled?: boolean;
  reminderDaysBefore?: number;
  
  createdAt: string; // ISO
  updatedAt: string; // ISO
  completedAt?: string;
}

export interface MockExamRubricItem {
  criterion: string;
  allocatedMarks: number;
}

export interface MockExamQuestion {
  id: string;
  questionNumber: number;
  type: 'mcq' | 'structured' | 'numerical' | 'short_answer';
  topicName?: string;
  topicNumber?: string;
  chapterName?: string;
  marks: number;
  questionText: string;
  options?: string[];
  correctOptionIndex?: number;
  modelAnswer: string;
  rubric: MockExamRubricItem[];
  examinerGuidance?: string;
  formulaOrHint?: string;
}

export interface MockExamSection {
  name: string;
  description?: string;
  questionIds?: string[];
}

export interface MockExam {
  id: string;
  title: string;
  subjectName: string;
  chapterNames?: string[];
  durationMinutes: number;
  totalMarks: number;
  passingPercentage?: number;
  difficulty?: 'Standard' | 'Challenging' | 'Past Paper Style' | 'Foundation';
  examBoard?: string;
  paperFormatCode?: string;
  instructions: string[];
  sections?: MockExamSection[];
  questions: MockExamQuestion[];
  createdAt: string;
}

export interface GradedRubricEvaluation {
  criterion: string;
  allocatedMarks: number;
  awardedMarks: number;
  note?: string;
}

export interface GradedQuestionResult {
  questionId: string;
  questionNumber: number;
  type: 'mcq' | 'structured' | 'numerical' | 'short_answer';
  topicName?: string;
  topicNumber?: string;
  awardedMarks: number;
  totalMarks: number;
  isCorrect: boolean;
  studentAnswer: string;
  modelAnswer: string;
  feedback: string;
  rubricEvaluations: GradedRubricEvaluation[];
  keyOmissions?: string[];
  conceptGap?: string;
  remedyTutorPrompt?: string;
  ocrTranscribedText?: string;
  handwrittenImageUrl?: string;
  diagramAnalysis?: string;
  methodMarksNotes?: string;
}

export interface GradedTopicPerformance {
  topicName: string;
  topicNumber?: string;
  score: number;
  total: number;
  percentage: number;
  status: 'Mastered' | 'Satisfactory' | 'Needs Review' | 'Critical Weakness';
}

export interface GradedMockExam {
  id: string;
  examId: string;
  title: string;
  subjectName: string;
  totalScore: number;
  totalPossibleMarks: number;
  percentage: number;
  grade: string;
  summaryAssessment: string;
  timeSpentSeconds: number;
  timeSpentMinutes: number;
  durationAllottedMinutes: number;
  paceAssessment: string;
  gradedQuestions: GradedQuestionResult[];
  topicPerformance: GradedTopicPerformance[];
  weakestTopics: string[];
  recommendedNextAction: string;
  completedAt: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedPrompts?: string[];
  relatedSubject?: string;
  relatedTopic?: string;
}

export interface UserDevice {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  os: string;
  browser: string;
  screenResolution?: string;
  userAgent?: string;
  registeredAt: string;
  lastActive: string;
  isCurrentDevice?: boolean;
  status: 'online' | 'synced' | 'idle' | 'revoked';
  appVersion?: string;
}

export type MissedWorkType = 'task' | 'test' | 'assignment' | 'class';
export type MissedWorkStatus = 'Missed' | 'Pending' | 'Completed' | 'Rescheduled';
export type MissedWorkPriority = 'High' | 'Medium' | 'Low';

export interface MissedWorkItem {
  id: string;
  type: MissedWorkType;
  title: string;
  subjectName: string;
  chapterName?: string;
  originalDeadline: string; // YYYY-MM-DD
  originalTimeslot?: string;
  status: MissedWorkStatus;
  priority: MissedWorkPriority;
  detectedAutomatically: boolean;
  estimatedMinutes: number;
  notes?: string;
  rescheduledDate?: string; // YYYY-MM-DD
  rescheduledTimeslot?: string;
  sourceId?: string; // e.g. assignment id, plan topic id, exam id
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecoverySuggestion {
  itemId: string;
  suggestedDate: string; // YYYY-MM-DD
  suggestedTimeslot: string; // 'morning' | 'afternoon' | 'evening' | 'night'
  suggestedPriority: MissedWorkPriority;
  reasoning: string;
  urgencyRank: number; // 1 = attempt first
}

// -------------------------------------------------------------
// GAMIFICATION, RPG LEVELING & STUDY QUESTS
// -------------------------------------------------------------

export interface RPGStudyBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'pomodoro' | 'mastery' | 'recall' | 'circle' | 'hours' | 'discipline';
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  maxProgress?: number;
}

export interface StudyQuest {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  gemReward: number;
  progress: number;
  target: number;
  completed: boolean;
  icon: string;
  category: 'focus' | 'flashcards' | 'blurt' | 'syllabus' | 'streak';
}

export interface StudyRPGProfile {
  level: number;
  xp: number;
  xpForNextLevel: number;
  title: string;
  rankTitle: string;
  streak: number;
  streakFreezes: number;
  gems: number;
  completedQuestsCount: number;
  badges: RPGStudyBadge[];
  historyLog: {
    id: string;
    action: string;
    xpEarned: number;
    timestamp: string;
  }[];
}

// -------------------------------------------------------------
// VIRTUAL SILENT STUDY ROOM & FOCUS CANVAS
// -------------------------------------------------------------

export type AmbientSoundType = 'rain' | 'library' | 'cafe' | 'lofi' | 'brown_noise' | 'alpha_waves' | 'fireplace';

export interface AmbientSoundTrack {
  id: AmbientSoundType;
  name: string;
  icon: string;
  description: string;
}

export interface FocusCommitment {
  goal: string;
  subjectName?: string;
  targetMinutes: number;
  startedAt?: string;
  active: boolean;
  notes?: string;
}

// -------------------------------------------------------------
// WHATSAPP STUDY NOTIFICATIONS & COMPANION
// -------------------------------------------------------------

export interface WhatsAppConfig {
  phoneNumber: string;
  countryCode: string;
  enabled: boolean;
  dailyDigestTime: string;
  includeStreaks: boolean;
  includePriorityTopics: boolean;
  includeDueFlashcards: boolean;
}

// -------------------------------------------------------------
// EXAMINER'S RED PEN & EXAM AUTOPSY / MISTAKE VAULT
// -------------------------------------------------------------

export type CognitiveErrorCategory = 
  | 'careless_calc'          // Arithmetic slip, forgot to carry over, wrong decimal
  | 'misread_question'       // Missed "NOT", wrong units given, missed second half of question
  | 'formula_confusion'      // Mixed up similar formulas, wrong sign, upside-down ratio
  | 'concept_gap'            // Didn't understand underlying concept, guessed
  | 'time_pressure'          // Rushed at the end, sloppy working
  | 'english_comprehension'  // Language ambiguity, vocabulary trap, grammar/syntax nuance
  | 'missing_question';      // Omitted question, skipped under exam pressure

export interface MistakeEntry {
  id: string;
  subjectName: string;
  topicName?: string;
  question: string;
  userAttempt?: string;
  correctAnswer: string;
  errorCategory: CognitiveErrorCategory;
  studentThoughtProcess?: string; // What the student was thinking at that moment & why they took that step
  notes?: string;
  imageAttachment?: string; // Data URL or base64 of question/working photo
  pdfAttachment?: string;   // PDF link or filename
  source: 'quiz' | 'red_pen' | 'past_paper' | 'offline_exam' | 'manual' | 'refurbish_mode' | 'auto_forcing_paper' | 'google_forms_mcq' | 'mock_exam' | 'blurt' | 'socratic' | 'timer';
  cureStatus: 'active' | 'curing' | 'cured';
  consecutiveCorrect: number; // Reaches 3 to cure
  history: Array<{
    date: string;
    wasCorrect: boolean;
    userResponse?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface RedPenCriterion {
  id: string;
  criterion: string;
  maxMarks: number;
  awardedMarks: number;
  comment: string;
  passed: boolean;
}

export interface RedPenDeduction {
  id: string;
  title: string;
  marksLost: number;
  reason: string;
  errorCategory: CognitiveErrorCategory;
  recommendation: string;
}

export interface RedPenResult {
  id: string;
  subjectName: string;
  topicName: string;
  questionText: string;
  studentAnswer: string;
  totalMarks: number;
  awardedMarks: number;
  percentage: number;
  examinerGrade: string;
  examinerFeedback: string;
  markingCriteria: RedPenCriterion[];
  deductions: RedPenDeduction[];
  modelAnswer: string;
  examinerTip: string;
  assessedAt: string;
  // Deep Autopsy & Diagnostic:
  whyUnableToExplain?: string;
  missingEssentials?: string[];
  examBacklashes?: string[];
  uploadedImageUrl?: string;
  visionAnalysis?: MultimodalVisionAnalysis;
}

// -------------------------------------------------------------
// SPOT THE BLUNDER & MARK SCHEME DECONSTRUCTOR (OPTIONS 1, 2, 4)
// -------------------------------------------------------------

export type MarkSchemeCode = 'M1' | 'A1' | 'B1' | 'Q1' | 'C1';

export interface DeconstructedMarkItem {
  id: string;
  code: MarkSchemeCode; // M1 (Method), A1 (Accuracy), B1 (Independent Fact), Q1 (Quality/Keywords), C1 (Conclusion)
  title: string;
  marksAllocated: number;
  awardedToStudent: boolean;
  examinerRationale: string;
  mandatoryKeywords: string[];
}

export type BlunderCategory = 
  | 'careless_calc' 
  | 'sign_error' 
  | 'missing_unit' 
  | 'vague_keyword' 
  | 'concept_gap' 
  | 'misread_question'
  | 'formula_confusion'
  | 'premature_rounding';

export interface BlunderDetail {
  id: string;
  lineIndex: number;
  title: string;
  category: BlunderCategory;
  severity: 'minor' | 'fatal';
  marksDeducted: number;
  studentMistakeQuote: string;
  whyStudentMadeIt: string;
  examinerTrapAnalysis: string; // Option 4: How the board designed this trap
  howToPrevent: string;
  correctCorrection: string;
}

export interface StudentAnswerLine {
  id: string;
  lineIndex: number;
  text: string;
  hasBlunder: boolean;
  blunderId?: string;
}

export interface SpotBlunderChallenge {
  id: string;
  title: string;
  subjectName: string;
  chapterName?: string;
  topicName: string;
  examBoard: string; // e.g., 'Cambridge A-Level', 'AQA', 'CBSE Class 12', 'FBISE'
  pastPaperYear: string; // e.g., 'May/June 2023 Paper 22 Q3(b)'
  
  // Option 1: Past Paper Trend & Predictor
  examFrequency: string; // e.g., 'Appears in 85% of board exams (Guaranteed Core)'
  trapCasualtyRate: number; // e.g. 68% of candidates lost marks here
  isHotTopic: boolean;

  questionText: string;
  totalMarks: number;
  fictionalStudentName: string;
  fictionalStudentTargetGrade: string; // e.g. 'Aiming for A*'
  studentActualScore: number;

  answerLines: StudentAnswerLine[];
  blunders: BlunderDetail[]; // Option 4
  deconstructedRubric: DeconstructedMarkItem[]; // Option 2
  modelAnswer: string;
  chiefExaminerSecretTip: string;
}

// --- KNOWLEDGE REFURBISHMENT MODE (CLOSED-BOOK AUDIT) ---
export interface RefurbishmentGapReport {
  missingDefinitions: string[];
  missingFormulas: string[];
  missingDerivations: string[];
  incorrectRelations: Array<{ claimed: string; truth: string }>;
  terminologiesGap: string[];
  applicationWeaknesses: string[];
}

export interface CompressedCorrectionSheet {
  corePointsKnown: number;
  totalCorePoints: number;
  scorePercentage: number;
  verdict: 'Mastered' | 'Refurbished' | 'Critical Gaps';
  keyTakeaways: string[];
  quickFormulaSheet: string[];
}

export interface TopicMasterSheet {
  id: string;
  subjectName: string;
  chapterName?: string;
  topicName: string;
  refurbishedAt: string;
  scorePercentage: number;
  recallSummary: string;
  correctionSheet: CompressedCorrectionSheet;
  gapReport: RefurbishmentGapReport;
  keyActionDrill: string;
}

// --- MARKS RECOVERY ENGINE ---
export interface MarksRecoveryTopic {
  id: string;
  subjectName: string;
  chapterName?: string;
  topicName: string;
  examWeightage: number; // e.g., 8-10 marks in paper
  currentMasteryPercentage: number; // e.g., 40%
  potentialMarksRecoverable: number; // e.g., 6 marks
  reason: 'Frequent Past Exam Trap' | 'Mistake Vault Hotspot' | 'Calculation Friction' | 'Conceptual Gap' | string;
  category: 'Physics Numerical' | 'Chemistry Mechanism' | 'Biology Definition' | 'Math Derivation' | 'General Theory' | string;
  actionPrompt: string;
}

// --- PAPER AUTO-FORCING DIAGNOSTIC & PERCEPTION CALIBRATION ---
export type AutoForcingErrorCategory = 
  | 'couldnt_apply' 
  | 'misread_question' 
  | 'forgot_concept' 
  | 'calculation_error' 
  | 'time_pressure' 
  | 'carelessness' 
  | 'presentation_units'
  | 'unprepared_topic';

export type MetacognitiveConfidence = 'High' | 'Medium' | 'Low';

export type MetacognitiveAlignment = 
  | 'dangerous_overconfidence' // High confidence + Wrong
  | 'hesitant_mastery'        // Low confidence + Right
  | 'calibrated_mastery'      // High/Med confidence + Right
  | 'aware_incompetence';     // Low confidence + Wrong

export interface ForcedQuestionDiagnostic {
  id: string;
  questionNumber: string;
  questionText: string;
  userAnswer?: string;
  correctAnswer: string;
  totalMarks: number;
  marksLost: number;
  isCorrect: boolean;
  preConfidence: MetacognitiveConfidence;
  errorCategory?: AutoForcingErrorCategory;
  rootCauseNotes?: string;
  metacognitiveAlignment: MetacognitiveAlignment;
  prescribedAction: string;
  isActionExecuted?: boolean;
}

export interface AutoForcingPaperSession {
  id: string;
  testTitle: string;
  subjectName: string;
  completedAt: string;
  totalQuestions: number;
  questionsChecked: number;
  totalMarksPossible: number;
  totalMarksScored: number;
  questions: ForcedQuestionDiagnostic[];
  errorBreakdown: Record<AutoForcingErrorCategory, number>;
  alignmentSummary: {
    dangerousOverconfidenceCount: number;
    hesitantMasteryCount: number;
    calibratedCount: number;
  };
}

// -------------------------------------------------------------
// OPTION 4: TARGETED 2-MINUTE DRILL RE-ATTEMPT
// -------------------------------------------------------------

export interface DrillQuestion {
  id: string;
  targetedConcept: string; // The specific missing essential or misconception this question tests
  questionText: string;
  hint: string;
  expectedKeyTerms: string[];
  idealAnswer: string;
  marks: number;
  userResponse?: string;
  isEvaluated?: boolean;
  scoreAwarded?: number;
  feedback?: string;
  isMastered?: boolean;
}

export interface RemediationDrill {
  id: string;
  subjectName: string;
  topicName: string;
  sourceContext: string; // e.g. "Blurt Recall Gaps" or "Examiner Red Pen Deductions"
  diagnosedRootCause: string;
  targetedMissingConcepts: string[];
  questions: DrillQuestion[];
  generatedAt: string;
  totalMarks: number;
  scoreAchieved?: number;
  isCompleted?: boolean;
}

// -------------------------------------------------------------
// VISUAL RED PEN DIAGRAM & HANDWRITING ANNOTATIONS (MULTIMODAL)
// -------------------------------------------------------------

export interface VisualAnnotationMark {
  id: string;
  xPercent: number; // 0-100% position on image
  yPercent: number; // 0-100% position on image
  type: 'deduction' | 'slip' | 'missing_arrow' | 'unit_error' | 'correct_tick';
  label: string;
  comment: string;
  marksDelta?: number; // e.g. -0.5, -1, +1
}

export interface MultimodalVisionAnalysis {
  transcribedText: string;
  diagramAssessment: {
    hasDiagram: boolean;
    diagramAccuracyScore: number; // 0-100
    missingLabelsOrArrows: string[];
    geometricOrVectorIssues: string[];
  };
  handwritingClarity: 'Clear' | 'Borderline' | 'Difficult to Read';
  annotations: VisualAnnotationMark[];
}

// -------------------------------------------------------------
// COGNITIVE HEALTH & EBBINGHAUS FORGETTING CURVE GRAPH
// -------------------------------------------------------------

export interface CognitiveTopicHealth {
  topicKey: string; // "Physics::Electrostatics"
  subjectName: string;
  chapterName?: string;
  topicName: string;
  retentionPercent: number; // 0-100% calculated via Ebbinghaus decay
  stabilityDays: number; // S parameter
  lastReviewedDate: string;
  daysSinceReview: number;
  riskLevel: 'safe' | 'decaying' | 'critical_decay';
  totalLoggedMistakes: number;
  lastBlurtScore?: number;
  lastMockScore?: number;
  consecutiveRecallPasses: number;
  nextRecommendedReviewDate: string;
  missedEssentialsCount: number;
}

// -------------------------------------------------------------
// TEST PREPARATION ENGINE & MULTI-MONTH WORKLOAD
// -------------------------------------------------------------

export interface TestSloAudit {
  sloId: string;
  sloName: string;
  topicName: string;
  chapterName: string;
  subjectName: string;
  masteryStatus: TopicStatus;
  hasUncuredMistakes: boolean;
  mistakesCount: number;
  daysSinceLastRevision: number;
  isCoveredIn137: boolean;
  revisionUrgency: 'immediate' | 'scheduled' | 'mastered';
}

export interface TestPreparationTimeline {
  testId: string;
  testTitle: string;
  subjectName: string;
  testDate: string; // YYYY-MM-DD
  daysRemaining: number;
  estimatedWeightMarks?: number;
  includedTopics: string[];
  auditedSlos: TestSloAudit[];
  preparationStatus: 'on_track' | 'needs_attention' | 'critical_rush';
  dailyTargetQuota: {
    recommendedHoursPerDay: number;
    slosPerDay: number;
    mistakeDrillsPerDay: number;
  };
  preparationPhases: Array<{
    phaseName: 'Foundation & Coverage' | 'Targeted 1-3-7 Deep Revision' | 'Mistake Autopsy & Mock Papers' | 'Pre-Exam High-Yield Sprint';
    dateRange: string;
    actionableTasks: string[];
    isCurrentPhase: boolean;
  }>;
}

export interface DayWorkloadDiagnostic {
  date: string; // YYYY-MM-DD
  totalCommitmentHours: number;
  plannedTasksCount: number;
  revisionsDue137Count: number;
  isTestDay: boolean;
  testNames?: string[];
  pressureLevel: 'optimal' | 'moderate' | 'overloaded' | 'burnout_risk';
  conflicts: string[];
}

// ==========================================
// STUDY HABITS & PROGRESS SYSTEM TYPES
// ==========================================

export type StudyHabitId = 
  | 'daily_planning' 
  | 'focused_study' 
  | 'mcq_practice' 
  | 'active_recall' 
  | '137_revision' 
  | 'mistake_review' 
  | 'weekly_review';

export interface StudyHabitDefinition {
  id: StudyHabitId;
  title: string;
  shortLabel: string;
  description: string;
  icon: string;
  category: 'planning' | 'execution' | 'retention' | 'review';
  color: string;
  autoDetectHint: string;
}

export interface DailyHabitItemState {
  completed: boolean;
  autoCompleted?: boolean;
  completedAt?: string;
  sourceDetails?: string;
  manualOverride?: boolean;
  customNotes?: string;
}

export interface DailyHabitEntry {
  date: string; // YYYY-MM-DD
  habits: Record<StudyHabitId, DailyHabitItemState>;
  plannedMinutes?: number;
  completedMinutes?: number;
  importantTasksCount?: number;
  completedTasksCount?: number;
  revisionsDueCount?: number;
  revisionsCompletedCount?: number;
  overallProgressPercentage?: number;
  reflectionNote?: string;
  reviewNotes?: string; // Rich notes of what the student accomplished today
  studiedTopicsSummary?: string;
  updatedAt?: string;
}

export interface WeeklyReviewItem {
  id: string;
  text: string;
  completed: boolean;
  category?: 'academic' | 'revision' | 'exam_prep' | 'habit';
  createdAt?: string;
}

export interface WeeklyReviewRecord {
  weekKey: string; // e.g. "2026-09-Week-1"
  weekNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  summaryNotes: string; // What was accomplished / studied this week
  wins: string[];
  improvements: string[];
  reviewItems: WeeklyReviewItem[];
  completed: boolean;
  completedAt?: string;
  updatedAt?: string;
}

export interface HabitConsistencyStats {
  currentStreakDays: number;
  longestStreakDays: number;
  monthlyCompletionRate: number;
  weeklyCompletionRate: number;
  mostConsistentHabit?: string;
  completedHabitDaysThisMonth: number;
  totalHabitOpportunitiesThisMonth: number;
  totalStudyMinutesThisMonth: number;
  plannedStudyMinutesThisMonth: number;
  topProductiveDayOfWeek: string;
}

// ==========================================
// DEVICE CONNECTION & DATA TRANSFER SAFETY TYPES
// ==========================================

export type TransferWorkflowStep = 
  | 'idle'
  | 'connected'
  | 'authenticated'
  | 'transfer_started'
  | 'transfer_progress'
  | 'validating'
  | 'complete'
  | 'error';

export interface EntityDiffSummary {
  entityName: string;
  newCount: number;
  updatedCount: number;
  conflictCount: number;
  sampleItems?: Array<{
    id: string;
    title: string;
    action: 'new' | 'update' | 'conflict';
    reason?: string;
  }>;
}

export interface TransferSafetyDiff {
  sourceDeviceName: string;
  sourceUid?: string;
  sourceEmail?: string;
  timestamp: string;
  totalNew: number;
  totalUpdated: number;
  totalConflicts: number;
  entities: {
    syllabus: EntityDiffSummary;
    topics: EntityDiffSummary;
    tests: EntityDiffSummary;
    mistakes: EntityDiffSummary;
    flashcards: EntityDiffSummary;
    revisions: EntityDiffSummary;
    plans: EntityDiffSummary;
    habits: EntityDiffSummary;
    sessions: EntityDiffSummary;
    vaults: EntityDiffSummary;
    settings: EntityDiffSummary;
  };
  hasPreTransferBackup: boolean;
  preTransferBackupId?: string;
}

export type ConflictResolutionMode = 
  | 'smart_merge'        // Non-destructive: merges items by unique ID / title, preserves both if conflicted
  | 'keep_local'          // Keeps this device's records in any conflict
  | 'overwrite_incoming'; // Replaces local records with incoming device records

// ==========================================
// 1. PERSONAL BEST SYSTEM TYPES
// ==========================================

export type PersonalBestMetricId =
  | 'highest_mock_score'           // Highest mock-exam score
  | 'highest_mcq_accuracy'          // Highest MCQ accuracy (%)
  | 'highest_subjective_score'      // Highest subjective-answer score (% or marks)
  | 'fastest_test_completion'       // Fastest completion of a specific test
  | 'best_time_per_question'        // Best time-per-question
  | 'longest_study_session'         // Longest high-quality study session
  | 'most_productive_day'           // Most productive study day (minutes/hours)
  | 'most_productive_week'          // Most productive study week
  | 'most_chapters_week'            // Most chapters completed in one week
  | 'most_mistakes_corrected'       // Most mistakes corrected
  | 'best_subject_improvement'      // Best subject improvement
  | 'highest_topic_mastery'         // Highest topic mastery score
  | 'longest_study_streak'          // Longest study consistency streak
  | 'best_full_paper_performance';  // Best full-paper performance

export interface PersonalBestRecord {
  metricId: PersonalBestMetricId;
  title: string;
  category: 'testing' | 'speed' | 'endurance' | 'productivity' | 'mastery';
  currentValue: number;
  currentFormatted: string;
  previousValue?: number;
  previousFormatted?: string;
  improvementDelta?: number;
  improvementFormatted?: string;
  unit: string;
  subjectName?: string;
  topicName?: string;
  dateAchieved: string; // YYYY-MM-DD
  context: string;      // Specific context (e.g., "Physics Mock Paper 2", "Chapter 3 Quiz")
  isNewRecord?: boolean;
  history?: Array<{
    date: string;
    value: number;
    formatted: string;
    context: string;
  }>;
}

export interface SubjectPersonalBests {
  subjectName: string;
  highestScore: number;
  previousHighestScore?: number;
  improvementPoints?: number;
  bestDate: string;
  bestTestTitle: string;
  highestAccuracyMcq?: number;
  fastestPaceMinutesPerMark?: number;
  masteredTopicsCount: number;
}

// ==========================================
// 2. ACADEMIC MILESTONES SYSTEM TYPES
// ==========================================

export type AcademicMilestoneId =
  | 'first_100_questions'
  | 'first_perfect_quiz'
  | 'first_7day_streak'
  | 'first_chapter_mastered'
  | 'first_verified_mastery'
  | 'first_80_mock'
  | 'first_90_mock'
  | '50_mistakes_corrected'
  | '100_mistakes_corrected'
  | 'first_complete_past_paper'
  | 'first_full_syllabus'
  | 'recovery_after_falling_behind'
  | 'first_subject_90_mastery'
  | '250_questions_mastered'
  | 'first_14day_streak';

export interface AcademicMilestoneRecord {
  id: AcademicMilestoneId;
  title: string;
  description: string;
  unlocked: boolean;
  dateAchieved?: string; // YYYY-MM-DD
  subject?: string;
  topic?: string;
  relevantScore?: string | number;
  academicContext: string;
  category: 'rigor' | 'mastery' | 'consistency' | 'resilience';
  progressCurrent: number;
  progressTarget: number;
}

// ==========================================
// 3. THINGS I KEEP FORGETTING (RECURRING WEAKNESSES)
// ==========================================

export interface RecurringWeaknessItem {
  id: string;
  conceptName: string;
  subjectName: string;
  topicName?: string;
  chapterName?: string;
  mistakeCount: number;         // e.g. 6 (Wrong 6 times)
  firstOccurrenceDate: string;   // YYYY-MM-DD
  mostRecentOccurrenceDate: string; // YYYY-MM-DD
  mostRecentDisplay: string;    // "Today", "2 days ago", "4 days ago"
  currentMasteryPercentage: number;
  currentMasteryStatus: TopicStatus;
  lastSuccessfulRecall?: string; // e.g. "None yet", "2 days ago"
  relatedChapters: string[];
  recommendedIntervention: string;
  cognitiveCategory?: CognitiveErrorCategory;
  representativeMistakeId?: string;
  sampleQuestion?: string;
  sampleTrapDetail?: string;
  isPersistent: boolean; // Distinguishes repeated mistakes (true) vs one-time slips (false)
}

// ==========================================
// 4. CALENDAR & AI PLANNER CONFLICT RESOLUTION
// ==========================================

export type ScheduleConflictType = 
  | 'time_overlap'          // Multiple events scheduled simultaneously
  | 'daily_overcapacity'     // Study plan exceeds student daily hours
  | 'exam_day_overload'      // Heavy new topics scheduled right on an exam day
  | 'assignment_clash'       // Homework/assignment deadline clashing with study session
  | 'overdue_uncompleted'    // Past uncompleted tasks requiring catch-up
  | 'back_to_back_fatigue';  // Over 90m unbroken study without rest buffer

export type ScheduleConflictSeverity = 'critical' | 'warning' | 'info';

export interface ScheduleConflictAffectedItem {
  id: string;
  name: string;
  subject?: string;
  time?: string;
  duration?: number;
  date?: string;
  type: 'plan_topic' | 'calendar_event' | 'assignment' | 'exam' | 'revision';
}

export interface ScheduleConflict {
  id: string;
  type: ScheduleConflictType;
  severity: ScheduleConflictSeverity;
  date: string;
  title: string;
  description: string;
  affectedItems: ScheduleConflictAffectedItem[];
  suggestedResolution: string;
  autoResolvable: boolean;
}

export interface ScheduleRescheduleProposal {
  taskId: string;
  taskName: string;
  subjectName: string;
  originalDate: string;
  originalStartTime?: string;
  originalEndTime?: string;
  proposedDate: string;
  proposedStartTime: string;
  proposedEndTime: string;
  durationMinutes: number;
  reason: string;
  selected: boolean;
}

export interface ScheduleDiagnosisSummary {
  conflicts: ScheduleConflict[];
  criticalCount: number;
  warningCount: number;
  overloadedDays: string[];
  totalOverloadedMinutes: number;
  proposals: ScheduleRescheduleProposal[];
}

// ==========================================
// 5. 24-HOUR PRE-EXAM TRIAGE & EMERGENCY CRAM SHEET
// ==========================================

export interface CriticalFormulaEntry {
  id: string;
  label: string;
  formula: string;
  trapNote: string;
  unitConstraint?: string;
  topicName?: string;
}

export interface MistakeTrapWarning {
  id: string;
  concept: string;
  warning: string;
  mistakeCount: number;
  examQuestionSnippet?: string;
}

export interface HighYieldDefinition {
  id: string;
  term: string;
  definition: string;
  keyPhrases: string[];
}

export interface EmergencyConfidenceQuestion {
  id: string;
  question: string;
  answer: string;
  keyTrap: string;
  subjectName: string;
  topicName: string;
}

export interface EmergencyCramSheet {
  id: string;
  examId?: string;
  subjectName: string;
  examTitle: string;
  examDate: string;
  hoursRemaining: number;
  triageClassification: {
    protectTopics: string[];    // High confidence: Don't over-study, protect marks
    cramTopics: string[];       // Volatile / Mistake-prone: Highest ROI to review now
    shelveTopics: string[];     // Lost causes or very low yield: Drop to prevent panic
  };
  criticalFormulas: CriticalFormulaEntry[];
  mistakeTrapsToAvoid: MistakeTrapWarning[];
  highYieldDefinitions: HighYieldDefinition[];
  examinerKeywordAlerts: string[];
  confidencePrimerQuestions: EmergencyConfidenceQuestion[];
  confidenceScore: number;
  createdAt: string;
  customNotes?: string;
}
