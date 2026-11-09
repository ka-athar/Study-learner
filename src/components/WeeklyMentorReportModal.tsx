import React, { useState, useEffect } from 'react';
import { 
  Award, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Copy, 
  Download, 
  FileText, 
  Printer, 
  Sparkles, 
  X, 
  Send, 
  Check, 
  BookOpen, 
  Flame, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { StudyPlan } from '../types';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface WeeklyMentorReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: StudyPlan[];
  userEmail?: string;
}

interface HabitDay {
  hoursMet: boolean;
  flashcardsDone: boolean;
  problemSetsDone: boolean;
  deepFocusDone: boolean;
}

export const WeeklyMentorReportModal: React.FC<WeeklyMentorReportModalProps> = ({
  isOpen,
  onClose,
  plans = [],
  userEmail = 'Student'
}) => {
  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = current week, -1 = last week
  const [mentorNotes, setMentorNotes] = useState<string>(() => {
    return localStorage.getItem('studyflow_mentor_notes') || '';
  });
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);

  // Habit Tracker State for the 7 days of the selected week
  const [habits, setHabits] = useState<Record<string, HabitDay>>(() => {
    try {
      const saved = localStorage.getItem('studyflow_weekly_habits');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('studyflow_weekly_habits', JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem('studyflow_mentor_notes', mentorNotes);
  }, [mentorNotes]);

  if (!isOpen) return null;

  // Calculate dates for current week
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
  const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + distanceToMonday + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  const daysOfWeek: Array<{ label: string; dateStr: string; dayName: string }> = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    daysOfWeek.push({
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      dateStr,
      dayName: dayNames[i]
    });
  }

  const weekStartStr = daysOfWeek[0].dateStr;
  const weekEndStr = daysOfWeek[6].dateStr;

  // Filter plans for this week
  const weekPlans = plans.filter(p => p.date && p.date >= weekStartStr && p.date <= weekEndStr);
  const allWeekTopics = weekPlans.flatMap(p => p.topics || []);
  const completedTopics = allWeekTopics.filter(t => t.completed);
  const completionRate = allWeekTopics.length > 0 
    ? Math.round((completedTopics.length / allWeekTopics.length) * 100) 
    : 0;

  const totalMinutesStudied = completedTopics.reduce((acc, t) => acc + (t.estimatedMinutes || 45), 0);
  const totalHoursStudied = (totalMinutesStudied / 60).toFixed(1);

  // Toggle habit checkbox
  const toggleHabit = (dateStr: string, field: keyof HabitDay) => {
    setHabits(prev => {
      const current = prev[dateStr] || {
        hoursMet: false,
        flashcardsDone: false,
        problemSetsDone: false,
        deepFocusDone: false
      };
      return {
        ...prev,
        [dateStr]: {
          ...current,
          [field]: !current[field]
        }
      };
    });
  };

  // Generate formatted text report for mentor
  const generateReportText = (): string => {
    const header = `=====================================================
STUDYFLOW WEEKLY ACADEMIC PROGRESS REPORT
Student: ${userEmail}
Week: ${weekStartStr} to ${weekEndStr}
Generated: ${new Date().toLocaleDateString()}
=====================================================

1. EXECUTIVE SUMMARY:
• Completion Rate: ${completionRate}% (${completedTopics.length} of ${allWeekTopics.length} topics finished)
• Total Study Hours Logged: ${totalHoursStudied} hours
• Active Study Days: ${weekPlans.length} days planned

2. TOPICS COMPLETED THIS WEEK:
${completedTopics.length > 0 ? completedTopics.map(t => `  ✓ [${t.subjectName}] ${t.topicName} (${t.estimatedMinutes || 45}m)`).join('\n') : '  (No topics marked complete yet)'}

3. INCOMPLETE / IN-PROGRESS TOPICS:
${allWeekTopics.filter(t => !t.completed).length > 0 ? allWeekTopics.filter(t => !t.completed).map(t => `  ⏳ [${t.subjectName}] ${t.topicName} (Scheduled: ${t.date})`).join('\n') : '  ✓ 100% of planned topics completed!'}

4. HABIT & FOCUS TRACKER:
${daysOfWeek.map(d => {
  const h = habits[d.dateStr] || { hoursMet: false, flashcardsDone: false, problemSetsDone: false, deepFocusDone: false };
  const doneCount = Object.values(h).filter(Boolean).length;
  return `  • ${d.dayName} (${d.label}): ${doneCount}/4 habits met [Hours: ${h.hoursMet ? '✓' : '✗'} | Cards: ${h.flashcardsDone ? '✓' : '✗'} | Practice: ${h.problemSetsDone ? '✓' : '✗'} | Focus: ${h.deepFocusDone ? '✓' : '✗'}]`;
}).join('\n')}

5. STUDENT REFLECTION / NOTES FOR MENTOR:
${mentorNotes.trim() ? mentorNotes.trim() : '(No special notes added)'}

=====================================================
Status: Report verified and ready for senior review.`;

    return header;
  };

  const handleCopyReport = () => {
    const text = generateReportText();
    navigator.clipboard.writeText(text);
    setCopiedNotice(true);
    triggerStudyGoalConfetti();
    setTimeout(() => setCopiedNotice(false), 4000);
  };

  const handleDownloadReport = () => {
    const text = generateReportText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mentor_Report_${weekStartStr}_to_${weekEndStr}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    triggerStudyGoalConfetti();
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-[#E0DBD0] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E0DBD0] flex items-center justify-between bg-[#F9F7F2]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-2xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2B2D42] flex items-center gap-2">
                <span>Weekly Mentor Academic Report & Habit Box</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono font-bold">Option E</span>
              </h2>
              <p className="text-xs text-[#6B705C]">
                Track weekly consistency, log core study habits, and generate verified reports for your seniors & mentors.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-[#F2EFE9] border border-[#E0DBD0] text-[#6B705C] flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Week Selector Bar */}
        <div className="px-6 py-3 bg-[#F2EFE9] border-b border-[#E0DBD0] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-mono font-bold text-[#2B2D42]">
            <Calendar className="w-3.5 h-3.5 text-[#6B705C]" />
            <span>Week: {weekStartStr} ➔ {weekEndStr}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="px-2.5 py-1 rounded-xl bg-white border border-[#E0DBD0] text-[#2B2D42] hover:bg-[#F9F7F2] font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev Week</span>
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className="px-2.5 py-1 rounded-xl bg-white border border-[#E0DBD0] text-[#2B2D42] hover:bg-[#F9F7F2] font-medium transition cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              Current Week
            </button>
            <button
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="px-2.5 py-1 rounded-xl bg-white border border-[#E0DBD0] text-[#2B2D42] hover:bg-[#F9F7F2] font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <span>Next Week</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
              <div className="text-[10px] font-bold text-emerald-800 uppercase font-mono">Completion Rate</div>
              <div className="text-xl font-bold text-emerald-950">{completionRate}%</div>
              <div className="text-[10px] text-emerald-700 font-medium">{completedTopics.length} of {allWeekTopics.length} topics</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-1">
              <div className="text-[10px] font-bold text-blue-800 uppercase font-mono">Hours Logged</div>
              <div className="text-xl font-bold text-blue-950">{totalHoursStudied} hrs</div>
              <div className="text-[10px] text-blue-700 font-medium">{totalMinutesStudied} active minutes</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-1">
              <div className="text-[10px] font-bold text-purple-800 uppercase font-mono">Planned Days</div>
              <div className="text-xl font-bold text-purple-950">{weekPlans.length} / 7</div>
              <div className="text-[10px] text-purple-700 font-medium">Scheduled study days</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1">
              <div className="text-[10px] font-bold text-amber-800 uppercase font-mono">Accountability</div>
              <div className="text-xl font-bold text-amber-950 flex items-center gap-1">
                <Flame className="w-5 h-5 text-amber-600 fill-amber-500" />
                <span>Ready</span>
              </div>
              <div className="text-[10px] text-amber-700 font-medium">Verified for senior</div>
            </div>
          </div>

          {/* Daily Habit Tracking Box */}
          <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[#2B2D42] text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Weekly Daily Habit Box (Check Off As You Study)</span>
              </div>
              <span className="text-[10px] text-[#6B705C] font-mono">Persists Automatically</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-[#E0DBD0] text-[10px] text-[#A5A58D] uppercase font-mono">
                    <th className="pb-2 font-bold">Habit Target</th>
                    {daysOfWeek.map(d => (
                      <th key={d.dateStr} className="pb-2 text-center font-bold">
                        <div>{d.dayName}</div>
                        <div className="text-[9px] font-normal lowercase">{d.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0DBD0]/60 text-[11px]">
                  <tr>
                    <td className="py-2.5 font-medium text-[#2B2D42] flex items-center gap-1.5">
                      <span>🎯</span>
                      <span>Target Hours Completed</span>
                    </td>
                    {daysOfWeek.map(d => {
                      const h = habits[d.dateStr] || { hoursMet: false };
                      return (
                        <td key={d.dateStr} className="py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(h.hoursMet)}
                            onChange={() => toggleHabit(d.dateStr, 'hoursMet')}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                      );
                    })}
                  </tr>

                  <tr>
                    <td className="py-2.5 font-medium text-[#2B2D42] flex items-center gap-1.5">
                      <span>🧠</span>
                      <span>Flashcard Repetition Done</span>
                    </td>
                    {daysOfWeek.map(d => {
                      const h = habits[d.dateStr] || { flashcardsDone: false };
                      return (
                        <td key={d.dateStr} className="py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(h.flashcardsDone)}
                            onChange={() => toggleHabit(d.dateStr, 'flashcardsDone')}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                        </td>
                      );
                    })}
                  </tr>

                  <tr>
                    <td className="py-2.5 font-medium text-[#2B2D42] flex items-center gap-1.5">
                      <span>📝</span>
                      <span>Practice Questions Solved</span>
                    </td>
                    {daysOfWeek.map(d => {
                      const h = habits[d.dateStr] || { problemSetsDone: false };
                      return (
                        <td key={d.dateStr} className="py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(h.problemSetsDone)}
                            onChange={() => toggleHabit(d.dateStr, 'problemSetsDone')}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                      );
                    })}
                  </tr>

                  <tr>
                    <td className="py-2.5 font-medium text-[#2B2D42] flex items-center gap-1.5">
                      <span>📵</span>
                      <span>Deep Focus (No Phone / Distractions)</span>
                    </td>
                    {daysOfWeek.map(d => {
                      const h = habits[d.dateStr] || { deepFocusDone: false };
                      return (
                        <td key={d.dateStr} className="py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(h.deepFocusDone)}
                            onChange={() => toggleHabit(d.dateStr, 'deepFocusDone')}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Student Reflection & Notes for Senior */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-[#2B2D42] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Notes & Academic Reflection for Mentor / Senior</span>
              </label>
              <span className="text-[10px] text-[#A5A58D]">Included in exported report</span>
            </div>
            <textarea
              rows={3}
              value={mentorNotes}
              onChange={(e) => setMentorNotes(e.target.value)}
              placeholder="e.g. Completed Chapter 10 Animalia and Organic Reactions; felt confident with reaction mechanisms, plan to solve 20 additional numerical problems next week..."
              className="w-full p-3 rounded-2xl border border-[#E0DBD0] bg-white text-xs text-[#2B2D42] focus:outline-hidden focus:ring-1 focus:ring-indigo-500 placeholder:text-[#A5A58D]"
            />
          </div>

          {/* Copy Notice Alert */}
          {copiedNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>✓ Mentor Progress Report copied to clipboard! You can paste it directly into WhatsApp, Slack, Gmail, or Discord.</span>
            </div>
          )}

          {/* Export Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E0DBD0]">
            <div className="text-[11px] text-[#6B705C] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Formatted for WhatsApp, Slack, Gmail, or printed submission.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintReport}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F9F7F2] text-[#2B2D42] border border-[#E0DBD0] font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Print report or save as PDF"
              >
                <Printer className="w-3.5 h-3.5 text-[#6B705C]" />
                <span>Print / PDF</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadReport}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F9F7F2] text-[#2B2D42] border border-[#E0DBD0] font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Download report as .txt file"
              >
                <Download className="w-3.5 h-3.5 text-[#6B705C]" />
                <span>Download .txt</span>
              </button>

              <button
                type="button"
                onClick={handleCopyReport}
                className="px-4 py-2 rounded-xl bg-[#2B2D42] hover:bg-[#1E202F] text-white font-bold text-xs transition cursor-pointer flex items-center gap-2 shadow-xs"
                title="Copy formatted text to clipboard"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Mentor Report</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
