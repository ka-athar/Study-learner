/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  AlertTriangle, 
  Printer, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  RotateCcw, 
  ChevronRight, 
  FileText, 
  Zap, 
  HelpCircle,
  Plus,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { Subject, MistakeEntry, ExamDate, EmergencyCramSheet, UserProfile } from '../types';
import { 
  generateEmergencyCramSheet, 
  loadSavedCramSheet, 
  saveCramSheet, 
  openPrintableCramSheetWindow,
  getImpendingExams
} from '../lib/preExamTriageService';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface EmergencyPreExamTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  userProfile: UserProfile | null;
  mistakes?: MistakeEntry[];
  initialSubjectName?: string;
}

export const EmergencyPreExamTriageModal: React.FC<EmergencyPreExamTriageModalProps> = ({
  isOpen,
  onClose,
  subjects,
  userProfile,
  mistakes = [],
  initialSubjectName
}) => {
  const impendingList = useMemo(() => {
    return getImpendingExams(userProfile?.examDates || []);
  }, [userProfile?.examDates]);

  // Selected subject for cram sheet
  const defaultSubject = initialSubjectName || 
    (impendingList[0]?.exam.subjectName) || 
    (subjects[0]?.name) || 
    'Physics';

  const [selectedSubjectName, setSelectedSubjectName] = useState<string>(defaultSubject);
  const [activeTab, setActiveTab] = useState<'matrix' | 'cram_sheet' | 'primer'>('cram_sheet');

  // Sheet state
  const [cramSheet, setCramSheet] = useState<EmergencyCramSheet | null>(null);
  const [revealedPrimerIndex, setRevealedPrimerIndex] = useState<number | null>(null);
  const [primerChecked, setPrimerChecked] = useState<Record<string, boolean>>({});

  // Custom note input
  const [customNoteInput, setCustomNoteInput] = useState<string>('');

  // Synchronize or load sheet when selected subject changes
  useEffect(() => {
    if (!isOpen) return;

    const matchedExam = (userProfile?.examDates || []).find(e => 
      e.subjectName.toLowerCase() === selectedSubjectName.toLowerCase()
    );

    const saved = loadSavedCramSheet(selectedSubjectName);
    if (saved) {
      setCramSheet(saved);
    } else {
      const generated = generateEmergencyCramSheet({
        subjectName: selectedSubjectName,
        examTitle: matchedExam?.examName || `${selectedSubjectName} Board Paper`,
        examDate: matchedExam?.date,
        examId: matchedExam?.id,
        subjects,
        mistakes
      });
      setCramSheet(generated);
    }
  }, [isOpen, selectedSubjectName, userProfile?.examDates, subjects, mistakes]);

  if (!isOpen || !cramSheet) return null;

  const handleRegenerateSheet = () => {
    const matchedExam = (userProfile?.examDates || []).find(e => 
      e.subjectName.toLowerCase() === selectedSubjectName.toLowerCase()
    );

    const generated = generateEmergencyCramSheet({
      subjectName: selectedSubjectName,
      examTitle: matchedExam?.examName || `${selectedSubjectName} Board Paper`,
      examDate: matchedExam?.date,
      examId: matchedExam?.id,
      subjects,
      mistakes
    });
    setCramSheet(generated);
    triggerStudyGoalConfetti();
  };

  const handleAddCustomNote = () => {
    if (!customNoteInput.trim()) return;
    const updated: EmergencyCramSheet = {
      ...cramSheet,
      customNotes: cramSheet.customNotes 
        ? `${cramSheet.customNotes}\n• ${customNoteInput.trim()}`
        : `• ${customNoteInput.trim()}`
    };
    setCramSheet(updated);
    saveCramSheet(updated);
    setCustomNoteInput('');
  };

  const matchedExam = (userProfile?.examDates || []).find(e => 
    e.subjectName.toLowerCase() === selectedSubjectName.toLowerCase()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div 
        className="bg-card border border-theme rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-5 sm:p-6 border-b border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold font-serif text-primary">
                  24-Hour Pre-Exam Emergency Triage Desk
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 animate-pulse">
                  EMERGENCY CRAM DESK
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Suppresses low-yield textbook clutter. Synthesizes critical formulas, logged mistake traps, and printable 1-page A4 dossier.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Print A4 Sheet Button */}
            <button
              onClick={() => openPrintableCramSheetWindow(cramSheet)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition shadow-xs cursor-pointer active:scale-95"
              title="Print high-contrast 1-page A4 cheat sheet for last-minute review"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4 Sheet</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-2xl bg-surface hover:bg-theme-accent border border-theme flex items-center justify-center text-muted hover:text-primary transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Impending Subject Selector Strip */}
        <div className="px-6 py-3 bg-surface/80 border-b border-theme flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <span className="font-semibold text-primary text-[11px] uppercase font-mono tracking-wider shrink-0">
              Exam Subject:
            </span>
            {subjects.map(sub => {
              const hasExam = (userProfile?.examDates || []).some(e => e.subjectName.toLowerCase() === sub.name.toLowerCase());
              const isSelected = sub.name.toLowerCase() === selectedSubjectName.toLowerCase();
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubjectName(sub.name)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[#6B705C] text-white shadow-2xs'
                      : 'bg-surface hover:bg-theme-accent border border-theme text-primary'
                  }`}
                >
                  <span>{sub.name}</span>
                  {hasExam && <span className="text-[10px] text-rose-500 font-mono">🚨</span>}
                </button>
              );
            })}
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-theme text-xs">
            <button
              onClick={() => setActiveTab('cram_sheet')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'cram_sheet' ? 'bg-[#6B705C] text-white shadow-2xs' : 'text-muted hover:text-primary'
              }`}
            >
              <span>1-Page Cram Sheet</span>
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'matrix' ? 'bg-[#6B705C] text-white shadow-2xs' : 'text-muted hover:text-primary'
              }`}
            >
              <span>Triage Matrix</span>
            </button>
            <button
              onClick={() => setActiveTab('primer')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'primer' ? 'bg-[#6B705C] text-white shadow-2xs' : 'text-muted hover:text-primary'
              }`}
            >
              <span>10m Primer ({cramSheet.confidencePrimerQuestions.length})</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: 1-PAGE CRAM SHEET STUDIO */}
          {activeTab === 'cram_sheet' && (
            <div className="space-y-4">
              {/* Exam Urgency Banner */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>
                      {matchedExam ? `${matchedExam.examName} scheduled for ${matchedExam.date}` : `Exam Prep: ${selectedSubjectName}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80">
                    Confidence Readiness: <strong>{cramSheet.confidenceScore}%</strong>. Focus strictly on these formula traps and keywords outside the examination hall.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleRegenerateSheet}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-xs font-semibold text-primary transition cursor-pointer"
                    title="Regenerate from latest mistake vault entries"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Regenerate</span>
                  </button>
                  <button
                    onClick={() => openPrintableCramSheetWindow(cramSheet)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print A4</span>
                  </button>
                </div>
              </div>

              {/* 4-Quadrant High-Yield Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* QUADRANT 1: CRITICAL FORMULAS & CONSTANTS */}
                <div className="bg-surface/70 border border-theme rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-theme pb-2">
                    <span className="text-xs font-bold font-serif text-primary flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>1. Critical Formulas & Traps</span>
                    </span>
                    <span className="text-[10px] font-mono text-muted">Formula Catalog</span>
                  </div>

                  <div className="space-y-2.5">
                    {cramSheet.criticalFormulas.map(f => (
                      <div key={f.id} className="p-3 rounded-xl bg-card border border-theme/60 space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-primary">
                          <span>{f.label}</span>
                          {f.topicName && <span className="text-[10px] text-muted font-normal">{f.topicName}</span>}
                        </div>
                        <div className="p-1.5 rounded bg-surface/90 font-mono text-xs font-bold text-primary border border-theme/40 text-center tracking-wide">
                          {f.formula}
                        </div>
                        <div className="text-[11px] text-rose-700 dark:text-rose-400 font-medium flex items-start gap-1 pt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
                          <span>{f.trapNote}</span>
                        </div>
                        {f.unitConstraint && (
                          <div className="text-[10px] text-muted font-mono pl-4">
                            Unit rule: {f.unitConstraint}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* QUADRANT 2: MISTAKE VAULT TRAPS */}
                <div className="bg-surface/70 border border-theme rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-theme pb-2">
                    <span className="text-xs font-bold font-serif text-primary flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>2. Your Historical Mistake Traps</span>
                    </span>
                    <span className="text-[10px] font-mono text-rose-600 font-bold">From Vault</span>
                  </div>

                  <div className="space-y-2.5">
                    {cramSheet.mistakeTrapsToAvoid.map(t => (
                      <div key={t.id} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-rose-900 dark:text-rose-200">
                          <span>{t.concept}</span>
                          <span className="text-[10px] font-mono bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded font-bold">
                            Missed {t.mistakeCount}x
                          </span>
                        </div>
                        <p className="text-[11px] text-primary/90 leading-snug">
                          {t.warning}
                        </p>
                        {t.examQuestionSnippet && (
                          <div className="text-[10px] text-muted italic border-t border-rose-500/20 pt-1 mt-1 truncate">
                            Q: {t.examQuestionSnippet}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Examiner Keyword Alerts */}
                  <div className="pt-2 border-t border-theme space-y-1.5">
                    <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#6B705C]" />
                      <span>3. Examiner Keyword Penalties</span>
                    </span>
                    <div className="space-y-1">
                      {cramSheet.examinerKeywordAlerts.map((k, idx) => (
                        <div key={idx} className="text-[11px] text-muted flex items-start gap-1.5">
                          <span className="text-amber-600 font-bold">•</span>
                          <span>{k}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* High-Yield Definitions & Custom Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface/70 border border-theme rounded-2xl p-4 space-y-2.5">
                  <span className="text-xs font-bold font-serif text-primary flex items-center gap-1.5 border-b border-theme pb-2">
                    <BookOpen className="w-4 h-4 text-[#6B705C]" />
                    <span>4. Core High-Yield Definitions</span>
                  </span>
                  <div className="space-y-2">
                    {cramSheet.highYieldDefinitions.map(d => (
                      <div key={d.id} className="text-xs space-y-0.5 p-2 rounded-xl bg-card border border-theme/40">
                        <strong className="text-primary">{d.term}:</strong>
                        <p className="text-[11px] text-muted leading-relaxed">{d.definition}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Notes Section */}
                <div className="bg-surface/70 border border-theme rounded-2xl p-4 space-y-3">
                  <span className="text-xs font-bold font-serif text-primary flex items-center gap-1.5 border-b border-theme pb-2">
                    <FileText className="w-4 h-4 text-[#6B705C]" />
                    <span>My Last-Minute Exam Reminders</span>
                  </span>

                  {cramSheet.customNotes ? (
                    <div className="p-3 rounded-xl bg-card border border-theme text-xs text-primary whitespace-pre-line font-mono">
                      {cramSheet.customNotes}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted italic">
                      No custom notes added yet. Add personalized formulas or mnemonics below to include them on your printable sheet.
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customNoteInput}
                      onChange={e => setCustomNoteInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddCustomNote()}
                      placeholder="Add custom formula or mnemonic..."
                      className="flex-1 px-3 py-1.5 rounded-xl bg-card border border-theme text-xs text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-[#6B705C]"
                    />
                    <button
                      onClick={handleAddCustomNote}
                      className="px-3 py-1.5 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRIAGE MATRIX */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <div className="bg-surface/60 border border-theme p-4 rounded-2xl text-xs space-y-1">
                <h4 className="font-bold text-primary font-serif">
                  The 24-Hour Pre-Exam Triage Protocol
                </h4>
                <p className="text-muted leading-relaxed">
                  In the final 24 hours before an exam, students often make the fatal error of trying to learn new complex chapters. The triage protocol strictly protects your energy:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. PROTECT */}
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase font-mono">
                      ✓ PROTECT (Solid)
                    </span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">Do Not Over-Study</span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Topics you have already mastered. Re-reading these wastes valuable pre-exam hours. Trust your memory.
                  </p>
                  <div className="space-y-1">
                    {cramSheet.triageClassification.protectTopics.map((top, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-card border border-emerald-500/20 text-xs font-medium text-primary">
                        • {top}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. CRAM */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase font-mono">
                      ⚡ CRAM (Volatile)
                    </span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">Highest Score ROI</span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Concepts where you made recent slips in tests or Mistake Vault. Reviewing these now yields immediate marks tomorrow.
                  </p>
                  <div className="space-y-1">
                    {cramSheet.triageClassification.cramTopics.map((top, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-card border border-amber-500/20 text-xs font-medium text-primary">
                        • {top}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. SHELVE */}
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-rose-500/30 pb-2">
                    <span className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase font-mono">
                      ✕ SHELVE (Drop)
                    </span>
                    <span className="text-[10px] text-rose-700 dark:text-rose-300 font-bold">Protect Confidence</span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Large unstudied topics. Trying to learn them now induces panic and ruins sleep. Cut them cleanly to protect your core 80% marks.
                  </p>
                  <div className="space-y-1">
                    {cramSheet.triageClassification.shelveTopics.map((top, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-card border border-rose-500/20 text-xs font-medium text-primary opacity-70">
                        • {top}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 10-MINUTE CONFIDENCE PRIMER */}
          {activeTab === 'primer' && (
            <div className="space-y-4">
              <div className="bg-surface/60 border border-theme p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-primary font-serif">
                    10-Minute Rapid Confidence Primer Drill
                  </h4>
                  <p className="text-muted text-[11px]">
                    Zero timers, zero stress. Answer these 5 mental check questions to prime your recall pathways and extinguish exam anxiety.
                  </p>
                </div>
                <div className="font-mono text-xs font-bold text-primary shrink-0">
                  {Object.values(primerChecked).filter(Boolean).length} of {cramSheet.confidencePrimerQuestions.length} Checked
                </div>
              </div>

              <div className="space-y-3">
                {cramSheet.confidencePrimerQuestions.map((q, idx) => {
                  const isRevealed = revealedPrimerIndex === idx;
                  const isDone = primerChecked[q.id];

                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl bg-surface/70 border border-theme space-y-2.5 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() => setPrimerChecked(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                            className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition cursor-pointer ${
                              isDone
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-theme bg-card hover:border-[#6B705C]'
                            }`}
                          >
                            {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                          <div>
                            <span className="text-[10px] font-mono font-bold text-muted uppercase">
                              Question {idx + 1} · {q.topicName}
                            </span>
                            <h5 className="text-xs sm:text-sm font-bold text-primary mt-0.5">
                              {q.question}
                            </h5>
                          </div>
                        </div>

                        <button
                          onClick={() => setRevealedPrimerIndex(isRevealed ? null : idx)}
                          className="px-3 py-1 rounded-xl bg-card hover:bg-theme-accent border border-theme text-xs font-bold text-primary transition cursor-pointer shrink-0"
                        >
                          {isRevealed ? 'Hide Answer' : 'Check Key'}
                        </button>
                      </div>

                      {isRevealed && (
                        <div className="p-3 rounded-xl bg-card border border-theme/80 space-y-1.5 animate-fade-in text-xs">
                          <div className="font-semibold text-emerald-800 dark:text-emerald-300">
                            <strong>Mark Scheme Answer: </strong>{q.answer}
                          </div>
                          <div className="text-[11px] text-rose-700 dark:text-rose-400 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Trap to Avoid: {q.keyTrap}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-theme bg-surface/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-muted flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#6B705C]" />
            <span>
              Pre-Exam Protocol: Sleep $\ge$ 7 hours tonight. Cognitive rest beats late-night cramming.
            </span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-2xl bg-surface hover:bg-theme-accent border border-theme text-xs font-semibold text-muted hover:text-primary transition cursor-pointer"
            >
              Close Triage
            </button>
            <button
              onClick={() => openPrintableCramSheetWindow(cramSheet)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print 1-Page Cram Sheet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
