import React, { useState } from 'react';
import { 
  Target, 
  Clock, 
  Calendar, 
  FileText, 
  Upload, 
  Play, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Award, 
  ChevronRight,
  BookOpen,
  ArrowRight,
  Zap,
  Filter,
  Layers,
  Plus
} from 'lucide-react';
import { 
  Subject, 
  StudyPlan, 
  StudySession, 
  TestResult, 
  ScheduledStudyTask, 
  ExamDate, 
  UserProfile, 
  ActiveTab,
  TestPreparationTimeline 
} from '../types';
import { TestPreparationTimelineCard } from './TestPreparationTimelineCard';
import { PDFExamPracticeStation } from './PDFExamPracticeStation';
import { ThingsIKeepForgettingCard } from './ThingsIKeepForgettingCard';
import { detectRecurringWeaknesses, evaluatePersonalBests } from '../lib/academicMasteryEngine';
import { loadMistakes } from '../lib/mistakeVaultStorage';

interface TestPreparationViewProps {
  subjects: Subject[];
  testResults?: TestResult[];
  plans?: StudyPlan[];
  sessions?: StudySession[];
  examDates?: ExamDate[];
  userProfile?: UserProfile | null;
  onAddTestResult: (test: Omit<TestResult, 'id'>) => void;
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string, durationMinutes?: number) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onSavePlan?: (plan: StudyPlan | Omit<StudyPlan, 'id'>) => Promise<void> | void;
}

export const TestPreparationView: React.FC<TestPreparationViewProps> = ({
  subjects,
  testResults = [],
  plans = [],
  sessions = [],
  examDates = [],
  userProfile = null,
  onAddTestResult,
  onStartTimerForTopic,
  onNavigateTab,
  onSavePlan
}) => {
  const [subMode, setSubMode] = useState<'overview' | 'pdf_station'>('overview');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');

  const recurringWeaknesses = React.useMemo(() => {
    return detectRecurringWeaknesses(loadMistakes(), testResults, [], [], subjects);
  }, [testResults, subjects]);

  const pbState = React.useMemo(() => {
    return evaluatePersonalBests(subjects, testResults, sessions);
  }, [subjects, testResults, sessions]);

  // Derive active preparation timelines from calendar plans and exam dates
  const timelines: TestPreparationTimeline[] = React.useMemo(() => {
    const list: TestPreparationTimeline[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. From Exam Dates in Profile
    if (Array.isArray(examDates) && examDates.length > 0) {
      examDates.forEach(ed => {
        const d = new Date(ed.date);
        d.setHours(0, 0, 0, 0);
        const diffMs = d.getTime() - today.getTime();
        const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        const targetSubject = subjects.find(s => (s.name || '').toLowerCase() === (ed.subject || '').toLowerCase()) || subjects[0];
        const allSlos = targetSubject ? targetSubject.chapters.flatMap(ch => ch.topics).length : 24;

        list.push({
          testId: `exam-date-${ed.id}`,
          testTitle: `${ed.subject} Official Board Paper`,
          subjectName: ed.subject,
          testDate: ed.date,
          daysRemaining: days,
          includedTopics: targetSubject?.chapters.flatMap(c => c.topics.map(t => t.name)) || ['Core Curriculum'],
          auditedSlos: [],
          preparationStatus: days < 7 ? 'critical_rush' : days < 15 ? 'needs_attention' : 'on_track',
          dailyTargetQuota: {
            recommendedHoursPerDay: days > 0 ? Number((Math.min(6, Math.max(1.5, 40 / days))).toFixed(1)) : 4.0,
            slosPerDay: days > 0 ? Math.max(1, Math.ceil(allSlos / days)) : 5,
            mistakeDrillsPerDay: 3
          },
          preparationPhases: [
            {
              phaseName: 'Foundation & Coverage',
              dateRange: 'Days 30 - 20',
              actionableTasks: ['Core Definitions', 'Textbook Derivations', 'Formula Synthesis'],
              isCurrentPhase: days > 20
            },
            {
              phaseName: 'Targeted 1-3-7 Deep Revision',
              dateRange: 'Days 20 - 10',
              actionableTasks: ['5-Year Past Paper Solves', 'Mark Scheme Traps', '2-Minute Timed Drills'],
              isCurrentPhase: days <= 20 && days > 10
            },
            {
              phaseName: 'Mistake Autopsy & Mock Papers',
              dateRange: 'Days 10 - 3',
              actionableTasks: ['Strict Time Simulation', 'Examiner Red Pen', 'Mistake Vault Autopsy'],
              isCurrentPhase: days <= 10 && days > 3
            },
            {
              phaseName: 'Pre-Exam High-Yield Sprint',
              dateRange: 'Days 3 - 0',
              actionableTasks: ['Formula Sheet Memory Recite', 'Quick Review Cards', 'Sleep & Peak Stamina'],
              isCurrentPhase: days <= 3
            }
          ]
        });
      });
    }

    // 2. Synthesize default subject timelines if none configured
    if (list.length === 0) {
      subjects.slice(0, 3).forEach((s, idx) => {
        const days = 14 + idx * 7;
        const allSlos = s.chapters.flatMap(c => c.topics).length || 18;
        list.push({
          testId: `default-test-${s.id}`,
          testTitle: `${s.name} Mid-Term & Board Assessment`,
          subjectName: s.name,
          testDate: new Date(Date.now() + days * 86400000).toISOString().split('T')[0],
          daysRemaining: days,
          includedTopics: s.chapters.flatMap(c => c.topics.map(t => t.name)),
          auditedSlos: [],
          preparationStatus: days < 7 ? 'critical_rush' : days < 15 ? 'needs_attention' : 'on_track',
          dailyTargetQuota: {
            recommendedHoursPerDay: 2.5,
            slosPerDay: Math.max(1, Math.ceil(allSlos / days)),
            mistakeDrillsPerDay: 2
          },
          preparationPhases: [
            {
              phaseName: 'Foundation & Coverage',
              dateRange: 'Week 1',
              actionableTasks: ['Chapter Definitions', 'Core Formulations', 'Syllabus Mapping'],
              isCurrentPhase: true
            },
            {
              phaseName: 'Targeted 1-3-7 Deep Revision',
              dateRange: 'Week 2',
              actionableTasks: ['Topical Exam Questions', 'Error Logs', 'Speed Drills'],
              isCurrentPhase: false
            },
            {
              phaseName: 'Mistake Autopsy & Mock Papers',
              dateRange: 'Week 3',
              actionableTasks: ['Standard Time Practice', 'Mistake Autopsy', 'Score Recovery'],
              isCurrentPhase: false
            },
            {
              phaseName: 'Pre-Exam High-Yield Sprint',
              dateRange: 'Final 48 Hrs',
              actionableTasks: ['Formula Recite', 'High-Yield Cram Sheets'],
              isCurrentPhase: false
            }
          ]
        });
      });
    }

    return list;
  }, [examDates, subjects]);

  const filteredTimelines = subjectFilter === 'all'
    ? timelines
    : timelines.filter(t => (t.subjectName || '').toLowerCase() === subjectFilter.toLowerCase());

  return (
    <div className="space-y-6 animate-fade-in text-[#2B2D42]">
      {/* Header Banner */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-mono font-bold">
              Targeted Exam Engine
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
              Idea 2 Enabled: PDF + Split Timer
            </span>
          </div>
          <h2 className="text-xl font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
            <Target className="w-5 h-5 text-[#6B705C]" />
            <span>Test Preparation & Timed Exam Station</span>
          </h2>
          <p className="text-xs text-[#8A8F80] mt-1 max-w-2xl">
            Track strategic backward-planning countdowns for upcoming board examinations, solve question paper PDFs side-by-side with an integrated timer, and maintain persistent study pacing.
          </p>
        </div>

        {/* Top Control Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSubMode('overview')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              subMode === 'overview'
                ? 'bg-[#2D312E] text-white shadow-xs'
                : 'bg-[#F2EFE9] text-[#6B705C] hover:bg-[#EAE7DF] border border-[#E0DBD0]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Exam Timelines ({timelines.length})</span>
          </button>

          <button
            onClick={() => setSubMode('pdf_station')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              subMode === 'pdf_station'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>📄 PDF Exam Practice Station</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Mode */}
      {subMode === 'pdf_station' ? (
        <PDFExamPracticeStation
          subjects={subjects}
          onSaveTestResult={onAddTestResult}
          onClose={() => setSubMode('overview')}
        />
      ) : (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F9F7F2] p-3 rounded-2xl border border-[#E0DBD0]">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#8A8F80]" />
              <span className="text-xs font-mono font-bold text-[#6B705C]">Filter By Subject:</span>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="px-2.5 py-1 rounded-xl text-xs border border-[#E0DBD0] bg-white text-[#2B2D42]"
              >
                <option value="all">All Subjects ({timelines.length})</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Quick Practice Launcher Banner */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSubMode('pdf_station')}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Play className="w-3 h-3" />
                <span>Launch PDF Practice Session</span>
              </button>
            </div>
          </div>

          {/* Pre-Exam Weakness Check: Blind spots to eradicate before sitting papers */}
          <ThingsIKeepForgettingCard
            weaknesses={recurringWeaknesses}
            compact={true}
          />

          {/* Timelines Cards Grid */}
          {filteredTimelines.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredTimelines.map(timeline => (
                <TestPreparationTimelineCard
                  key={timeline.testId}
                  timeline={timeline}
                  onStartTimerForTopic={(subj, ch, top) => onStartTimerForTopic(subj, ch, top, 45)}
                  onNavigateTab={onNavigateTab}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-[#E0DBD0] rounded-3xl p-10 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-base font-bold text-[#2B2D42]">No Test Schedules Found</h3>
              <p className="text-xs text-[#8A8F80] max-w-sm mx-auto">
                Configure exam dates in your profile or launch a timed practice paper directly using the PDF Exam Station.
              </p>
              <button
                onClick={() => setSubMode('pdf_station')}
                className="px-4 py-2 rounded-2xl bg-[#6B705C] text-white text-xs font-bold hover:bg-[#5a5f4e] transition"
              >
                Open PDF Exam Practice Station
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
