import React, { useState } from 'react';
import { 
  X, 
  Archive, 
  Search, 
  Bookmark, 
  BookOpen, 
  Download, 
  FileText, 
  ExternalLink, 
  Plus, 
  Check, 
  Sparkles, 
  Award, 
  Share2, 
  Layers, 
  Tag, 
  ShieldCheck,
  GraduationCap,
  Copy,
  ChevronRight
} from 'lucide-react';
import { Subject, UserProfile } from '../types';

export interface SeniorResource {
  id: string;
  title: string;
  subjectName: string;
  category: 'topper_notes' | 'formula_sheet' | 'past_paper_traps' | 'senior_strategy' | 'mentorship_memo';
  author: string;
  authorCredential: string;
  examBoard: string;
  description: string;
  content: string;
  tags: string[];
  dateAdded: string;
  isBookmarked?: boolean;
}

const DEFAULT_SENIOR_RESOURCES: SeniorResource[] = [
  {
    id: 'sr-1',
    title: 'Kinematics & Dynamics Derivation Map',
    subjectName: 'Physics',
    category: 'formula_sheet',
    author: 'Hamza A. (A* CIE Physics & 100/100 Top In Region)',
    authorCredential: 'Senior Mentor • Batch 2025',
    examBoard: 'CIE O/A-Level / FBISE',
    description: 'Every equation of motion, centripetal force derivation, and energy conservation trap summarized into one page with common mark-scheme traps.',
    content: `1. v = u + at, s = ut + 0.5at², v² = u² + 2as (ONLY valid for constant acceleration!).
2. In inclined planes: ALWAYS resolve force parallel (mg sin θ) and perpendicular (mg cos θ).
3. Examiner Trap: Students forget that tension in a pendulum at the lowest point is T = mg + mv²/r, not just mg!
4. Power = Fv: In questions with constant velocity, resultant force is ZERO, so engine force equals resistance.`,
    tags: ['Mechanics', 'Formulas', 'Derivations'],
    dateAdded: '2026-09-15'
  },
  {
    id: 'sr-2',
    title: 'Organic Chemistry Reaction Pathways & Synthesis Guide',
    subjectName: 'Chemistry',
    category: 'topper_notes',
    author: 'Zainab M. (Pre-Med MDCAT 188/200)',
    authorCredential: 'Senior Academic Committee',
    examBoard: 'MDCAT / Cambridge / Punjab Board',
    description: 'Master grid of electrophilic additions, nucleophilic substitutions (SN1 vs SN2), and oxidation states that frequently appear in Section B.',
    content: `1. Primary halogenoalkane -> SN2 (one step, transition state, inversion of stereochemistry).
2. Tertiary halogenoalkane -> SN1 (two steps, carbocation intermediate, racemization).
3. Tollens reagent (AgNO3 in aq NH3): Aldehydes produce silver mirror, ketones do NOT react.
4. Top mistake: Forgetting reflux vs distillation with K2Cr2O7 for primary alcohols! Distillation = Aldehyde; Reflux = Carboxylic acid.`,
    tags: ['Organic', 'Mechanisms', 'Synthesis'],
    dateAdded: '2026-09-20'
  },
  {
    id: 'sr-3',
    title: 'The "Anti-Careless" Past Paper Protocol',
    subjectName: 'General',
    category: 'senior_strategy',
    author: 'Tariq K. (Engineering Dean\'s Honor List)',
    authorCredential: 'Senior Peer Mentor',
    examBoard: 'All Boards',
    description: 'How seniors stop losing 8-12 marks per paper due to silly misreads, units, and rounding errors in the final 15 minutes of the exam.',
    content: `Protocol Step 1: Underline the COMMAND WORD and REQUIRED UNITS before touching your pencil.
Protocol Step 2: Write down units next to each intermediate calculation. If you get cm³, convert immediately to m³ (divide by 10^6).
Protocol Step 3: Keep the last 12 minutes exclusively for backward arithmetic check (re-enter numbers into calculator in reverse).
Protocol Step 4: Never erase your first working until your second attempt is completely verified.`,
    tags: ['Exam Technique', 'Careless Errors', 'Time Management'],
    dateAdded: '2026-09-25'
  },
  {
    id: 'sr-4',
    title: 'Cellular Respiration & Chemiosmosis Flow Breakdown',
    subjectName: 'Biology',
    category: 'topper_notes',
    author: 'Ayesha S. (IGCSE Gold Medalist)',
    authorCredential: 'Senior Academic Fellow',
    examBoard: 'CIE / FBISE / CBSE',
    description: 'Step-by-step proton gradient pumping, ATP synthase rotation, and glycolysis ATP yield accounting without textbook fluff.',
    content: `1. Glycolysis takes place in CYTOPLASM (Anaerobic). Net yield: 2 ATP, 2 NADH, 2 Pyruvate.
2. Link Reaction & Krebs Cycle: Mitochondrial matrix.
3. Oxidative Phosphorylation: Inner mitochondrial membrane (cristae).
4. Mark Scheme Must-Haves: "Protons pumped against concentration gradient from matrix to intermembrane space", "Proton motive force drives ATP synthase via chemiosmosis".`,
    tags: ['Biochemistry', 'Respiration', 'Mitochondria'],
    dateAdded: '2026-09-28'
  },
  {
    id: 'sr-5',
    title: 'Calculus Integration Shortcuts & Substitution Checklist',
    subjectName: 'Mathematics',
    category: 'formula_sheet',
    author: 'Farhan R. (ECAT 380/400)',
    authorCredential: 'Senior Math Lead',
    examBoard: 'ECAT / A-Level Pure / Board',
    description: 'Quick-reference substitution decision matrix: when to use parts, partial fractions, or trigonometric substitutions.',
    content: `1. Integration by Parts: LIATE rule (Logarithmic, Inverse trig, Algebraic, Trigonometric, Exponential).
2. If numerator is derivative of denominator: ∫ f'(x)/f(x) dx = ln |f(x)| + C.
3. If integral contains √(a² - x²), substitute x = a sin θ.
4. If integral contains √(a² + x²), substitute x = a tan θ.
5. Common blunder: Forgetting to change the upper and lower limits when making a definite substitution!`,
    tags: ['Calculus', 'Integration', 'Pure Math'],
    dateAdded: '2026-09-29'
  }
];

interface SeniorResourceLockerModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  userProfile?: UserProfile | null;
  onAddResourceTo137?: (subject: string, title: string) => void;
}

export const SeniorResourceLockerModal: React.FC<SeniorResourceLockerModalProps> = ({
  isOpen,
  onClose,
  subjects,
  userProfile,
  onAddResourceTo137
}) => {
  const [resources, setResources] = useState<SeniorResource[]>(() => {
    try {
      const stored = localStorage.getItem('studyflow_senior_resources');
      return stored ? JSON.parse(stored) : DEFAULT_SENIOR_RESOURCES;
    } catch {
      return DEFAULT_SENIOR_RESOURCES;
    }
  });

  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedResource, setSelectedResource] = useState<SeniorResource | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Resource Form
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState(subjects[0]?.name || 'Physics');
  const [newCategory, setNewCategory] = useState<SeniorResource['category']>('topper_notes');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCredential, setNewCredential] = useState('Senior Mentor / Topper');
  const [newBoard, setNewBoard] = useState('General Board');
  const [newDescription, setNewDescription] = useState('');
  const [newContent, setNewContent] = useState('');

  if (!isOpen) return null;

  const handleSaveResources = (updated: SeniorResource[]) => {
    setResources(updated);
    try {
      localStorage.setItem('studyflow_senior_resources', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleToggleBookmark = (id: string) => {
    const updated = resources.map(r => r.id === id ? { ...r, isBookmarked: !r.isBookmarked } : r);
    handleSaveResources(updated);
  };

  const handleCopyContent = (res: SeniorResource) => {
    navigator.clipboard.writeText(`${res.title}\nBy ${res.author} (${res.authorCredential})\n\n${res.content}`);
    setCopiedId(res.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const created: SeniorResource = {
      id: `sr-${Date.now()}`,
      title: newTitle.trim(),
      subjectName: newSubject,
      category: newCategory,
      author: newAuthor.trim() || 'Senior Contributor',
      authorCredential: newCredential.trim(),
      examBoard: newBoard.trim(),
      description: newDescription.trim() || 'Personal senior study notes and memory triggers.',
      content: newContent.trim(),
      tags: ['Senior Notes', newSubject],
      dateAdded: new Date().toISOString().split('T')[0]
    };

    const updated = [created, ...resources];
    handleSaveResources(updated);
    setIsAddModalOpen(false);

    // Reset
    setNewTitle('');
    setNewDescription('');
    setNewContent('');
  };

  const filteredResources = resources.filter(r => {
    if (selectedSubject !== 'all' && r.subjectName !== selectedSubject) return false;
    if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchDesc = r.description.toLowerCase().includes(q);
      const matchContent = r.content.toLowerCase().includes(q);
      const matchAuthor = r.author.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchContent && !matchAuthor) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-card border border-theme rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl relative text-primary space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-base text-primary">Senior Resource Locker</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Academic Vault
                </span>
              </div>
              <p className="text-[11px] text-muted">Topper notes, annotated formula sheets, past paper traps & senior advice</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-primary text-primary-content hover:opacity-90 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Senior Note</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-surface text-muted hover:text-primary transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search derivations, traps, topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary"
            />
          </div>

          {/* Subject Filter */}
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full p-2 bg-surface border border-theme rounded-xl text-xs font-bold text-primary focus:outline-none focus:border-primary"
          >
            <option value="all">All Subjects ({resources.length})</option>
            {subjects.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
            <option value="General">General Exam Strategy</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full p-2 bg-surface border border-theme rounded-xl text-xs font-bold text-primary focus:outline-none focus:border-primary"
          >
            <option value="all">All Categories</option>
            <option value="topper_notes">Topper Notes & Mindmaps</option>
            <option value="formula_sheet">Formula & Derivation Sheets</option>
            <option value="past_paper_traps">Past Paper Traps</option>
            <option value="senior_strategy">Senior Exam Strategies</option>
          </select>
        </div>

        {/* Resource Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredResources.map((res) => (
            <div
              key={res.id}
              className="p-4 rounded-2xl bg-surface border border-theme hover:border-primary/40 transition shadow-2xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-bold">
                      {res.subjectName}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-surface border border-theme text-muted text-[10px] font-bold">
                      {res.examBoard}
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleBookmark(res.id)}
                    className={`p-1 rounded-lg transition cursor-pointer ${
                      res.isBookmarked ? 'text-amber-500 fill-amber-500' : 'text-muted hover:text-primary'
                    }`}
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="font-serif font-bold text-sm text-primary leading-tight">
                  {res.title}
                </h4>
                <p className="text-xs text-muted leading-relaxed line-clamp-2">
                  {res.description}
                </p>

                <div className="flex items-center gap-1.5 text-[10px] text-muted pt-1">
                  <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="font-semibold text-primary">{res.author}</span>
                  <span>• {res.authorCredential}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-theme/60 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedResource(res)}
                  className="px-2.5 py-1.5 rounded-xl bg-theme-accent hover:bg-surface text-primary font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Read Notes</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopyContent(res)}
                    className="p-1.5 rounded-xl hover:bg-card border border-theme text-muted hover:text-primary transition cursor-pointer"
                    title="Copy note text"
                  >
                    {copiedId === res.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  {onAddResourceTo137 && (
                    <button
                      type="button"
                      onClick={() => onAddResourceTo137(res.subjectName, res.title)}
                      className="px-2 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition cursor-pointer"
                      title="Add to 1-3-7 Spaced Revision"
                    >
                      + 1-3-7 Review
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Read Resource Detail Modal */}
        {selectedResource && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-card border border-theme rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative text-primary space-y-4 max-h-[88vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-theme pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-bold">
                      {selectedResource.subjectName}
                    </span>
                    <span className="text-xs text-muted">{selectedResource.examBoard}</span>
                  </div>
                  <h3 className="font-serif font-bold text-lg text-primary">{selectedResource.title}</h3>
                  <p className="text-xs text-muted">
                    By <strong>{selectedResource.author}</strong> ({selectedResource.authorCredential})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedResource(null)}
                  className="p-1.5 rounded-xl hover:bg-surface text-muted hover:text-primary transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Note Content Box */}
              <div className="p-4 rounded-2xl bg-surface border border-theme space-y-3 font-sans text-xs leading-relaxed text-primary whitespace-pre-line">
                {selectedResource.content}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-theme">
                <button
                  type="button"
                  onClick={() => handleCopyContent(selectedResource)}
                  className="px-3 py-2 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedId === selectedResource.id ? 'Copied to Clipboard!' : 'Copy Resource Notes'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedResource(null)}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-content hover:opacity-90 text-xs font-bold transition cursor-pointer"
                >
                  Done Reading
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Senior Note Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-card border border-theme rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative text-primary space-y-4 max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-theme pb-3">
                <h3 className="font-serif font-bold text-base text-primary">Contribute Senior / Topper Resource</h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-surface text-muted hover:text-primary transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateResource} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-muted block mb-1">Resource Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Electromagnetic Induction Summary & Fleming's Rules"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full p-2.5 bg-surface border border-theme rounded-xl text-primary focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-muted block mb-1">Subject</label>
                    <select
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      className="w-full p-2.5 bg-surface border border-theme rounded-xl font-bold text-primary focus:outline-none focus:border-primary"
                    >
                      {subjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                      <option value="General">General Strategy</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-muted block mb-1">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full p-2.5 bg-surface border border-theme rounded-xl font-bold text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="topper_notes">Topper Notes</option>
                      <option value="formula_sheet">Formula Sheet</option>
                      <option value="past_paper_traps">Past Paper Traps</option>
                      <option value="senior_strategy">Senior Strategy</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-muted block mb-1">Senior Name / Author</label>
                    <input
                      type="text"
                      placeholder="e.g. Bilal S."
                      value={newAuthor}
                      onChange={(e) => setNewAuthor(e.target.value)}
                      className="w-full p-2.5 bg-surface border border-theme rounded-xl text-primary focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-muted block mb-1">Credential / Batch</label>
                    <input
                      type="text"
                      placeholder="e.g. A* Topper / Senior 2025"
                      value={newCredential}
                      onChange={(e) => setNewCredential(e.target.value)}
                      className="w-full p-2.5 bg-surface border border-theme rounded-xl text-primary focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-muted block mb-1">Short Description</label>
                  <input
                    type="text"
                    placeholder="Brief 1-sentence summary of what this sheet covers"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full p-2.5 bg-surface border border-theme rounded-xl text-primary focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="font-bold text-muted block mb-1">Key Formulas / Rules / Notes *</label>
                  <textarea
                    rows={6}
                    required
                    placeholder="Type or paste the core formulas, derivations, or examiner traps..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full p-3 bg-surface border border-theme rounded-xl text-primary font-mono text-xs focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-theme">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3 py-2 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-muted hover:text-primary transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-primary text-primary-content hover:opacity-90 font-bold transition cursor-pointer"
                  >
                    Save to Senior Locker
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
