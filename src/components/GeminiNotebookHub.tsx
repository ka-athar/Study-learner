import React, { useState } from 'react';
import { 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  BookOpen, 
  Layers, 
  Search, 
  Send, 
  ArrowRight, 
  FileText, 
  ShieldAlert, 
  HelpCircle,
  Link as LinkIcon,
  RefreshCw,
  FolderSync,
  Brain,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Bookmark
} from 'lucide-react';
import { Subject, TestResult } from '../types';

interface GeminiNotebookHubProps {
  subjects: Subject[];
  activeSubject: Subject | null;
  testResults: TestResult[];
  onUpdateSubjects?: (subjects: Subject[]) => void;
  onSelectSubject?: (subjectId: string) => void;
  onOpenTopicSprint?: (topicName: string) => void;
}

export const GeminiNotebookHub: React.FC<GeminiNotebookHubProps> = ({
  subjects,
  activeSubject,
  testResults,
  onUpdateSubjects,
  onSelectSubject,
  onOpenTopicSprint,
}) => {
  const currentSubj = activeSubject || subjects[0] || null;
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(currentSubj?.id || '');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [customQuery, setCustomQuery] = useState<string>('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'external_ai' | 'source_compiler' | 'notebooks'>('external_ai');
  const [notebookUrlInput, setNotebookUrlInput] = useState<string>(currentSubj?.geminiNotebookUrl || '');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Prompt mode for Option 3
  const [promptMode, setPromptMode] = useState<'feynman' | 'mistake' | 'quiz' | 'concept'>('feynman');
  const [targetAI, setTargetAI] = useState<'claude' | 'chatgpt' | 'gemini'>('claude');

  const activeSubjObj = subjects.find(s => s.id === selectedSubjectId) || currentSubj;

  // Flatten topics from active subject for selection
  const allTopics = activeSubjObj ? activeSubjObj.chapters.flatMap(ch => ch.topics.map(t => ({
    chapterName: ch.name,
    topicName: t.name,
    status: t.status,
    subtopics: t.subtopics || []
  }))) : [];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const activeTopicObj = allTopics.find(t => t.topicName === selectedTopic) || allTopics[0];
  const topicNameToUse = selectedTopic || (allTopics[0]?.topicName || 'Core Concept');

  // Generate Option 3 pre-engineered prompts tailored for external AI
  const generateExternalAIPrompt = (provider: 'claude' | 'chatgpt' | 'gemini'): string => {
    const subName = activeSubjObj?.name || 'General Science';
    const chName = activeTopicObj?.chapterName || 'Fundamentals';
    const tName = topicNameToUse;
    const subtopicsList = activeTopicObj?.subtopics?.map(s => s.name).join(', ') || 'Core unit topics';

    let promptContent = '';

    if (promptMode === 'feynman') {
      promptContent = `You are an elite tutor using the Feynman Technique to teach complex topics simply.

Course: ${subName}
Chapter: ${chName}
Core Topic: ${tName}
Subtopics: ${subtopicsList}
${customQuery ? `Student Query: "${customQuery}"` : ''}

Deliver a 4-part breakdown:
1. INTUITIVE ANALOGY: Explain this as if I were a bright 12-year-old using a real-world mental model.
2. RIGOROUS MECHANISM: Detail the precise scientific laws, SI units, and equations with boundary conditions.
3. COMMON EXAM TRAPS: Highlight 3 cognitive traps where students lose marks on board papers.
4. ACTIVE RECALL TEST: 2 quick verification questions to test understanding over rote memorization.`;
    } else if (promptMode === 'mistake') {
      const relatedMistakes = testResults.filter(t => t.subjectName.toLowerCase() === subName.toLowerCase());
      const mistakeSummary = relatedMistakes.length > 0 
        ? relatedMistakes.map(r => `Test: ${r.testName} (Score: ${r.score}) - Mistakes: ${r.mistakes}`).join('\n')
        : 'Student is experiencing friction and hesitation on this topic.';

      promptContent = `You are a senior exam board examiner.

Course: ${subName}
Target Topic: ${tName}
Exam Friction & Mistakes:
${mistakeSummary}
${customQuery ? `Specific Question: "${customQuery}"` : ''}

Provide a deep Examiner Autopsy:
1. Pinpoint the root cognitive error (conceptual gap vs calculation slip vs misreading prompt).
2. Detail the exact marking rubric key phrases needed for full credit.
3. Provide a step-by-step solution method that takes under 3 minutes.
4. Provide ONE counter-drill question with identical logic but different numbers to verify mastery.`;
    } else if (promptMode === 'quiz') {
      promptContent = `You are an expert exam paper setter.

Subject: ${subName}
Chapter: ${chName}
Topic: ${tName}
Learning Objectives: ${subtopicsList}
${customQuery ? `Focus Note: "${customQuery}"` : ''}

Generate a 5-question high-yield diagnostic quiz:
- Q1-Q2: Conceptual MCQs with 4 plausible options
- Q3-Q4: Numerical / Structured application problems
- Q5: "Examiner Trap" trick question testing deep comprehension

Include the full answer key with step-by-step reasoning and explanation of why distractors are wrong.`;
    } else {
      // Concept guide
      promptContent = `You are an authoritative subject matter specialist.

Course: ${subName}
Chapter: ${chName}
Topic: ${tName}
Subtopics: ${subtopicsList}
${customQuery ? `Note: "${customQuery}"` : ''}

Create a master-level study guide with:
1. Executive Summary (Why this matters)
2. First Principles Derivations & SI units
3. 3 High-Yield Board Exam Traps & Examiner Warnings
4. Mental Model / Diagram description for long-term retention.`;
    }

    if (provider === 'claude') {
      return `[Context: Advanced Secondary / Pre-University Academic Preparation]\n\n${promptContent}\n\nPlease maintain high structural rigor and no fluff.`;
    } else if (provider === 'chatgpt') {
      return `[Role: Elite Academic Coach & Step-by-Step Problem Solver]\n\n${promptContent}\n\nPlease provide direct, numbered, step-by-step logic.`;
    } else {
      return `[Google Gemini Academic Assistant]\n\n${promptContent}\n\nPlease verify facts against standard academic curriculum benchmarks.`;
    }
  };

  const handleCopyAndLaunch = (provider: 'claude' | 'chatgpt' | 'gemini') => {
    const text = generateExternalAIPrompt(provider);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedType(provider);
      setTimeout(() => setCopiedType(null), 3000);
      showToast(`Copied prompt! Opening ${provider === 'claude' ? 'Claude' : provider === 'chatgpt' ? 'ChatGPT' : 'Google Gemini'} in a new tab...`);
    }

    let url = '';
    if (provider === 'claude') {
      url = 'https://claude.ai/new';
    } else if (provider === 'chatgpt') {
      url = 'https://chatgpt.com/';
    } else if (provider === 'gemini') {
      url = 'https://gemini.google.com/app';
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = (text: string, type: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
      showToast('Copied to clipboard!');
    }
  };

  const handleSaveNotebookUrl = () => {
    if (!activeSubjObj || !onUpdateSubjects) return;
    const trimmed = notebookUrlInput.trim();
    const updated = subjects.map(s => s.id === activeSubjObj.id ? { ...s, geminiNotebookUrl: trimmed } : s);
    onUpdateSubjects(updated);
    showToast(trimmed ? `Linked NotebookLM for ${activeSubjObj.name}!` : `Removed Notebook link for ${activeSubjObj.name}.`);
  };

  const generateFullSubjectSourcePack = (subj: Subject): string => {
    const subTests = testResults.filter(t => t.subjectName.toLowerCase() === subj.name.toLowerCase());
    return `# ${subj.name} — Comprehensive Syllabus & Study Kit
Generated for Google NotebookLM & External AI Study
Course: ${subj.name} | Total Chapters: ${subj.chapters.length}

## Table of Contents & Unit Breakdown
${subj.chapters.map((ch, idx) => `### Unit ${idx + 1}: ${ch.name}
${ch.topics.map(t => `- **${t.name}**: Status = ${t.status || 'Planned'}, Target Focus = ${t.estimatedMinutes || 45} mins`).join('\n')}`).join('\n\n')}

## Common Mistake Logs & Examiner Traps
${subTests.length > 0 ? subTests.map(t => `### Exam: ${t.testName} (Score: ${t.score})
- Date: ${t.date}
- Recorded Mistakes: ${t.mistakes || 'None noted'}
- High-Yield Correction Prompts:
${(t.correctionPrompts || []).map(p => `  * ${p}`).join('\n')}`).join('\n\n') : 'No past exam errors recorded yet for this subject.'}

## External AI Guidance
1. Import this master document into Google NotebookLM (notebooklm.google.com).
2. Generate podcast audio overviews or 10-question high-yield drills.
3. Use with Claude or ChatGPT free web versions for step-by-step problem derivations.
`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2D312E] text-white px-4 py-2.5 rounded-2xl shadow-lg text-xs font-semibold flex items-center gap-2 border border-[#4D7C5D]">
          <Sparkles className="w-4 h-4 text-[#6BA87E]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner - Strict Eye-Comfort Palette */}
      <div className="bg-card border border-theme rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>External AI Companions (Google Gemini • Claude • ChatGPT)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif italic font-bold text-primary">
              AI Study Companions & External Bridges
            </h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Link your syllabus directly with Google Gemini, Claude, and ChatGPT outside the app. Option 3 generates pre-tailored prompts you can copy and open in free web versions with $0 token cost.
            </p>
          </div>

          {/* Quick Launch External Links */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href="https://notebooklm.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              <FileText className="w-4 h-4 text-white" />
              <span>Google NotebookLM</span>
              <ExternalLink className="w-3 h-3 text-white/70" />
            </a>

            <a
              href="https://gemini.google.com/app"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span>Google Gemini Web</span>
              <ExternalLink className="w-3 h-3 text-white/70" />
            </a>

            <a
              href="https://claude.ai/new"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              <Brain className="w-4 h-4 text-white" />
              <span>Claude (Option 3)</span>
              <ExternalLink className="w-3 h-3 text-white/70" />
            </a>

            <a
              href="https://chatgpt.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              <Lightbulb className="w-4 h-4 text-white" />
              <span>ChatGPT (Option 3)</span>
              <ExternalLink className="w-3 h-3 text-white/70" />
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-t border-theme pt-4 mt-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('external_ai')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'external_ai'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-transparent text-muted hover:text-primary hover:bg-theme-accent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Option 3: External Smart Prompts (Claude & ChatGPT & Gemini)</span>
          </button>

          <button
            onClick={() => setActiveTab('source_compiler')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'source_compiler'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-transparent text-muted hover:text-primary hover:bg-theme-accent'
            }`}
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>NotebookLM & Gemini Source Compiler</span>
          </button>

          <button
            onClick={() => setActiveTab('notebooks')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'notebooks'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-transparent text-muted hover:text-primary hover:bg-theme-accent'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Course Gemini Notebooks</span>
          </button>
        </div>
      </div>

      {/* TAB 1: OPTION 3 EXTERNAL SMART PROMPTS (Claude, ChatGPT, Gemini Web) */}
      {activeTab === 'external_ai' && (
        <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-theme pb-4">
            <div>
              <h3 className="text-base font-bold text-primary">Option 3: Free Web AI Companion Bridge</h3>
              <p className="text-xs text-muted">
                Pre-engineered academic prompts designed for 100% free web versions of Claude, ChatGPT, and Google Gemini with $0 cost.
              </p>
            </div>

            {/* Provider destination pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface border border-theme">
              <button
                type="button"
                onClick={() => setTargetAI('claude')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  targetAI === 'claude' ? 'bg-amber-600 text-white shadow-2xs' : 'text-muted hover:text-primary'
                }`}
              >
                Claude
              </button>
              <button
                type="button"
                onClick={() => setTargetAI('chatgpt')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  targetAI === 'chatgpt' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-muted hover:text-primary'
                }`}
              >
                ChatGPT
              </button>
              <button
                type="button"
                onClick={() => setTargetAI('gemini')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  targetAI === 'gemini' ? 'bg-blue-600 text-white shadow-2xs' : 'text-muted hover:text-primary'
                }`}
              >
                Gemini Web
              </button>
            </div>
          </div>

          {/* Context controls: Subject & Topic */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">
                Select Course
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  const sub = subjects.find(s => s.id === e.target.value);
                  setSelectedTopic(sub?.chapters[0]?.topics[0]?.name || '');
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-surface border border-theme text-primary text-xs font-semibold focus:outline-hidden focus:border-primary/50"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.icon || '📚'} {s.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">
                Select Focus Topic
              </label>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-surface border border-theme text-primary text-xs font-semibold focus:outline-hidden focus:border-primary/50"
              >
                {allTopics.map((t, idx) => (
                  <option key={idx} value={t.topicName}>
                    {t.topicName} — {t.chapterName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Blueprint Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">
              Pedagogical Blueprint
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setPromptMode('feynman')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  promptMode === 'feynman'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-surface border-theme text-muted hover:text-primary'
                }`}
              >
                <Brain className="w-4 h-4 mb-1" />
                <div className="text-xs font-bold">Feynman Method</div>
                <div className="text-[10px] opacity-80">Simple analogies + 4 phases</div>
              </button>

              <button
                type="button"
                onClick={() => setPromptMode('mistake')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  promptMode === 'mistake'
                    ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                    : 'bg-surface border-theme text-muted hover:text-primary'
                }`}
              >
                <AlertTriangle className="w-4 h-4 mb-1" />
                <div className="text-xs font-bold">Mistake Autopsy</div>
                <div className="text-[10px] opacity-80">Rubrics & counter-drills</div>
              </button>

              <button
                type="button"
                onClick={() => setPromptMode('quiz')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  promptMode === 'quiz'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-surface border-theme text-muted hover:text-primary'
                }`}
              >
                <HelpCircle className="w-4 h-4 mb-1" />
                <div className="text-xs font-bold">5-Question Drill</div>
                <div className="text-[10px] opacity-80">MCQs + Examiner traps</div>
              </button>

              <button
                type="button"
                onClick={() => setPromptMode('concept')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  promptMode === 'concept'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                    : 'bg-surface border-theme text-muted hover:text-primary'
                }`}
              >
                <BookOpen className="w-4 h-4 mb-1" />
                <div className="text-xs font-bold">Concept Guide</div>
                <div className="text-[10px] opacity-80">Formulas & derivations</div>
              </button>
            </div>
          </div>

          {/* Optional Stumbling Block Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">
              Specific Stumbling Block or Question (Optional)
            </label>
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="e.g. Derive the relationship or explain why the sign is negative in step 2..."
              className="w-full px-4 py-2.5 rounded-2xl bg-surface border border-theme text-primary text-xs focus:outline-hidden focus:border-primary/50"
            />
          </div>

          {/* Prompt Preview Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>Generated Prompt for {targetAI === 'claude' ? 'Claude' : targetAI === 'chatgpt' ? 'ChatGPT' : 'Google Gemini'}</span>
              </label>
              <button
                type="button"
                onClick={() => handleCopy(generateExternalAIPrompt(targetAI), 'prompt_box')}
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                {copiedType === 'prompt_box' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-theme max-h-56 overflow-y-auto text-xs font-mono text-muted whitespace-pre-wrap leading-relaxed select-all">
              {generateExternalAIPrompt(targetAI)}
            </div>
          </div>

          {/* Launch Buttons Strip */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Option 3: External bridge with $0 cost. Simply paste (Ctrl+V / Cmd+V) when the tab opens!</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleCopyAndLaunch('claude')}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Copy & Launch Claude</span>
                <ExternalLink className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={() => handleCopyAndLaunch('chatgpt')}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Copy & Launch ChatGPT</span>
                <ExternalLink className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={() => handleCopyAndLaunch('gemini')}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Copy & Open Gemini</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NOTEBOOKLM SOURCE COMPILER */}
      {activeTab === 'source_compiler' && activeSubjObj && (
        <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-4">
            <div>
              <h3 className="text-base font-bold text-primary">Master Syllabus Source Compiler</h3>
              <p className="text-xs text-muted">
                Compile your entire syllabus, units, and past exam mistake logs into a single structured source document ready to paste into Google NotebookLM or Gemini.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(generateFullSubjectSourcePack(activeSubjObj), 'source_pack')}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
              >
                {copiedType === 'source_pack' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Copied Master Source!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Full Master Source</span>
                  </>
                )}
              </button>

              <a
                href="https://notebooklm.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-surface border border-theme hover:bg-theme-accent text-primary text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Launch NotebookLM</span>
                <ExternalLink className="w-3 h-3 text-muted" />
              </a>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface border border-theme max-h-96 overflow-y-auto text-xs font-mono text-muted whitespace-pre-wrap leading-relaxed select-all">
            {generateFullSubjectSourcePack(activeSubjObj)}
          </div>
        </div>
      )}

      {/* TAB 3: SUBJECT NOTEBOOKS MANAGER */}
      {activeTab === 'notebooks' && (
        <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-primary">Saved Google NotebookLM Course Links</h3>
            <p className="text-xs text-muted">
              Paste the public share link or project URL of your NotebookLM or Gemini Notebook for each course.
            </p>
          </div>

          <div className="space-y-4">
            {subjects.map(s => (
              <div key={s.id} className="p-4 rounded-2xl bg-surface border border-theme flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.icon || '📚'}</span>
                  <div>
                    <h4 className="text-sm font-bold text-primary">{s.name}</h4>
                    <p className="text-xs text-muted">
                      {s.geminiNotebookUrl ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-mono">
                          Linked: {s.geminiNotebookUrl.slice(0, 50)}...
                        </span>
                      ) : (
                        'No notebook linked yet'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {s.geminiNotebookUrl ? (
                    <a
                      href={s.geminiNotebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:opacity-90"
                    >
                      <span>Open Notebook</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      const newUrl = prompt(`Enter Google NotebookLM / Gemini link for ${s.name}:`, s.geminiNotebookUrl || '');
                      if (newUrl !== null && onUpdateSubjects) {
                        const updated = subjects.map(item => item.id === s.id ? { ...item, geminiNotebookUrl: newUrl.trim() } : item);
                        onUpdateSubjects(updated);
                        showToast(`Updated Notebook link for ${s.name}!`);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-surface border border-theme text-xs font-semibold text-primary hover:bg-theme-accent cursor-pointer"
                  >
                    {s.geminiNotebookUrl ? 'Edit URL' : 'Link Notebook'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
