import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  CheckCircle2, 
  Clock, 
  Flame, 
  BookOpen, 
  ShieldCheck, 
  FileText, 
  Edit3, 
  Sparkles,
  Award
} from 'lucide-react';
import { Subject, StudyPlan, UserProfile, RevisionItem } from '../types';

interface PrintableA4StudyDocketModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  plans: StudyPlan[];
  revisions: RevisionItem[];
  userProfile: UserProfile | null;
}

export const PrintableA4StudyDocketModal: React.FC<PrintableA4StudyDocketModalProps> = ({
  isOpen,
  onClose,
  subjects,
  plans,
  revisions,
  userProfile
}) => {
  const [includeRevisions, setIncludeRevisions] = useState<boolean>(true);
  const [targetHoursInput, setTargetHoursInput] = useState<number>(userProfile?.targetHoursPerDay || 4);
  const [customPledge, setCustomPledge] = useState<string>(
    'Phone is sealed in another room. Zero digital notifications. Pure active recall and paper problem-solving.'
  );

  if (!isOpen) return null;

  const todayDateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const todayIso = new Date().toISOString().split('T')[0];
  const todayPlan = plans.find(p => p.date === todayIso);
  const todayTopics = todayPlan?.topics || [];
  const pendingRevisions = revisions.filter(r => r.status === 'Pending').slice(0, 5);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-card border border-theme rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl relative text-primary space-y-4 max-h-[94vh] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none print:p-0 print:m-0 print:rounded-none">
        {/* Modal Controls (Hidden in print) */}
        <div className="flex items-center justify-between border-b border-theme pb-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-primary">Distraction-Free A4 Study Docket</h3>
              <p className="text-[11px] text-muted">Printable offline worksheet — study completely away from phone or iPad</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-primary text-primary-content hover:opacity-90 font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4 Docket</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-surface text-muted hover:text-primary transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Customization Options Bar (Hidden in print) */}
        <div className="p-3 rounded-2xl bg-surface border border-theme flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer font-bold">
              <input
                type="checkbox"
                checked={includeRevisions}
                onChange={(e) => setIncludeRevisions(e.target.checked)}
                className="rounded accent-primary"
              />
              <span>Include 1-3-7 Spaced Revisions</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-muted font-bold">Target Hours:</span>
              <input
                type="number"
                min={1}
                max={16}
                value={targetHoursInput}
                onChange={(e) => setTargetHoursInput(Number(e.target.value) || 1)}
                className="w-14 p-1 bg-card border border-theme rounded-lg text-xs font-mono font-bold text-center"
              />
              <span className="text-muted">hrs</span>
            </div>
          </div>

          <span className="text-[11px] text-muted italic">
            Formatted to fit crisp 100% on standard A4 / Letter paper
          </span>
        </div>

        {/* PRINTABLE A4 SHEET CONTAINER */}
        <div className="a4-sheet bg-white text-gray-900 border border-gray-300 rounded-2xl p-6 sm:p-8 space-y-6 print:border-none print:p-0 print:m-0 print:space-y-4 print:text-black">
          {/* Header */}
          <div className="border-b-2 border-gray-800 pb-4 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-gray-900 text-white font-mono text-[10px] font-bold uppercase tracking-wider">
                  StudyOS • Deep Focus Docket
                </span>
                <span className="text-xs font-serif italic text-gray-600">A4 Distraction-Free Edition</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-gray-900 mt-1">
                Daily Study & 1-3-7 Revision Docket
              </h1>
              <p className="text-xs text-gray-600 mt-0.5">
                Date: <strong>{todayDateStr}</strong> • Student: <strong>{userProfile?.displayName || 'Candidate'}</strong>
              </p>
            </div>

            <div className="text-right border border-gray-400 rounded-xl p-2.5 bg-gray-50 min-w-[130px]">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block">Target Goal</span>
              <span className="text-xl font-mono font-black text-gray-900">{targetHoursInput} Hours</span>
              <span className="text-[9px] text-gray-500 block">Planned Focus</span>
            </div>
          </div>

          {/* No-Phone Commitment Contract */}
          <div className="p-3 rounded-xl border border-gray-300 bg-gray-50/80 flex items-center justify-between text-xs gap-4">
            <div className="flex items-start gap-2">
              <span className="text-base">📵</span>
              <div>
                <strong className="block text-[11px] uppercase tracking-wider text-gray-800">Focus Pledge & Offline Protocol</strong>
                <p className="text-[11px] text-gray-700 italic">{customPledge}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 border-l border-gray-300 pl-3">
              <div className="w-4 h-4 border border-gray-500 rounded flex items-center justify-center font-bold text-xs" />
              <span className="text-[10px] font-bold text-gray-700">Phone Locked Away</span>
            </div>
          </div>

          {/* Table 1: Deep Work Blocks Schedule */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                <span>⏱️ Planned Deep Work Sessions (Fill in by hand)</span>
              </h2>
              <span className="text-[10px] text-gray-500 font-mono">Target: 4-6 Sprints</span>
            </div>

            <table className="w-full text-left text-xs border border-gray-400 border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-400 text-[10px] font-mono uppercase">
                  <th className="p-2 border-r border-gray-400 w-16">Time</th>
                  <th className="p-2 border-r border-gray-400">Subject & Topic Target</th>
                  <th className="p-2 border-r border-gray-400 w-16 text-center">Duration</th>
                  <th className="p-2 border-r border-gray-400 w-20 text-center">Focus (1-5)</th>
                  <th className="p-2 w-16 text-center">Done [✓]</th>
                </tr>
              </thead>
              <tbody>
                {todayTopics.length > 0 ? (
                  todayTopics.map((top, idx) => (
                    <tr key={idx} className="border-b border-gray-300">
                      <td className="p-2 border-r border-gray-300 font-mono text-[11px] text-gray-500">
                        ____:____
                      </td>
                      <td className="p-2 border-r border-gray-300">
                        <strong className="text-gray-900">{top.subjectName || 'Subject'}:</strong> {top.name}
                        {top.chapterName && <span className="text-gray-500 text-[10px] block font-serif">Ch: {top.chapterName}</span>}
                      </td>
                      <td className="p-2 border-r border-gray-300 text-center font-mono font-bold">
                        {top.durationMinutes || 45}m
                      </td>
                      <td className="p-2 border-r border-gray-300 text-center text-gray-400 font-mono">
                        ○ ○ ○ ○ ○
                      </td>
                      <td className="p-2 text-center">
                        <div className="w-4 h-4 border border-gray-600 rounded mx-auto" />
                      </td>
                    </tr>
                  ))
                ) : (
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b border-gray-300">
                      <td className="p-2.5 border-r border-gray-300 font-mono text-gray-400">____:____</td>
                      <td className="p-2.5 border-r border-gray-300 text-gray-400 italic">Topic {i}: _____________________________________</td>
                      <td className="p-2.5 border-r border-gray-300 text-center font-mono text-gray-400">___m</td>
                      <td className="p-2.5 border-r border-gray-300 text-center text-gray-400">○ ○ ○ ○ ○</td>
                      <td className="p-2.5 text-center">
                        <div className="w-4 h-4 border border-gray-400 rounded mx-auto" />
                      </td>
                    </tr>
                  ))
                )}
                {/* 2 blank extra rows for spontaneous sessions */}
                {[1, 2].map((i) => (
                  <tr key={`extra-${i}`} className="border-b border-gray-300">
                    <td className="p-2 border-r border-gray-300 font-mono text-gray-400">____:____</td>
                    <td className="p-2 border-r border-gray-300 text-gray-400 italic">Self-Study Block {i}: ________________________</td>
                    <td className="p-2 border-r border-gray-300 text-center font-mono text-gray-400">___m</td>
                    <td className="p-2 border-r border-gray-300 text-center text-gray-400">○ ○ ○ ○ ○</td>
                    <td className="p-2 text-center">
                      <div className="w-4 h-4 border border-gray-400 rounded mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 2: 1-3-7 Spaced Repetitions Due Today */}
          {includeRevisions && (
            <div className="space-y-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                🔄 1-3-7 Spaced Repetition Due Today
              </h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {pendingRevisions.length > 0 ? (
                  pendingRevisions.map((rev, idx) => (
                    <div key={idx} className="p-2 rounded-lg border border-gray-300 flex items-center justify-between">
                      <div className="truncate pr-2">
                        <strong className="text-gray-900">{rev.subjectName}:</strong> {rev.topicName}
                        <span className="text-[10px] text-gray-500 block">Stage: Day {rev.cycleStage === 'day7' ? '7' : rev.cycleStage === 'day3' ? '3' : '1'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono text-gray-500">20m</span>
                        <div className="w-4 h-4 border border-gray-500 rounded" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-2 rounded-lg border border-dashed border-gray-300 text-gray-500 italic col-span-2 text-center">
                    No overdue 1-3-7 revisions for today — syllabus is fully retained!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 3: Handwritten Tricky Traps & Mistake Log */}
          <div className="space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center justify-between">
              <span>⚠️ Past Paper Traps & Tricky Mistakes (Handwrite during session)</span>
              <span className="text-[10px] text-gray-500 font-mono">Log in Mistake Vault later</span>
            </h2>
            <div className="border border-gray-400 rounded-xl p-3 bg-gray-50/50 space-y-2.5">
              <div className="border-b border-dashed border-gray-300 pb-1 text-[11px] text-gray-400">
                1. [Q# / Topic]: ______________________ [Trap]: _________________________________________________
              </div>
              <div className="border-b border-dashed border-gray-300 pb-1 text-[11px] text-gray-400">
                2. [Q# / Topic]: ______________________ [Trap]: _________________________________________________
              </div>
              <div className="text-[11px] text-gray-400">
                3. [Q# / Topic]: ______________________ [Trap]: _________________________________________________
              </div>
            </div>
          </div>

          {/* Section 4: Feynman Blank Canvas / Formula Derivation Scratchpad */}
          <div className="space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800">
              💡 Feynman Active Recall & Formula Derivation Scratchpad
            </h2>
            <div className="border border-gray-400 rounded-xl h-24 p-2 bg-white relative">
              <span className="absolute top-2 left-2 text-[10px] text-gray-400 italic">
                Draw mindmap, recall formula without looking at notes, or synthesize key equation...
              </span>
            </div>
          </div>

          {/* Footer & Signature Block */}
          <div className="border-t border-gray-400 pt-3 flex items-center justify-between text-xs text-gray-600">
            <div>
              <span className="font-bold text-gray-800">Actual Total Hours Logged:</span> ________ hrs
            </div>
            <div>
              <span className="font-bold text-gray-800">Student Signature:</span> ______________________
            </div>
            <div>
              <span className="font-bold text-gray-800">Mentor/Senior Verification:</span> ______________________
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
