import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  ChevronRight, 
  ChevronLeft, 
  Pin, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  BookOpen, 
  X, 
  ExternalLink,
  Layers,
  Sparkles,
  Volume2
} from 'lucide-react';
import { 
  AcademicAnnouncement, 
  subscribeAcademicAnnouncements, 
  markAnnouncementRead,
  togglePinAnnouncement
} from '../lib/academicAnnouncementService';

interface AcademicAnnouncementBannerProps {
  onOpenNoticeBoard: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const AcademicAnnouncementBanner: React.FC<AcademicAnnouncementBannerProps> = ({
  onOpenNoticeBoard,
  onNavigateToTab
}) => {
  const [announcements, setAnnouncements] = useState<AcademicAnnouncement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const unsub = subscribeAcademicAnnouncements((items) => {
      // Prioritize pinned and unread notices
      const sorted = [...items].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      setAnnouncements(sorted);
    });
    return unsub;
  }, []);

  if (isDismissed || announcements.length === 0) return null;

  const current = announcements[currentIndex] || announcements[0];
  if (!current) return null;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % announcements.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
  };

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAnnouncementRead(current.id);
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePinAnnouncement(current.id);
  };

  const handleAction = () => {
    if (current.category === 'revision' && onNavigateToTab) {
      onNavigateToTab('137_revision');
    } else if (current.category === 'exam' && onNavigateToTab) {
      onNavigateToTab('test_prep');
    } else {
      onOpenNoticeBoard();
    }
  };

  // Soothing, eye-friendly color tokens based on category
  const getBadgeStyle = (cat: string, priority: string) => {
    if (priority === 'urgent') {
      return 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20';
    }
    switch (cat) {
      case 'exam':
        return 'bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/20';
      case 'revision':
        return 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20';
      case 'teacher':
        return 'bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-500/20';
      default:
        return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-theme shadow-xs transition-all duration-300">
      {/* Gentle ambient background tint for eye comfort */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-amber-500/[0.02] pointer-events-none" />

      <div className="relative p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        
        {/* Left Side: Category Icon & Content */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-surface border border-theme flex items-center justify-center text-primary shrink-0 mt-0.5 sm:mt-0 shadow-2xs">
            {current.category === 'exam' ? (
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            ) : current.category === 'revision' ? (
              <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Bell className="w-4 h-4 text-primary" />
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getBadgeStyle(current.category, current.priority)}`}>
                {current.category.replace('_', ' ')}
              </span>

              {current.pinned && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">
                  <Pin className="w-2.5 h-2.5" /> Pinned
                </span>
              )}

              <span className="text-[11px] text-muted font-medium">
                • {current.author}
              </span>

              {announcements.length > 1 && (
                <span className="text-[10px] text-muted font-mono ml-auto sm:ml-0">
                  [{currentIndex + 1} of {announcements.length}]
                </span>
              )}
            </div>

            <div className="cursor-pointer group" onClick={handleAction}>
              <h4 className="text-xs sm:text-sm font-semibold text-primary truncate group-hover:text-primary/80 transition">
                {current.title}
              </h4>
              <p className="text-xs text-muted line-clamp-1 mt-0.5 leading-relaxed">
                {current.content}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Controls and View Button */}
        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
          {/* Navigation arrows if multiple announcements */}
          {announcements.length > 1 && (
            <div className="flex items-center border border-theme rounded-xl overflow-hidden bg-surface">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
                title="Previous Notice"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer border-l border-theme"
                title="Next Notice"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Action Button */}
          <button
            type="button"
            onClick={onOpenNoticeBoard}
            className="px-3 py-1.5 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-semibold transition flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <span>Notice Board</span>
            <ChevronRight className="w-3 h-3 text-muted" />
          </button>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-xl text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
            title="Collapse Banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
