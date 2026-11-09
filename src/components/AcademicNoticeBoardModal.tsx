import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  Pin, 
  Check, 
  Trash2, 
  Plus, 
  Calendar, 
  BookOpen, 
  AlertCircle, 
  Search, 
  CheckCircle2, 
  ExternalLink,
  GraduationCap,
  Layers,
  Sparkles,
  School,
  RefreshCw,
  Clock
} from 'lucide-react';
import { 
  AcademicAnnouncement, 
  AnnouncementCategory, 
  AnnouncementPriority, 
  loadAcademicAnnouncements, 
  saveAcademicAnnouncements,
  addAcademicAnnouncement,
  togglePinAnnouncement,
  markAnnouncementRead,
  markAllAnnouncementsRead,
  deleteAcademicAnnouncement,
  importGoogleClassroomAnnouncements
} from '../lib/academicAnnouncementService';
import { listCourseAnnouncements } from '../lib/googleClassroomService';

interface AcademicNoticeBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const AcademicNoticeBoardModal: React.FC<AcademicNoticeBoardModalProps> = ({
  isOpen,
  onClose,
  onNavigateToTab
}) => {
  const [announcements, setAnnouncements] = useState<AcademicAnnouncement[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isSyncingClassroom, setIsSyncingClassroom] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Form states for adding announcement
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<AnnouncementCategory>('exam');
  const [newPriority, setNewPriority] = useState<AnnouncementPriority>('normal');
  const [newAuthor, setNewAuthor] = useState('Academic Directive');

  const refreshList = () => {
    setAnnouncements(loadAcademicAnnouncements());
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    addAcademicAnnouncement({
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      priority: newPriority,
      author: newAuthor.trim() || 'Self',
      pinned: false,
      read: false,
      source: 'custom'
    });

    setNewTitle('');
    setNewContent('');
    setIsCreating(false);
    refreshList();
    showToast('Academic notice posted to your notice board!');
  };

  const handleTogglePin = (id: string) => {
    togglePinAnnouncement(id);
    refreshList();
  };

  const handleDelete = (id: string) => {
    deleteAcademicAnnouncement(id);
    refreshList();
  };

  const handleMarkAllRead = () => {
    markAllAnnouncementsRead();
    refreshList();
    showToast('All announcements marked as read.');
  };

  // Import from Google Classroom courses if available
  const handleSyncClassroomAnnouncements = async () => {
    setIsSyncingClassroom(true);
    try {
      // Check stored classroom courses in localStorage
      const coursesRaw = localStorage.getItem('studyflow_google_classroom_courses');
      if (!coursesRaw) {
        showToast('Connect Google Classroom in Workspace Hub first to auto-import notices.');
        setIsSyncingClassroom(false);
        return;
      }
      const courses = JSON.parse(coursesRaw);
      if (!Array.isArray(courses) || courses.length === 0) {
        showToast('No enrolled Google Classroom courses found.');
        setIsSyncingClassroom(false);
        return;
      }

      let totalImported = 0;
      for (const course of courses.slice(0, 5)) {
        try {
          const rawAnn = await listCourseAnnouncements(course.id);
          const mapped = rawAnn.map((a: any) => ({
            id: a.id,
            text: a.text || '',
            courseTitle: course.name,
            creationTime: a.creationTime,
            authorName: course.teacherName || course.name
          }));
          totalImported += importGoogleClassroomAnnouncements(mapped);
        } catch (e) {
          // ignore individual course error
        }
      }

      refreshList();
      if (totalImported > 0) {
        showToast(`Imported ${totalImported} new classroom announcements!`);
      } else {
        showToast('Notice board is already up to date with Classroom.');
      }
    } catch (e) {
      showToast('Could not fetch classroom stream. Please re-authenticate in Workspace Hub.');
    } finally {
      setIsSyncingClassroom(false);
    }
  };

  // Filtered list
  const filtered = announcements.filter(a => {
    const matchesCategory = activeCategory === 'all' || a.category === activeCategory;
    const matchesQuery = searchQuery.trim() === '' || 
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  }).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const categories = [
    { id: 'all', label: 'All Notices' },
    { id: 'exam', label: '📅 Exam & Board' },
    { id: 'revision', label: '🧠 1-3-7 Revision' },
    { id: 'teacher', label: '🏫 Teachers & Stream' },
    { id: 'study_habit', label: '⚡ Study Directives' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-theme rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header - Soothing, Eye-Friendly Header */}
        <div className="p-5 border-b border-theme bg-surface/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-primary">Academic Notice Board</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-theme text-muted">
                  Option 9 Center
                </span>
              </div>
              <p className="text-xs text-muted">
                Official exam timelines, 1-3-7 memory preservation directives, and teacher broadcasts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncClassroomAnnouncements}
              disabled={isSyncingClassroom}
              className="p-2 rounded-xl text-muted hover:text-primary hover:bg-theme-accent border border-theme text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Sync with Google Classroom Course Stream"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingClassroom ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Classroom</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCreating(!isCreating)}
              className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Post Notice</span>
            </button>

            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Toast */}
        {feedbackToast && (
          <div className="px-5 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
            <span>{feedbackToast}</span>
            <button onClick={() => setFeedbackToast(null)} className="font-bold opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Create Notice Form (Collapsible) */}
        {isCreating && (
          <form onSubmit={handleAddSubmit} className="p-4 border-b border-theme bg-surface/40 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>Create New Academic Directive</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs text-muted hover:text-primary"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Notice Title (e.g. Physics Ch-4 Mock Test Announcement)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-primary text-xs focus:outline-hidden focus:border-primary/50"
                  required
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Author (e.g. Mentor, Self, Teacher)"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-primary text-xs focus:outline-hidden focus:border-primary/50"
                />
              </div>
            </div>

            <textarea
              placeholder="Notice description, syllabus boundaries, instructions, and revision reminders..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-primary text-xs focus:outline-hidden focus:border-primary/50"
              required
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as AnnouncementCategory)}
                  className="px-2.5 py-1.5 rounded-lg bg-card border border-theme text-primary text-xs"
                >
                  <option value="exam">📅 Exam & Board</option>
                  <option value="revision">🧠 1-3-7 Revision</option>
                  <option value="teacher">🏫 Teacher Notice</option>
                  <option value="study_habit">⚡ Study Habit</option>
                  <option value="urgent">🚨 Urgent Academic</option>
                </select>

                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as AnnouncementPriority)}
                  className="px-2.5 py-1.5 rounded-lg bg-card border border-theme text-primary text-xs"
                >
                  <option value="normal">Normal Priority</option>
                  <option value="important">Important Priority</option>
                  <option value="urgent">Urgent Priority</option>
                </select>
              </div>

              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Publish Notice
              </button>
            </div>
          </form>
        )}

        {/* Filter Strip & Search */}
        <div className="p-3.5 border-b border-theme bg-surface/20 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          {/* Categories */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto scrollbar-none pb-1 sm:pb-0">
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  activeCategory === c.id
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-surface/50 border border-theme text-muted hover:text-primary'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Search box & Mark all read */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search notices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-card border border-theme text-primary text-xs focus:outline-hidden focus:border-primary/50"
              />
            </div>

            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[11px] text-muted hover:text-primary whitespace-nowrap px-2 py-1.5 rounded-lg hover:bg-theme-accent transition cursor-pointer"
              title="Mark all as read"
            >
              Mark Read
            </button>
          </div>
        </div>

        {/* Announcements List - Soothing, Eye-Friendly Layout */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted space-y-2">
              <Bell className="w-10 h-10 mx-auto opacity-30 text-primary" />
              <p className="text-xs font-medium">No announcements match your search or filter.</p>
              <button
                type="button"
                onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}
                className="text-xs text-primary hover:underline font-semibold"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filtered.map((item) => {
              const isUrgent = item.priority === 'urgent';
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 relative group ${
                    item.pinned
                      ? 'bg-amber-500/[0.04] border-amber-500/30'
                      : 'bg-surface/50 border-theme hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        isUrgent 
                          ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20'
                          : 'bg-primary/10 text-primary border-primary/20'
                      }`}>
                        {item.category.replace('_', ' ')}
                      </span>

                      <span className="text-xs text-muted font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.date} • {item.author}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(item.id)}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          item.pinned 
                            ? 'text-amber-600 bg-amber-500/15'
                            : 'text-muted hover:text-primary hover:bg-theme-accent'
                        }`}
                        title={item.pinned ? 'Unpin' : 'Pin to top'}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Delete notice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-primary mb-1">
                    {item.title}
                  </h4>

                  <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap">
                    {item.content}
                  </p>

                  {/* Optional action button */}
                  {item.actionLabel && (
                    <div className="mt-3 pt-2 border-t border-theme/50 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.category === 'revision' && onNavigateToTab) {
                            onNavigateToTab('137_revision');
                            onClose();
                          } else if (item.category === 'exam' && onNavigateToTab) {
                            onNavigateToTab('test_prep');
                            onClose();
                          }
                        }}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>{item.actionLabel}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme bg-surface/80 flex items-center justify-between text-xs text-muted shrink-0">
          <span>{announcements.length} academic announcements stored locally & synced with cloud.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
