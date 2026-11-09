import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Printer, 
  X, 
  Award, 
  CheckCircle2, 
  Clock, 
  FileText, 
  ShieldCheck, 
  Zap,
  Target,
  Sparkles,
  Download
} from 'lucide-react';
import { Subject, UserProfile } from '../types';
import { SBBMCrest } from './SBBMCrest';
import { openStudyKitPrintWindow } from '../lib/studyKitExportService';

interface SbbmAnswerSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  userProfile: UserProfile | null;
  defaultSubject?: string;
  defaultMcqBenchmark?: number;
  defaultSqBenchmark?: number;
  defaultLqBenchmark?: number;
}

export const SbbmAnswerSheetModal: React.FC<SbbmAnswerSheetModalProps> = ({
  isOpen,
  onClose,
  subjects,
  userProfile,
  defaultSubject,
  defaultMcqBenchmark = 21.5,
  defaultSqBenchmark = 2,
  defaultLqBenchmark = 15
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>(
    defaultSubject || (subjects.length > 0 ? subjects[0].name : 'Physics')
  );
  const [examTitle, setExamTitle] = useState<string>('Sindh Board Annual Examination Practice');
  const [candidateRollNo, setCandidateRollNo] = useState<string>('748291');
  const [candidateName, setCandidateName] = useState<string>(userProfile?.displayName || 'Candidate Name');
  const [centerCode, setCenterCode] = useState<string>('SBBM-KHI-402');
  
  // Counts & Benchmarks
  const [mcqCount, setMcqCount] = useState<number>(30);
  const [mcqSecs, setMcqSecs] = useState<number>(defaultMcqBenchmark);
  const [sqCount, setSqCount] = useState<number>(6);
  const [sqMins, setSqMins] = useState<number>(defaultSqBenchmark);
  const [lqCount, setLqCount] = useState<number>(2);
  const [lqMins, setLqMins] = useState<number>(defaultLqBenchmark);

  // Target Stamps toggles
  const [includeTimePacedStamp, setIncludeTimePacedStamp] = useState<boolean>(true);
  const [includeFullAttemptStamp, setIncludeFullAttemptStamp] = useState<boolean>(true);
  const [includeRubricStamp, setIncludeRubricStamp] = useState<boolean>(true);
  const [includeBoardGradeStamp, setIncludeBoardGradeStamp] = useState<boolean>(true);

  if (!isOpen) return null;

  const totalExamMinutes = Math.ceil((mcqCount * mcqSecs) / 60) + (sqCount * sqMins) + (lqCount * lqMins);

  const handlePrintAnswerSheet = () => {
    openStudyKitPrintWindow(
      {
        format: 'sbbm_answer_sheet' as any,
        selectedSubjectNames: [selectedSubject],
        includeFormulas: true,
        includeMnemonics: true,
        includeFlashcards: false,
        includeExams: true,
        columns: 2,
        fontSize: 'standard',
        title: examTitle,
        notes: `Candidate: ${candidateName} | Roll No: ${candidateRollNo} | Center: ${centerCode} | Target Time: ${totalExamMinutes} mins`
      },
      {
        subjects,
        flashcardDecks: [],
        plans: [],
        userProfile: {
          ...(userProfile || { id: 'std-1', email: '', displayName: candidateName, createdAt: '' }),
          displayName: candidateName
        },
        revisions: []
      }
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-card text-primary w-full max-w-4xl rounded-3xl border border-theme shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header with Official SBBM Crest */}
          <div className="bg-header p-5 sm:p-6 border-b border-theme flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SBBMCrest size="md" showLabel={false} />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-serif italic font-bold">
                    Printable SBBM Answer Sheet & Target Stamps
                  </h3>
                  <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    Official Board Format
                  </span>
                </div>
                <p className="text-xs text-muted">
                  Authentic exam-hall physical answer folio with target rubber stamps, OMR bubbles, and structured short & long question grids.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-theme-accent text-muted hover:text-primary transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-xs">
            {/* 4 Authentic Target Stamps Feature Preview */}
            <div className="space-y-2">
              <span className="font-bold uppercase tracking-wider text-muted text-[11px] block">
                Target Rubber Stamps Included on Printed Sheet:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className={`p-3 rounded-2xl border transition ${includeTimePacedStamp ? 'bg-rose-500/10 border-rose-500/40 text-rose-900 dark:text-rose-200' : 'bg-surface border-theme opacity-50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold">🔴 STAMP #1</span>
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-extrabold text-[11px] leading-snug">EXAM PRESSURE</div>
                  <div className="text-[9px] opacity-80 mt-0.5">Time-Paced Verified ({mcqSecs}s/MCQ • {sqMins}m SQ • {lqMins}m LQ)</div>
                </div>

                <div className={`p-3 rounded-2xl border transition ${includeFullAttemptStamp ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-200' : 'bg-surface border-theme opacity-50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold">🟢 STAMP #2</span>
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-extrabold text-[11px] leading-snug">100% ATTEMPT</div>
                  <div className="text-[9px] opacity-80 mt-0.5">Zero Omissions Mandate • All Sections Answered</div>
                </div>

                <div className={`p-3 rounded-2xl border transition ${includeRubricStamp ? 'bg-sky-500/10 border-sky-500/40 text-sky-900 dark:text-sky-200' : 'bg-surface border-theme opacity-50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold">🔵 STAMP #3</span>
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-extrabold text-[11px] leading-snug">EXAMINER RUBRIC</div>
                  <div className="text-[9px] opacity-80 mt-0.5">Formula + Working Steps + Units Audited</div>
                </div>

                <div className={`p-3 rounded-2xl border transition ${includeBoardGradeStamp ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200' : 'bg-surface border-theme opacity-50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold">🟣 STAMP #4</span>
                    <Award className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-extrabold text-[11px] leading-snug">SBBM GRADE A*</div>
                  <div className="text-[9px] opacity-80 mt-0.5">Official Board Standard • Verified Seal</div>
                </div>
              </div>
            </div>

            {/* Candidate & Paper Parameters Form */}
            <div className="bg-surface p-4 rounded-2xl border border-theme space-y-4">
              <span className="font-bold uppercase tracking-wider text-muted text-[11px] block">
                Candidate Particulars & Subject Details
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-muted uppercase block mb-1">Target Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-card border border-theme text-xs font-bold text-primary focus:outline-none"
                  >
                    {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted uppercase block mb-1">Candidate Name</label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-card border border-theme text-xs font-bold text-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted uppercase block mb-1">Candidate Roll No. (6 Digits)</label>
                  <input
                    type="text"
                    value={candidateRollNo}
                    maxLength={6}
                    onChange={(e) => setCandidateRollNo(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-card border border-theme text-xs font-mono font-bold text-primary focus:outline-none tracking-widest"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-muted uppercase block mb-1">Exam Title / Paper Heading</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-card border border-theme text-xs font-bold text-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted uppercase block mb-1">Examination Center Code</label>
                  <input
                    type="text"
                    value={centerCode}
                    onChange={(e) => setCenterCode(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-card border border-theme text-xs font-mono font-bold text-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Question Breakdown & Time Benchmark Config */}
            <div className="bg-surface p-4 rounded-2xl border border-theme space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider text-muted text-[11px] block">
                  Question Section Layouts & Benchmarks
                </span>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  Total Exam Budget: ~{totalExamMinutes} Minutes
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Section A: MCQs */}
                <div className="p-3.5 rounded-2xl bg-card border border-theme space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-primary flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-rose-500" />
                      <span>Section A: MCQs</span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold">
                      OMR Grid
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted">Total MCQs</label>
                      <select
                        value={mcqCount}
                        onChange={(e) => setMcqCount(Number(e.target.value))}
                        className="p-1 px-2 rounded-lg bg-surface border border-theme font-mono font-bold text-xs"
                      >
                        {[15, 20, 25, 30, 40, 50].map(n => <option key={n} value={n}>{n} MCQs</option>)}
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted">Target Sec/Q</label>
                      <select
                        value={mcqSecs}
                        onChange={(e) => setMcqSecs(Number(e.target.value))}
                        className="p-1 px-2 rounded-lg bg-surface border border-theme font-mono font-bold text-xs"
                      >
                        {[21.5, 30, 45, 60, 90].map(s => <option key={s} value={s}>{s}s</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section B: Short Questions */}
                <div className="p-3.5 rounded-2xl bg-card border border-theme space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-primary flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Section B: Short Qs</span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold">
                      Ruled Grids
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted">Question Count</label>
                      <select
                        value={sqCount}
                        onChange={(e) => setSqCount(Number(e.target.value))}
                        className="p-1 px-2 rounded-lg bg-surface border border-theme font-mono font-bold text-xs"
                      >
                        {[4, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n} Questions</option>)}
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted">Target Min/Q</label>
                      <select
                        value={sqMins}
                        onChange={(e) => setSqMins(Number(e.target.value))}
                        className="p-1 px-2 rounded-lg bg-surface border border-theme font-mono font-bold text-xs"
                      >
                        {[2, 3, 4, 5].map(m => <option key={m} value={m}>{m} mins</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section C: Long Questions */}
                <div className="p-3.5 rounded-2xl bg-card border border-theme space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-primary flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-purple-500" />
                      <span>Section C: Long Qs</span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold">
                      Extended Workspace
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted">Question Count</label>
                      <select
                        value={lqCount}
                        onChange={(e) => setLqCount(Number(e.target.value))}
                        className="p-1 px-2 rounded-lg bg-surface border border-theme font-mono font-bold text-xs"
                      >
                        {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} Questions</option>)}
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted">Target Min/Q</label>
                      <select
                        value={lqMins}
                        onChange={(e) => setLqMins(Number(e.target.value))}
                        className="p-1 px-2 rounded-lg bg-surface border border-theme font-mono font-bold text-xs"
                      >
                        {[10, 12, 15, 20].map(m => <option key={m} value={m}>{m} mins</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-header p-4 sm:p-5 border-t border-theme flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Optimized for crisp A4 paper output with high-contrast printer alignment</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-theme hover:bg-theme-accent font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handlePrintAnswerSheet}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-700 hover:opacity-90 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Open & Print SBBM Answer Sheet</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
