import React, { useState } from 'react';
import { 
  FileText, 
  Upload, 
  Clock, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Flag, 
  Maximize2, 
  Minimize2,
  Save,
  BookOpen,
  HelpCircle,
  AlertTriangle,
  Award,
  Sparkles
} from 'lucide-react';
import { Subject, TestResult } from '../types';

interface PDFExamPracticeStationProps {
  subjects: Subject[];
  onSaveTestResult?: (test: Omit<TestResult, 'id'>) => void;
  onClose?: () => void;
}

interface QuestionAttempt {
  questionNumber: number;
  type: 'mcq' | 'short' | 'long';
  selectedOption?: string;
  writtenAnswer?: string;
  isFlagged?: boolean;
}

const SAMPLE_PAPERS = [
  {
    id: 'sample_physics_cie',
    title: 'Physics Advanced Mechanics & Waves — Practice Paper',
    subject: 'Physics',
    totalMarks: 40,
    durationMinutes: 45,
    sampleQuestions: [
      { num: 1, type: 'mcq' as const, prompt: 'Which of the following is a fundamental SI base unit?', options: ['A) Newton', 'B) Joule', 'C) Kilogram', 'D) Watt'] },
      { num: 2, type: 'mcq' as const, prompt: 'A projectile is launched at 30° above the horizontal with speed 20 m/s. What is its horizontal velocity component?', options: ['A) 10.0 m/s', 'B) 17.3 m/s', 'C) 20.0 m/s', 'D) 9.8 m/s'] },
      { num: 3, type: 'short' as const, prompt: 'State Newton’s Second Law of Motion in terms of momentum.', options: [] },
      { num: 4, type: 'short' as const, prompt: 'Distinguish between constructive and destructive interference of waves.', options: [] },
      { num: 5, type: 'long' as const, prompt: 'Derive the kinematic equation v² = u² + 2as from first principles under constant acceleration.', options: [] }
    ]
  },
  {
    id: 'sample_chem_fbise',
    title: 'Chemistry Stoichiometry & Gas Laws — Exam Paper',
    subject: 'Chemistry',
    totalMarks: 35,
    durationMinutes: 40,
    sampleQuestions: [
      { num: 1, type: 'mcq' as const, prompt: 'What volume does 1 mole of an ideal gas occupy at standard temperature and pressure (STP)?', options: ['A) 22.4 dm³', 'B) 24.0 dm³', 'C) 1.0 dm³', 'D) 44.8 dm³'] },
      { num: 2, type: 'mcq' as const, prompt: 'The oxidation state of Manganese in KMnO₄ is:', options: ['A) +2', 'B) +4', 'C) +7', 'D) +6'] },
      { num: 3, type: 'short' as const, prompt: 'Define limiting reactant and outline two steps to identify it in a given chemical reaction.', options: [] },
      { num: 4, type: 'long' as const, prompt: 'Explain the kinetic molecular theory postulates of gases and how deviations occur at real temperatures.', options: [] }
    ]
  }
];

export const PDFExamPracticeStation: React.FC<PDFExamPracticeStationProps> = ({
  subjects,
  onSaveTestResult,
  onClose
}) => {
  // PDF Document State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string>(SAMPLE_PAPERS[0].id);

  // Exam Pacing & Timer State
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [secondsLeft, setSecondsLeft] = useState<number>(45 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  // Subject Selection
  const [selectedSubject, setSelectedSubject] = useState<string>(subjects[0]?.name || 'Physics');
  const [examTitle, setExamTitle] = useState<string>('Physics Advanced Practice Paper');

  // Attempt Tracking
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [attempts, setAttempts] = useState<Record<number, QuestionAttempt>>({
    1: { questionNumber: 1, type: 'mcq' },
    2: { questionNumber: 2, type: 'mcq' },
    3: { questionNumber: 3, type: 'short' },
    4: { questionNumber: 4, type: 'short' },
    5: { questionNumber: 5, type: 'long' }
  });

  // Zoom & UI Layout
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSubmissionSuccess, setShowSubmissionSuccess] = useState<boolean>(false);

  // Timer Countdown Effect
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, secondsLeft]);

  // Handle PDF File Upload
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Please upload a valid PDF document.');
        return;
      }
      setPdfFile(file);
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setExamTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleStartExam = () => {
    setHasStarted(true);
    setIsTimerRunning(true);
  };

  const handleToggleTimer = () => {
    setIsTimerRunning(prev => !prev);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setSecondsLeft(durationMinutes * 60);
  };

  const handleDurationChange = (minutes: number) => {
    setDurationMinutes(minutes);
    if (!hasStarted) {
      setSecondsLeft(minutes * 60);
    }
  };

  // Format Time Helper
  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Update Question Attempt
  const updateAttempt = (qNum: number, updates: Partial<QuestionAttempt>) => {
    setAttempts(prev => ({
      ...prev,
      [qNum]: {
        questionNumber: qNum,
        type: prev[qNum]?.type || 'mcq',
        ...prev[qNum],
        ...updates
      }
    }));
  };

  const currentAttempt = attempts[currentQIndex + 1] || {
    questionNumber: currentQIndex + 1,
    type: 'mcq'
  };

  const activeSample = SAMPLE_PAPERS.find(s => s.id === selectedSampleId);
  const sampleQuestionData = activeSample?.sampleQuestions?.[currentQIndex];

  // Submit and Save
  const handleSubmitExam = () => {
    setIsTimerRunning(false);
    const totalAttempted = (Object.values(attempts) as QuestionAttempt[]).filter(
      a => a.selectedOption || (a.writtenAnswer && a.writtenAnswer.trim().length > 0)
    ).length;

    const timeSpentMinutes = Math.max(1, Math.round((durationMinutes * 60 - secondsLeft) / 60));

    if (onSaveTestResult) {
      onSaveTestResult({
        subjectName: selectedSubject,
        testName: examTitle || `${selectedSubject} Timed PDF Exam`,
        score: `${totalAttempted}/${totalQuestions}`,
        date: new Date().toISOString().split('T')[0],
        totalMarks: totalQuestions,
        mistakes: '',
        struggledTopics: [],
        correctionNotes: `Attempted via PDF Exam Station in ${timeSpentMinutes} minutes.`
      });
    }

    setShowSubmissionSuccess(true);
  };

  return (
    <div className={`space-y-4 animate-fade-in ${isFullscreen ? 'fixed inset-0 z-50 bg-[#F9F7F2] p-4 overflow-y-auto' : ''}`}>
      {/* Top Banner & Control Bar */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 text-[11px] font-mono font-bold flex items-center gap-1 border border-emerald-500/30">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Idea 2: PDF Exam Station & Dual Timer</span>
            </span>
            <span className="text-xs text-[#8A8F80]">
              View past paper PDF, attempt questions, & maintain uninterrupted timer pacing
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#6B705C]" />
            <span>{examTitle}</span>
          </h2>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timer Display */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border font-mono font-bold text-sm ${
            secondsLeft <= 300 
              ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
              : 'bg-[#F2EFE9] text-[#2B2D42] border-[#E0DBD0]'
          }`}>
            <Clock className={`w-4 h-4 ${isTimerRunning ? 'text-emerald-600 animate-spin' : 'text-[#8A8F80]'}`} />
            <span>{formatTime(secondsLeft)}</span>
            <button
              onClick={handleToggleTimer}
              className="p-1 rounded-lg hover:bg-white text-[#6B705C] transition cursor-pointer"
              title={isTimerRunning ? 'Pause Timer' : 'Start Timer'}
            >
              {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleResetTimer}
              className="p-1 rounded-lg hover:bg-white text-[#8A8F80] hover:text-[#2B2D42] transition cursor-pointer"
              title="Reset Timer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(prev => !prev)}
            className="p-2 rounded-xl border border-[#E0DBD0] text-[#6B705C] hover:bg-[#F2EFE9] transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close if modal */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-[#E0DBD0] text-[#8A8F80] hover:text-[#2B2D42] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Split-Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[600px]">
        {/* Left Side: PDF Viewer / Document Panel (7 Columns) */}
        <div className="lg:col-span-7 bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs flex flex-col space-y-4">
          {/* Document Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E0DBD0] pb-3">
            <div className="flex items-center gap-2">
              <label 
                htmlFor="exam-pdf-upload"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload PDF</span>
              </label>
              <input
                id="exam-pdf-upload"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handlePdfUpload}
              />

              <select
                value={selectedSampleId}
                onChange={(e) => {
                  setSelectedSampleId(e.target.value);
                  const s = SAMPLE_PAPERS.find(p => p.id === e.target.value);
                  if (s) {
                    setPdfUrl(null);
                    setExamTitle(s.title);
                    setSelectedSubject(s.subject);
                    handleDurationChange(s.durationMinutes);
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl border border-[#E0DBD0] text-xs font-medium bg-[#F9F7F2] text-[#2B2D42]"
              >
                {SAMPLE_PAPERS.map(p => (
                  <option key={p.id} value={p.id}>Sample: {p.title}</option>
                ))}
              </select>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-[#F9F7F2] p-1 rounded-xl border border-[#E0DBD0]">
              <button
                onClick={() => setZoomLevel(prev => Math.max(60, prev - 15))}
                className="p-1 rounded text-[#8A8F80] hover:text-[#2B2D42] cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1.5 font-bold text-[#6B705C]">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(180, prev + 15))}
                className="p-1 rounded text-[#8A8F80] hover:text-[#2B2D42] cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Document Content View */}
          <div className="flex-1 bg-[#F9F7F2] rounded-2xl border border-[#E0DBD0] overflow-hidden flex flex-col justify-center items-center p-2 min-h-[480px]">
            {pdfUrl ? (
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0&zoom=${zoomLevel}`}
                title="Exam PDF Document"
                className="w-full h-full min-h-[500px] rounded-xl border-none"
              />
            ) : (
              /* Sample Mock Interactive Paper Representation */
              <div 
                className="w-full max-w-xl bg-white p-6 rounded-2xl shadow-sm border border-[#E0DBD0] space-y-4 text-[#2B2D42] overflow-y-auto max-h-[520px]"
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              >
                <div className="border-b-2 border-[#2B2D42] pb-3 text-center space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8A8F80]">
                    Standardized Academic Assessment • Timed Examination
                  </span>
                  <h3 className="text-base font-bold font-serif">{activeSample?.title}</h3>
                  <div className="flex items-center justify-center gap-4 text-xs font-mono text-[#6B705C]">
                    <span>Subject: {activeSample?.subject}</span>
                    <span>•</span>
                    <span>Total Marks: {activeSample?.totalMarks}</span>
                    <span>•</span>
                    <span>Pacing: {activeSample?.durationMinutes} Mins</span>
                  </div>
                </div>

                {/* Question List Preview */}
                <div className="space-y-4 pt-2">
                  {activeSample?.sampleQuestions.map((q, idx) => (
                    <div 
                      key={q.num}
                      onClick={() => setCurrentQIndex(idx)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer ${
                        currentQIndex === idx
                          ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/40'
                          : 'bg-[#FDFBF7] border-[#E0DBD0] hover:border-[#6B705C]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                        <span className="text-[#6B705C] font-mono">Question {q.num} ({q.type.toUpperCase()})</span>
                        {attempts[q.num]?.isFlagged && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md font-bold">
                            <Flag className="w-2.5 h-2.5" /> Flagged
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#2B2D42] leading-relaxed font-serif">{q.prompt}</p>

                      {q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5">
                          {q.options.map(opt => (
                            <div 
                              key={opt}
                              className={`p-1.5 rounded-lg text-xs font-mono border ${
                                attempts[q.num]?.selectedOption === opt.charAt(0)
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold'
                                  : 'bg-white border-[#E0DBD0] text-[#4A4E4D]'
                              }`}
                            >
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Interactive Response Sheet & Question Attempt Panel (5 Columns) */}
        <div className="lg:col-span-5 bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs flex flex-col space-y-4 justify-between">
          <div className="space-y-4">
            {/* Question Quick Navigation Bubbles */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-[#8A8F80] mb-2 font-mono">
                <span>Question Matrix ({currentQIndex + 1}/{totalQuestions})</span>
                <span className="text-emerald-700">
                  {(Object.values(attempts) as QuestionAttempt[]).filter(a => a.selectedOption || a.writtenAnswer?.trim()).length} Attempted
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: totalQuestions }).map((_, idx) => {
                  const qNum = idx + 1;
                  const att = attempts[qNum];
                  const isDone = att?.selectedOption || (att?.writtenAnswer && att.writtenAnswer.trim().length > 0);
                  const isCurrent = currentQIndex === idx;

                  return (
                    <button
                      key={qNum}
                      onClick={() => setCurrentQIndex(idx)}
                      className={`p-2 rounded-xl text-xs font-mono font-bold transition flex flex-col items-center justify-center cursor-pointer relative ${
                        isCurrent
                          ? 'bg-[#2D312E] text-white shadow-xs scale-105'
                          : isDone
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] hover:bg-[#EAE7DF]'
                      }`}
                    >
                      <span>Q{qNum}</span>
                      {att?.isFlagged && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current Question Attempt Area */}
            <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#6B705C]">
                  Question {currentQIndex + 1} Answer Input
                </span>
                <button
                  onClick={() => {
                    const cur = attempts[currentQIndex + 1]?.isFlagged;
                    updateAttempt(currentQIndex + 1, { isFlagged: !cur });
                  }}
                  className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border font-bold transition cursor-pointer ${
                    attempts[currentQIndex + 1]?.isFlagged
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-white text-[#8A8F80] border-[#E0DBD0] hover:text-[#2B2D42]'
                  }`}
                >
                  <Flag className="w-3 h-3" />
                  <span>{attempts[currentQIndex + 1]?.isFlagged ? 'Flagged' : 'Flag for Review'}</span>
                </button>
              </div>

              {/* Type Switcher */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[#8A8F80]">Answer Type:</span>
                {(['mcq', 'short', 'long'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => updateAttempt(currentQIndex + 1, { type: t })}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase cursor-pointer transition ${
                      (attempts[currentQIndex + 1]?.type || 'mcq') === t
                        ? 'bg-[#6B705C] text-white'
                        : 'bg-white border border-[#E0DBD0] text-[#6B705C]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Input for MCQ */}
              {(attempts[currentQIndex + 1]?.type || 'mcq') === 'mcq' && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-[#2B2D42] block">Select Option:</span>
                  <div className="grid grid-cols-4 gap-2">
                    {['A', 'B', 'C', 'D'].map(opt => {
                      const isSel = attempts[currentQIndex + 1]?.selectedOption === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => updateAttempt(currentQIndex + 1, { selectedOption: opt })}
                          className={`py-3 rounded-xl font-mono text-sm font-bold border transition cursor-pointer ${
                            isSel
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                              : 'bg-white text-[#4A4E4D] border-[#E0DBD0] hover:border-[#6B705C]'
                          }`}
                        >
                          Option {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Input for Short or Long Question */}
              {(attempts[currentQIndex + 1]?.type === 'short' || attempts[currentQIndex + 1]?.type === 'long') && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-bold text-[#2B2D42] block">
                    {attempts[currentQIndex + 1]?.type === 'short' ? 'Concise Concept / Calculation Note:' : 'Detailed Structured Solution:'}
                  </span>
                  <textarea
                    rows={attempts[currentQIndex + 1]?.type === 'short' ? 4 : 7}
                    value={attempts[currentQIndex + 1]?.writtenAnswer || ''}
                    onChange={(e) => updateAttempt(currentQIndex + 1, { writtenAnswer: e.target.value })}
                    placeholder="Type derivations, definitions, steps, or final answers..."
                    className="w-full p-3 rounded-xl border border-[#E0DBD0] bg-white text-xs text-[#2B2D42] font-mono focus:outline-none focus:ring-2 focus:ring-[#6B705C]"
                  />
                </div>
              )}
            </div>

            {/* Pagination between questions */}
            <div className="flex items-center justify-between pt-1">
              <button
                disabled={currentQIndex === 0}
                onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E0DBD0] text-xs font-bold text-[#6B705C] hover:bg-[#F2EFE9] disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                disabled={currentQIndex >= totalQuestions - 1}
                onClick={() => setCurrentQIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E0DBD0] text-xs font-bold text-[#6B705C] hover:bg-[#F2EFE9] disabled:opacity-40 transition cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Submission & Recording Button */}
          <div className="border-t border-[#E0DBD0] pt-4 space-y-2">
            <button
              onClick={handleSubmitExam}
              className="w-full py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Submit & Log Exam Score</span>
            </button>
            <p className="text-[11px] text-center text-[#8A8F80]">
              Completed questions and elapsed timer time will be saved directly to your Test Vault.
            </p>
          </div>
        </div>
      </div>

      {/* Submission Success Modal */}
      {showSubmissionSuccess && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4 text-center animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#2B2D42]">Exam Submitted Successfully!</h3>
            <p className="text-xs text-[#8A8F80] leading-relaxed">
              Your responses, timer logs, and completion record have been documented in your Subject Test Vault.
            </p>
            <button
              onClick={() => {
                setShowSubmissionSuccess(false);
                if (onClose) onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-[#6B705C] text-white text-xs font-bold hover:bg-[#5a5f4e] transition cursor-pointer"
            >
              Continue to Study Hub
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
