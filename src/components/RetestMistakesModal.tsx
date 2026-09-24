import React, { useState } from 'react';
import { 
  FileCheck, 
  Sparkles, 
  X, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft,
  RotateCcw,
  BookOpen,
  Award,
  ArrowRight,
  ShieldCheck,
  Send
} from 'lucide-react';
import { MistakeEntry, TestResult, Subject } from '../types';

interface RetestMistakesModalProps {
  isOpen: boolean;
  onClose: () => void;
  mistakes: MistakeEntry[];
  subjects: Subject[];
  onSaveTestResult?: (test: Omit<TestResult, 'id'>) => void;
  onCureMistakeSuccess?: (mistakeId: string) => void;
}

export const RetestMistakesModal: React.FC<RetestMistakesModalProps> = ({
  isOpen,
  onClose,
  mistakes,
  subjects,
  onSaveTestResult,
  onCureMistakeSuccess
}) => {
  const uncuredMistakes = mistakes.filter(m => m.cureStatus !== 'cured');

  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [questionCount, setQuestionCount] = useState<number>(Math.min(5, Math.max(1, uncuredMistakes.length)));
  const [testStarted, setTestStarted] = useState<boolean>(false);
  const [activeTestQuestions, setActiveTestQuestions] = useState<MistakeEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});
  const [gradingDecisions, setGradingDecisions] = useState<Record<string, boolean>>({});
  const [testFinished, setTestFinished] = useState<boolean>(false);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(15 * 60);

  if (!isOpen) return null;

  const filteredCandidates = uncuredMistakes.filter(m => {
    if (selectedSubject !== 'all' && m.subjectName !== selectedSubject) return false;
    return true;
  });

  const handleStartTest = () => {
    // Shuffle and pick
    const shuffled = [...filteredCandidates].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(questionCount, shuffled.length));
    if (selected.length === 0) return;

    setActiveTestQuestions(selected);
    setCurrentIndex(0);
    setStudentAnswers({});
    setRevealedSolutions({});
    setGradingDecisions({});
    setTestFinished(false);
    setTimeRemainingSeconds(selected.length * 3 * 60); // 3 mins per question
    setTestStarted(true);
  };

  const handleRevealSolution = (mistakeId: string) => {
    setRevealedSolutions(prev => ({ ...prev, [mistakeId]: true }));
  };

  const handleGradeQuestion = (mistakeId: string, isCorrect: boolean) => {
    setGradingDecisions(prev => ({ ...prev, [mistakeId]: isCorrect }));
    if (isCorrect && onCureMistakeSuccess) {
      onCureMistakeSuccess(mistakeId);
    }
  };

  const handleFinishTest = () => {
    setTestFinished(true);

    // Save as official TestResult in database
    if (onSaveTestResult && activeTestQuestions.length > 0) {
      const correctCount = Object.values(gradingDecisions).filter(Boolean).length;
      const totalMarks = activeTestQuestions.length * 5;
      const awardedMarks = correctCount * 5;
      const pct = Math.round((awardedMarks / totalMarks) * 100);

      const savedQuestions = activeTestQuestions.map((q, idx) => {
        const isRight = !!gradingDecisions[q.id];
        return {
          questionId: q.id,
          questionNumber: idx + 1,
          questionText: q.question,
          totalMarks: 5,
          awardedMarks: isRight ? 5 : 1,
          isCorrect: isRight,
          studentAnswer: studentAnswers[q.id] || '(No written answer provided)',
          modelAnswer: q.correctAnswer,
          feedback: isRight ? 'Avoided previous trap cleanly!' : `Still struggling with: ${q.notes || 'key concept'}`
        };
      });

      const primarySubj = activeTestQuestions[0]?.subjectName || 'General';
      const topicsList = Array.from(new Set(activeTestQuestions.map(q => q.topicName || 'Review')));

      onSaveTestResult({
        testName: `Targeted Mistake Re-Test (${topicsList.slice(0, 2).join(', ')})`,
        subjectName: primarySubj,
        topicName: topicsList[0] || 'Mistake Vault Re-Test',
        score: pct,
        totalMarks: totalMarks,
        date: new Date().toISOString(),
        testType: 'Quiz',
        weakTopics: activeTestQuestions.filter(q => !gradingDecisions[q.id]).map(q => q.topicName || 'Trap Review'),
        strongTopics: activeTestQuestions.filter(q => gradingDecisions[q.id]).map(q => q.topicName || 'Cured Trap'),
        savedQuestionsData: savedQuestions,
        correctionNotes: `Auto-generated test from ${activeTestQuestions.length} uncured mistakes in the Mistake Vault.`
      });
    }
  };

  const currentMistake = activeTestQuestions[currentIndex];
  const isCurrentRevealed = currentMistake ? !!revealedSolutions[currentMistake.id] : false;
  const isCurrentGraded = currentMistake ? gradingDecisions[currentMistake.id] !== undefined : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-surface border border-theme rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-theme flex items-center justify-between bg-surface-raised">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold">
              <FileCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-primary">Uncured Mistake Re-Test Simulator</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-mono">
                  {uncuredMistakes.length} Active Traps
                </span>
              </div>
              <p className="text-xs text-muted">
                Synthesize a timed, targeted exam quiz exclusively from questions you previously lost marks on.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-theme-accent text-muted hover:text-primary transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SETUP SCREEN */}
        {!testStarted && (
          <div className="p-6 space-y-5 text-xs">
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-amber-950 dark:text-amber-200 space-y-1.5 leading-relaxed">
              <span className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-400">
                <Sparkles className="w-4 h-4" />
                <span>The 100% Mastery Protocol:</span>
              </span>
              <p className="text-[11px] text-muted">
                Re-testing mistakes forces active retrieval against your own cognitive blindspots. When you answer correctly, this test automatically records progress towards curing the trap in your Mistake Vault.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-muted mb-1.5">Target Subject Filter</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-raised border border-theme text-primary text-xs font-semibold focus:outline-none"
                >
                  <option value="all">All Subjects ({uncuredMistakes.length} uncured questions)</option>
                  {subjects.map(s => {
                    const count = uncuredMistakes.filter(m => m.subjectName === s.name).length;
                    return (
                      <option key={s.id} value={s.name}>
                        {s.name} ({count} uncured)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-muted">Questions to Include in Re-Test</label>
                  <span className="font-bold text-primary font-mono">{questionCount} Questions ({questionCount * 3} Mins)</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, Math.min(15, filteredCandidates.length))}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  disabled={filteredCandidates.length === 0}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted font-mono mt-1">
                  <span>1 Question</span>
                  <span>Available: {filteredCandidates.length}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-theme flex items-center justify-between">
              <span className="text-muted text-[11px]">
                {filteredCandidates.length === 0 ? 'No uncured mistakes found for this subject filter.' : 'Ready to begin simulation.'}
              </span>

              <button
                onClick={handleStartTest}
                disabled={filteredCandidates.length === 0}
                className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                <span>Launch Re-Test Quiz</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE TEST ARENA */}
        {testStarted && !testFinished && currentMistake && (
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
            {/* Question Progress & Timer */}
            <div className="flex items-center justify-between border-b border-theme pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold font-mono text-[11px]">
                  Q{currentIndex + 1} of {activeTestQuestions.length}
                </span>
                <span className="font-bold text-primary text-xs">
                  {currentMistake.subjectName} • {currentMistake.topicName}
                </span>
              </div>
              <div className="flex items-center gap-1 text-muted font-mono text-xs">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Question Weight: 5 Marks</span>
              </div>
            </div>

            {/* Previous Error Warning Callout */}
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-950 dark:text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-rose-700 dark:text-rose-300 block">
                  Autopsy Context (Why you lost marks previously):
                </span>
                <p className="text-[11px] mt-0.5">
                  Category: <strong>{currentMistake.errorCategory.replace('_', ' ')}</strong>. {currentMistake.notes || 'Take your time to write a step-by-step complete answer.'}
                </p>
              </div>
            </div>

            {/* Question Text Box */}
            <div className="p-4 rounded-2xl bg-surface-raised border border-theme space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                Exam Question:
              </span>
              <p className="text-sm font-serif font-bold text-primary leading-relaxed whitespace-pre-line">
                {currentMistake.question}
              </p>
            </div>

            {/* Student Answer Scratchpad */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-muted text-[11px]">
                Your Solution / Calculation Working:
              </label>
              <textarea
                value={studentAnswers[currentMistake.id] || ''}
                onChange={(e) => setStudentAnswers({ ...studentAnswers, [currentMistake.id]: e.target.value })}
                placeholder="Type your final answer, formula steps, or numerical reasoning here..."
                rows={3}
                className="w-full p-3 rounded-xl bg-background border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-amber-500/50 leading-relaxed font-sans text-xs"
              />
            </div>

            {/* Verification & Self-Marking */}
            {!isCurrentRevealed ? (
              <button
                onClick={() => handleRevealSolution(currentMistake.id)}
                className="w-full py-2.5 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme text-primary font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Check Official Mark Scheme & Method</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-200 space-y-3 animate-in fade-in duration-200">
                <div>
                  <span className="font-bold text-[10px] uppercase text-emerald-700 dark:text-emerald-400 block mb-0.5">
                    Official Mark Scheme & Correct Solution:
                  </span>
                  <p className="font-sans leading-relaxed whitespace-pre-line text-xs">
                    {currentMistake.correctAnswer}
                  </p>
                </div>

                <div className="pt-2 border-t border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <span className="text-[11px] font-semibold text-primary">
                    Did you solve it correctly without repeating the error?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleGradeQuestion(currentMistake.id, false)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        gradingDecisions[currentMistake.id] === false
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white dark:bg-card border-theme text-muted hover:text-primary'
                      }`}
                    >
                      Still Slipped (0/5)
                    </button>

                    <button
                      onClick={() => handleGradeQuestion(currentMistake.id, true)}
                      className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        gradingDecisions[currentMistake.id] === true
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white dark:bg-card border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Got It Right! (5/5)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stepper Navigation */}
            <div className="pt-3 border-t border-theme flex items-center justify-between">
              <button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-3 py-1.5 rounded-xl border border-theme text-muted hover:text-primary transition flex items-center gap-1 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              {currentIndex + 1 < activeTestQuestions.length ? (
                <button
                  onClick={() => setCurrentIndex(prev => prev + 1)}
                  className="px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-white font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next Question</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleFinishTest}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <Award className="w-4 h-4" />
                  <span>Submit & Save Test</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TEST SUMMARY SCREEN */}
        {testFinished && (
          <div className="p-6 space-y-5 text-center text-xs">
            {(() => {
              const correct = Object.values(gradingDecisions).filter(Boolean).length;
              const total = activeTestQuestions.length;
              const pct = Math.round((correct / total) * 100);

              return (
                <div className="space-y-4 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto">
                    <Award className="w-8 h-8" />
                  </div>

                  <div>
                    <h3 className="text-lg font-serif font-bold text-primary">
                      Re-Test Completed: {pct}% Score
                    </h3>
                    <p className="text-muted mt-1 text-[11px]">
                      Successfully cured <strong>{correct} of {total}</strong> targeted cognitive traps. This test has been saved to your permanent Test History.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-surface-raised border border-theme text-left">
                    <div>
                      <span className="text-[10px] text-muted block">Traps Cured</span>
                      <span className="text-base font-bold text-emerald-600 font-mono">+{correct} Marks</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block">Remaining In Vault</span>
                      <span className="text-base font-bold text-amber-600 font-mono">{total - correct} Active</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-center gap-3">
                    <button
                      onClick={onClose}
                      className="px-5 py-2.5 rounded-xl bg-primary hover:opacity-90 text-white font-bold text-xs transition cursor-pointer"
                    >
                      Return to Mistake Vault
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
};
