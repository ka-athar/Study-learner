import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  Sparkles, 
  BookOpen, 
  AlertTriangle, 
  HelpCircle, 
  Layers, 
  FileText, 
  Share2, 
  Brain,
  Lightbulb,
  CheckCircle2,
  Bookmark,
  Compass,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { Subject, Topic, MistakeEntry } from '../types';

interface ExternalAIBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubjectId?: string;
  initialTopicName?: string;
  initialMistake?: MistakeEntry | null;
  mode?: 'concept' | 'mistake' | 'quiz' | 'feynman' | 'free_inquiry';
}

export type AIProvider = 'gemini' | 'claude' | 'chatgpt';

export const ExternalAIBridgeModal: React.FC<ExternalAIBridgeModalProps> = ({
  isOpen,
  onClose,
  subjects,
  initialSubjectId,
  initialTopicName,
  initialMistake,
  mode: initialMode = 'concept'
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSubjectId || subjects[0]?.id || ''
  );
  const [selectedTopicName, setSelectedTopicName] = useState<string>(initialTopicName || '');
  const [promptMode, setPromptMode] = useState<'concept' | 'mistake' | 'quiz' | 'feynman' | 'free_inquiry'>(
    initialMistake ? 'mistake' : initialMode
  );
  const [customInquiry, setCustomInquiry] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('claude');
  const [copiedSuccess, setCopiedSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSubject = subjects.find(s => s.id === selectedSubjectId) || subjects[0];

  // Flatten all topics for current subject
  const subjectTopics = currentSubject 
    ? currentSubject.chapters.flatMap(ch => ch.topics.map(t => ({
        chapterName: ch.name,
        name: t.name,
        status: t.status,
        subtopics: t.subtopics || []
      })))
    : [];

  const activeTopic = subjectTopics.find(t => t.name === selectedTopicName) || subjectTopics[0];

  // Helper to generate deeply structured prompt tailored for Claude, ChatGPT, or Gemini
  const generatePrompt = (provider: AIProvider): string => {
    const subjectName = currentSubject?.name || 'General Science';
    const topicTitle = activeTopic?.name || selectedTopicName || 'Core Topic';
    const chapterTitle = activeTopic?.chapterName || 'General Chapter';
    const subtopicsList = activeTopic?.subtopics?.map(s => s.name).join(', ') || 'Standard syllabus subtopics';

    let promptBody = '';

    if (promptMode === 'feynman') {
      promptBody = `You are a world-class academic mentor utilizing the Feynman Technique to teach complex topics simply.

Academic Course: ${subjectName}
Chapter: ${chapterTitle}
Core Concept: ${topicTitle}
Key Subtopics: ${subtopicsList}
${customInquiry ? `Student Question / Friction Point: "${customInquiry}"` : ''}

Please structure your response into 4 distinct phases:
1. THE INTUITIVE ANALOGY: Explain this concept as if I were a bright 12-year-old using a vivid real-world mental model.
2. TECHNICAL FOUNDATION & KEY EQUATIONS: Detail the precise scientific/mathematical rules, boundary conditions, and standard board notation.
3. COMMON MISCONCEPTIONS & PITFALLS: Highlight the top 3 cognitive traps where students lose marks on exams.
4. ACTIVE RECALL CHECK: Provide 2 quick verification questions to test whether I truly understand the mechanism or simply memorized terms.`;
    } else if (promptMode === 'mistake') {
      const mistakeInfo = initialMistake ? `
Exam Question: "${initialMistake.question}"
My Incorrect Answer / Work: "${initialMistake.userAttempt || 'N/A'}"
Correct Answer Approach: "${initialMistake.correctAnswer || 'N/A'}"
Identified Category: ${initialMistake.errorCategory}
Student Notes: ${initialMistake.notes || 'None'}
` : `Recent student friction in: ${topicTitle}. ${customInquiry ? `Notes: "${customInquiry}"` : ''}`;

      promptBody = `You are an expert senior examiner and cognitive diagnostic tutor.

Academic Subject: ${subjectName}
Topic: ${topicTitle}
${mistakeInfo}

Please conduct a deep Examiner Autopsy:
1. ROOT CAUSE DIAGNOSIS: Pinpoint whether the error was conceptual gap, calculation careless slip, misreading prompt, or timing panic.
2. EXAMINER MARKING SCHEME RUBRIC: Exactly what key phrases or step markers are required to earn full credit on this question.
3. STEP-BY-STEP REPAIR: Walk through the bulletproof method to solve this cleanly in under 3 minutes.
4. ISOMORPHIC COUNTER-DRILL: Give me ONE fresh question with identical underlying logic but different numbers/variables so I can solve it immediately and cure this mistake.`;
    } else if (promptMode === 'quiz') {
      promptBody = `You are an elite exam board paper setter.

Subject: ${subjectName}
Chapter: ${chapterTitle}
Target Concept: ${topicTitle}
Syllabus Learning Objectives: ${subtopicsList}
${customInquiry ? `Specific Focus: "${customInquiry}"` : ''}

Generate a 5-Question High-Yield Diagnostic Drill:
- Questions 1-2: Conceptual Foundation & Mechanics (MCQ with 4 distinct distractors)
- Questions 3-4: Numerical / Application Problem (Exam-level difficulty)
- Question 5: Examiner Trap / "Trick" Question that tests deep mastery

At the end of your response, provide the Answer Key with:
- Detailed step-by-step reasoning for each correct answer
- "Why the distractors are wrong" breakdown for questions 1-2
- Scoring rubric for full marks`;
    } else if (promptMode === 'concept') {
      promptBody = `You are an authoritative academic specialist and tutor.

Subject: ${subjectName}
Chapter: ${chapterTitle}
Topic: ${topicTitle}
Included Subtopics: ${subtopicsList}
${customInquiry ? `Student Context / Questions: "${customInquiry}"` : ''}

Please provide a master-level study guide containing:
1. Executive Summary & Big Picture (Why this concept matters in ${subjectName})
2. Core First Principles & Detailed Derivations
3. Essential Formulas with variable definitions & SI units
4. 3 High-Yield Board Exam Traps & Examiner Warnings
5. Visual Diagram Description / Mental Model to remember long-term`;
    } else {
      // Free inquiry
      promptBody = `Course: ${subjectName}
Topic: ${topicTitle}
Student Inquiry: ${customInquiry || 'Provide high-yield study assistance for this topic.'}

Please deliver a clear, mathematically and conceptually rigorous explanation adhering to standard academic standards.`;
    }

    // Provider-specific tailoring prefix
    if (provider === 'claude') {
      return `[Context: Advanced Secondary / Pre-University Academic Preparation]\n\n${promptBody}\n\nPlease maintain high intellectual rigor, clear structural formatting, and avoid conversational fluff.`;
    } else if (provider === 'chatgpt') {
      return `[Role: Elite Academic Coach & Step-by-Step Problem Solver]\n\n${promptBody}\n\nPlease be direct, provide step-by-step numbered logic, and emphasize practical test-taking strategies.`;
    } else {
      // Gemini
      return `[Google Gemini Academic Assistant]\n\n${promptBody}\n\nPlease cross-reference with standard curriculum standards and provide verified, concise facts.`;
    }
  };

  const currentPrompt = generatePrompt(selectedProvider);

  const handleCopyAndLaunch = (provider: AIProvider) => {
    const textToCopy = generatePrompt(provider);

    // Copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedSuccess(provider);
      setTimeout(() => setCopiedSuccess(null), 3500);
    }

    // Launch external web tool (free web versions, $0 cost, completely external to the app)
    let url = '';
    if (provider === 'claude') {
      url = 'https://claude.ai/new';
    } else if (provider === 'chatgpt') {
      url = 'https://chatgpt.com/';
    } else if (provider === 'gemini') {
      url = 'https://gemini.google.com/app';
    }

    // Open in new tab outside the app
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenNotebookLM = () => {
    // If subject has specific notebook URL, open it; otherwise open general NotebookLM
    const targetUrl = currentSubject?.geminiNotebookUrl || 'https://notebooklm.google.com/';
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-theme rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header - Soothing, Eye-Friendly Header */}
        <div className="p-5 border-b border-theme bg-surface/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-primary">External AI Study Bridge</h3>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  100% Free • $0 Token Cost
                </span>
              </div>
              <p className="text-xs text-muted">
                One-click deep prompt generator connecting with Claude, ChatGPT & Google Gemini in your browser
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          
          {/* Provider Selector Strip (Claude, ChatGPT, Google Gemini) */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">
              1. Choose External AI Destination
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Claude Option */}
              <button
                type="button"
                onClick={() => setSelectedProvider('claude')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  selectedProvider === 'claude'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20 shadow-xs'
                    : 'bg-surface/50 border-theme text-muted hover:text-primary hover:border-theme-accent'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Claude (Anthropic)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono">
                    Free Web
                  </span>
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  Best for deep conceptual reasoning, nuance, long syllabi & Feynman breakdown.
                </p>
              </button>

              {/* ChatGPT Option */}
              <button
                type="button"
                onClick={() => setSelectedProvider('chatgpt')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  selectedProvider === 'chatgpt'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-surface/50 border-theme text-muted hover:text-primary hover:border-theme-accent'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    ChatGPT (OpenAI)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono">
                    Free Web
                  </span>
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  Best for fast numerical solving, practice question sets & step-by-step math.
                </p>
              </button>

              {/* Google Gemini Option */}
              <button
                type="button"
                onClick={() => setSelectedProvider('gemini')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  selectedProvider === 'gemini'
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-surface/50 border-theme text-muted hover:text-primary hover:border-theme-accent'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Google Gemini (Web)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 font-mono">
                    External Link
                  </span>
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  Opens Gemini / NotebookLM in new tab outside the app with pre-formatted prompt.
                </p>
              </button>
            </div>
          </div>

          {/* Context Selector: Subject & Topic Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-surface/40 border border-theme">
            <div>
              <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                Subject Context
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  const sub = subjects.find(s => s.id === e.target.value);
                  const firstTopic = sub?.chapters[0]?.topics[0]?.name || '';
                  setSelectedTopicName(firstTopic);
                }}
                className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-primary text-xs font-medium focus:outline-hidden focus:border-primary/50"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.icon || '📚'} {s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                Active Topic / Chapter
              </label>
              <select
                value={selectedTopicName}
                onChange={(e) => setSelectedTopicName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-primary text-xs font-medium focus:outline-hidden focus:border-primary/50"
              >
                {subjectTopics.map((t, idx) => (
                  <option key={idx} value={t.name}>
                    {t.name} ({t.chapterName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mode Selector (Feynman, Mistake Autopsy, High-Yield Quiz, Deep Concept, Inquiry) */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">
              2. Select Pedagogical Prompt Blueprint
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPromptMode('feynman')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  promptMode === 'feynman'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-surface border-theme text-muted hover:text-primary'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Feynman Technique</span>
              </button>

              <button
                type="button"
                onClick={() => setPromptMode('mistake')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  promptMode === 'mistake'
                    ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                    : 'bg-surface border-theme text-muted hover:text-primary'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Examiner Mistake Autopsy</span>
              </button>

              <button
                type="button"
                onClick={() => setPromptMode('quiz')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  promptMode === 'quiz'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-surface border-theme text-muted hover:text-primary'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>5-Question Drill Setter</span>
              </button>

              <button
                type="button"
                onClick={() => setPromptMode('concept')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  promptMode === 'concept'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                    : 'bg-surface border-theme text-muted hover:text-primary'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Deep Syllabus Guide</span>
              </button>

              <button
                type="button"
                onClick={() => setPromptMode('free_inquiry')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  promptMode === 'free_inquiry'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-surface border-theme text-muted hover:text-primary'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Custom Question</span>
              </button>
            </div>
          </div>

          {/* Optional Custom Inquiry or Clarification Note */}
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
              Add Specific Question or Stumbling Block (Optional)
            </label>
            <input
              type="text"
              value={customInquiry}
              onChange={(e) => setCustomInquiry(e.target.value)}
              placeholder="e.g. Why does resistance increase with temperature? or verify step 3 derivation..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-theme text-primary text-xs focus:outline-hidden focus:border-primary/50"
            />
          </div>

          {/* Generated Prompt Preview with Anti-Eye-Strain Design */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>Generated Smart Prompt (Ready to Paste)</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(currentPrompt);
                    setCopiedSuccess('prompt_only');
                    setTimeout(() => setCopiedSuccess(null), 2500);
                  }
                }}
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                {copiedSuccess === 'prompt_only' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Prompt Only</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-surface/70 border border-theme max-h-44 overflow-y-auto text-xs font-mono text-muted whitespace-pre-wrap leading-relaxed select-all">
              {currentPrompt}
            </div>
          </div>

          {/* Special Google NotebookLM Link (External bridge) */}
          <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-primary">Google NotebookLM Companion Link</h4>
                <p className="text-[11px] text-muted">
                  {currentSubject?.geminiNotebookUrl 
                    ? `Linked to: ${currentSubject.geminiNotebookUrl.slice(0, 45)}...`
                    : `Load entire ${currentSubject?.name} textbook/notes into Google's NotebookLM externally`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenNotebookLM}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
            >
              <span>Open NotebookLM</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Footer Actions: Launch Provider Outside the App */}
        <div className="p-4 border-t border-theme bg-surface/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-muted flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Copies prompt to your clipboard and opens in a new browser tab with $0 free AI.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-theme text-xs font-medium text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
            >
              Done
            </button>

            <button
              type="button"
              onClick={() => handleCopyAndLaunch(selectedProvider)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
            >
              {copiedSuccess === selectedProvider ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Prompt Copied! Opening Browser...</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>
                    Copy & Launch {selectedProvider === 'claude' ? 'Claude' : selectedProvider === 'chatgpt' ? 'ChatGPT' : 'Gemini'}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
