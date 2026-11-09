import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Calendar as CalendarIcon, 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ArrowRight, 
  Layers, 
  Zap, 
  RotateCcw, 
  Flame,
  Award,
  Check,
  Sliders
} from 'lucide-react';
import { Subject, StudyPlan, StudyPlanTopic, UserProfile, ExamDate } from '../types';

interface SyllabusAutoAllocatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  plans: StudyPlan[];
  userProfile: UserProfile | null;
  onBatchSavePlans: (plans: Array<StudyPlan | Omit<StudyPlan, 'id'>>) => Promise<void> | void;
  onAddTo137Cycle?: (subjectName: string, chapterName: string, topicName: string, initialDate?: string) => void;
}

export const SyllabusAutoAllocatorModal: React.FC<SyllabusAutoAllocatorModalProps> = ({
  isOpen,
  onClose,
  subjects,
  plans,
  userProfile,
  onBatchSavePlans,
  onAddTo137Cycle
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [targetPacing, setTargetPacing] = useState<'exam_date' | '30_days' | '60_days' | 'custom'>('30_days');
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [includeWeekends, setIncludeWeekends] = useState<boolean>(true);
  const [topicsPerDay, setTopicsPerDay] = useState<number>(2);
  const [autoLink137, setAutoLink137] = useState<boolean>(true);
  const [isAllocating, setIsAllocating] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  // Find upcoming exams
  const exams = userProfile?.examDates || [];
  const nextExam = exams.length > 0 ? exams[0] : null;

  // Extract all uncompleted topics
  const uncompletedTopics = useMemo(() => {
    const list: Array<{ subjectName: string; chapterName: string; topicName: string; estimatedMinutes: number }> = [];
    
    subjects.forEach(sub => {
      if (selectedSubject !== 'all' && sub.name !== selectedSubject) return;
      (sub.chapters || []).forEach(ch => {
        (ch.topics || []).forEach(t => {
          if (t.status !== 'Completed' && t.status !== 'Mastered') {
            list.push({
              subjectName: sub.name,
              chapterName: ch.name || 'Core Curriculum',
              topicName: t.name,
              estimatedMinutes: t.timeSpentMinutes ? Math.max(30, t.timeSpentMinutes) : 45
            });
          }
        });
      });
    });

    return list;
  }, [subjects, selectedSubject]);

  // Determine study dates range
  const dateRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let endDate = new Date(today);
    if (targetPacing === 'exam_date' && nextExam?.date) {
      endDate = new Date(nextExam.date);
    } else if (targetPacing === '30_days') {
      endDate.setDate(today.getDate() + 30);
    } else if (targetPacing === '60_days') {
      endDate.setDate(today.getDate() + 60);
    } else if (targetPacing === 'custom' && customEndDate) {
      endDate = new Date(customEndDate);
    } else {
      endDate.setDate(today.getDate() + 30);
    }

    if (endDate <= today) {
      endDate = new Date(today);
      endDate.setDate(today.getDate() + 14);
    }

    const availableDates: string[] = [];
    const curr = new Date(today);
    while (curr <= endDate) {
      const dayOfWeek = curr.getDay(); // 0 is Sunday, 6 is Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (includeWeekends || !isWeekend) {
        availableDates.push(curr.toISOString().split('T')[0]);
      }
      curr.setDate(curr.getDate() + 1);
    }

    return availableDates;
  }, [targetPacing, nextExam, customEndDate, includeWeekends]);

  // Preview allocation statistics
  const previewStats = useMemo(() => {
    const totalTopics = uncompletedTopics.length;
    const totalDays = Math.max(1, dateRange.length);
    const avgTopicsPerDay = Number((totalTopics / totalDays).toFixed(1));
    const totalEstimatedMinutes = uncompletedTopics.reduce((acc, t) => acc + t.estimatedMinutes, 0);
    const totalEstimatedHours = Number((totalEstimatedMinutes / 60).toFixed(1));
    const dailyStudyHours = Number((totalEstimatedHours / totalDays).toFixed(1));

    return {
      totalTopics,
      totalDays,
      avgTopicsPerDay,
      totalEstimatedHours,
      dailyStudyHours
    };
  }, [uncompletedTopics, dateRange]);

  const handleRunAutoAllocation = async () => {
    if (uncompletedTopics.length === 0) return;
    setIsAllocating(true);
    setSuccessNotice(null);

    try {
      const plansToSave: Array<StudyPlan | Omit<StudyPlan, 'id'>> = [];
      const totalAvailableDays = dateRange.length;
      
      // Evenly distribute topics across available dates
      const dateMap: { [dateStr: string]: typeof uncompletedTopics } = {};
      dateRange.forEach(d => { dateMap[d] = []; });

      uncompletedTopics.forEach((topic, idx) => {
        // Distribute proportionally across available days
        const dayIdx = Math.min(
          totalAvailableDays - 1, 
          Math.floor((idx / Math.max(1, uncompletedTopics.length)) * totalAvailableDays)
        );
        const targetDate = dateRange[dayIdx];
        if (targetDate) {
          dateMap[targetDate].push(topic);
        }
      });

      // Construct StudyPlan payloads for dates with topics
      Object.entries(dateMap).forEach(([dateStr, topicsForDate]) => {
        if (topicsForDate.length === 0) return;

        const planTopics: StudyPlanTopic[] = topicsForDate.map((t, idx) => ({
          id: `alloc-topic-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          subjectName: t.subjectName,
          chapterName: t.chapterName,
          topicName: t.topicName,
          estimatedMinutes: t.estimatedMinutes,
          priority: idx === 0 ? 'High' : 'Medium',
          reason: `Auto-allocated from ${t.subjectName} curriculum (${dateStr})`,
          completed: false
        }));

        const totalMinutes = planTopics.reduce((acc, t) => acc + t.estimatedMinutes, 0);

        plansToSave.push({
          userId: userProfile?.uid || 'user_primary',
          date: dateStr,
          title: `${topicsForDate.length} Focus Topics (${topicsForDate[0].subjectName})`,
          reasoning: `Intelligently paced across ${dateRange.length} study days to complete curriculum before target deadline.`,
          availableHours: Number((totalMinutes / 60).toFixed(1)),
          createdAt: new Date().toISOString(),
          topics: planTopics
        });

        // Optionally link to 1-3-7 Spaced Cycle
        if (autoLink137 && onAddTo137Cycle) {
          topicsForDate.forEach(t => {
            onAddTo137Cycle(t.subjectName, t.chapterName, t.topicName, dateStr);
          });
        }
      });

      // Atomically batch save all plans to Firestore & Local Storage
      await onBatchSavePlans(plansToSave);

      setSuccessNotice(`🎉 Successfully allocated ${uncompletedTopics.length} syllabus topics across ${plansToSave.length} days into your Academic Calendar!`);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error("Auto-allocation error:", err);
    } finally {
      setIsAllocating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative text-[#4A4E4D] space-y-6 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#6B705C]/15 text-[#6B705C] flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[#6B705C] tracking-wider font-mono">
                1-Click Calendar Optimizer
              </div>
              <h3 className="text-lg font-serif italic font-bold text-[#6B705C]">
                Syllabus-to-Calendar Auto-Allocator
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A5A58D] hover:text-[#4A4E4D] rounded-xl hover:bg-[#F9F7F2] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successNotice && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Subject Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#6B705C] uppercase tracking-wider block">
              1. Select Subject Scope
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-hidden"
            >
              <option value="all">All Curriculum Subjects ({uncompletedTopics.length} topics)</option>
              {subjects.map(s => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Target Horizon */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#6B705C] uppercase tracking-wider block">
              2. Pacing Deadline
            </label>
            <select
              value={targetPacing}
              onChange={(e) => setTargetPacing(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-hidden"
            >
              {nextExam && (
                <option value="exam_date">
                  Before {nextExam.subjectName} Exam ({nextExam.date})
                </option>
              )}
              <option value="30_days">Pace across next 30 days</option>
              <option value="60_days">Pace across next 60 days</option>
              <option value="custom">Custom target date...</option>
            </select>
          </div>
        </div>

        {/* Custom Date Input */}
        {targetPacing === 'custom' && (
          <div className="space-y-1.5 p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0]">
            <label className="text-xs font-bold text-[#6B705C]">Custom Completion Date</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
            />
          </div>
        )}

        {/* Pacing Preferences */}
        <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-3">
          <div className="text-xs font-bold text-[#6B705C] uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" />
            <span>Allocation Preferences</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9] transition">
              <input
                type="checkbox"
                checked={includeWeekends}
                onChange={(e) => setIncludeWeekends(e.target.checked)}
                className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0]"
              />
              <div>
                <div className="font-bold">Include Weekends</div>
                <div className="text-[10px] text-[#A5A58D]">Distribute study sessions onto Sat & Sun</div>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9] transition">
              <input
                type="checkbox"
                checked={autoLink137}
                onChange={(e) => setAutoLink137(e.target.checked)}
                className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0]"
              />
              <div>
                <div className="font-bold">Link 1-3-7 Spaced Cycle</div>
                <div className="text-[10px] text-[#A5A58D]">Auto-schedules Day 1, 3, and 7 reviews</div>
              </div>
            </label>
          </div>
        </div>

        {/* Live Allocation Preview Metrics */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
          <div className="text-xs font-bold text-amber-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-700" />
              <span>Smart Pacing Calculation</span>
            </span>
            <span className="font-mono text-xs">{previewStats.totalDays} Days Available</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-2">
            <div className="p-2.5 rounded-xl bg-white border border-amber-200">
              <div className="text-[10px] text-[#A5A58D] font-mono">Topics to Allocate</div>
              <div className="text-base font-extrabold text-[#4A4E4D]">{previewStats.totalTopics}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-amber-200">
              <div className="text-[10px] text-[#A5A58D] font-mono">Daily Pace</div>
              <div className="text-base font-extrabold text-[#6B705C]">~{previewStats.avgTopicsPerDay} topics/d</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-amber-200">
              <div className="text-[10px] text-[#A5A58D] font-mono">Daily Study Time</div>
              <div className="text-base font-extrabold text-indigo-700">~{previewStats.dailyStudyHours} hrs/d</div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E0DBD0]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[#A5A58D] hover:text-[#4A4E4D]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRunAutoAllocation}
            disabled={isAllocating || uncompletedTopics.length === 0}
            className="px-6 py-2.5 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-bold text-xs transition flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isAllocating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Allocating {uncompletedTopics.length} Topics...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>Auto-Allocate {uncompletedTopics.length} Topics to Calendar</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
