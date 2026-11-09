/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import { 
  Clock, 
  Play, 
  GripVertical, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Maximize2,
  Minimize2,
  Sparkles,
  Calendar as CalendarIcon
} from 'lucide-react';
import { InAppCalendarEvent, StudyPlan, StudyPlanTopic, ExamDate } from '../types';
import { 
  timeStringToMinutes, 
  minutesTo12HourTime, 
  calculateConsistentEndTime,
  analyzeStudyTopicIntoCalendarEvent 
} from '../lib/inbuiltCalendarAnalyzer';

interface InteractiveDayTimelineCardProps {
  selectedDateStr: string;
  events: InAppCalendarEvent[];
  plans: StudyPlan[];
  dayExams?: ExamDate[];
  onSavePlan?: (plan: StudyPlan) => void;
  onStartTimerForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onDeleteEvent?: (event: InAppCalendarEvent) => void;
}

const START_HOUR = 7;  // 7:00 AM
const END_HOUR = 23;   // 11:00 PM
const TOTAL_HOURS = END_HOUR - START_HOUR;
const HOUR_HEIGHT_PX = 60; // 1 pixel per minute

export const InteractiveDayTimelineCard: React.FC<InteractiveDayTimelineCardProps> = ({
  selectedDateStr,
  events,
  plans,
  dayExams = [],
  onSavePlan,
  onStartTimerForTopic,
  onDeleteEvent
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Dragging and resizing interaction state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<'move' | 'resize' | null>(null);
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [initialStartMin, setInitialStartMin] = useState<number>(0);
  const [initialDuration, setInitialDuration] = useState<number>(60);
  
  // Live dragging offsets
  const [dragCurrentStartMin, setDragCurrentStartMin] = useState<number | null>(null);
  const [dragCurrentDuration, setDragCurrentDuration] = useState<number | null>(null);

  // Convert hours to list
  const hoursList = useMemo(() => {
    const list: Array<{ hour: number; label: string; minOfDay: number }> = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      const minOfDay = h * 60;
      const label = minutesTo12HourTime(minOfDay);
      list.push({ hour: h, label, minOfDay });
    }
    return list;
  }, []);

  // Compute position & clash status for events
  const positionedEvents = useMemo(() => {
    return events.map(evt => {
      let startMin = timeStringToMinutes(evt.startTime || '6:00 PM');
      let duration = evt.durationMinutes || 60;

      // Apply live drag overrides
      if (activeDragId === evt.id) {
        if (dragCurrentStartMin !== null) startMin = dragCurrentStartMin;
        if (dragCurrentDuration !== null) duration = dragCurrentDuration;
      }

      const endMin = startMin + duration;
      const topPx = Math.max(0, (startMin - START_HOUR * 60));
      const heightPx = Math.max(28, duration);

      // Check collisions with other events
      const hasClash = events.some(other => {
        if (other.id === evt.id) return false;
        const oStart = timeStringToMinutes(other.startTime || '6:00 PM');
        const oEnd = oStart + (other.durationMinutes || 60);
        return startMin < oEnd && endMin > oStart;
      });

      return {
        event: evt,
        startMin,
        endMin,
        duration,
        topPx,
        heightPx,
        hasClash
      };
    });
  }, [events, activeDragId, dragCurrentStartMin, dragCurrentDuration]);

  // Pointer event handlers for moving
  const handleStartMove = (e: React.PointerEvent, evtId: string, currentStartMin: number, currentDur: number) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setActiveDragId(evtId);
    setDragMode('move');
    setDragStartY(e.clientY);
    setInitialStartMin(currentStartMin);
    setInitialDuration(currentDur);
    setDragCurrentStartMin(currentStartMin);
    setDragCurrentDuration(currentDur);
  };

  // Pointer event handlers for resizing
  const handleStartResize = (e: React.PointerEvent, evtId: string, currentStartMin: number, currentDur: number) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setActiveDragId(evtId);
    setDragMode('resize');
    setDragStartY(e.clientY);
    setInitialStartMin(currentStartMin);
    setInitialDuration(currentDur);
    setDragCurrentStartMin(currentStartMin);
    setDragCurrentDuration(currentDur);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeDragId || !dragMode) return;

    const deltaY = e.clientY - dragStartY;
    // 1px = 1 minute. Snap to 15-minute intervals.
    const deltaMinutes = Math.round(deltaY / 15) * 15;

    if (dragMode === 'move') {
      const newStart = Math.max(
        START_HOUR * 60,
        Math.min((END_HOUR * 60) - initialDuration, initialStartMin + deltaMinutes)
      );
      setDragCurrentStartMin(newStart);
    } else if (dragMode === 'resize') {
      const newDur = Math.max(15, Math.min(240, initialDuration + deltaMinutes));
      setDragCurrentDuration(newDur);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!activeDragId) return;

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore if not captured
    }

    // Persist updated times
    if (dragCurrentStartMin !== null && onSavePlan) {
      const targetEvent = events.find(ev => ev.id === activeDragId);
      if (targetEvent) {
        const finalStartMin = dragCurrentStartMin;
        const finalDuration = dragCurrentDuration || initialDuration;
        const timeCalc = calculateConsistentEndTime(minutesTo12HourTime(finalStartMin), finalDuration);

        // Find parent study plan
        const parentPlan = plans.find(p => p.date === selectedDateStr) || plans[0];
        if (parentPlan) {
          const updatedTopics = (parentPlan.topics || []).map(t => {
            const matches = (targetEvent.planTopicId && t.id === targetEvent.planTopicId) ||
              (t.topicName.toLowerCase() === targetEvent.topicName.toLowerCase());
            
            if (matches) {
              return {
                ...t,
                startTime: timeCalc.startTime12,
                endTime: timeCalc.endTime12,
                deadline: timeCalc.endTime12,
                estimatedMinutes: finalDuration,
                date: selectedDateStr
              };
            }
            return t;
          });

          const updatedPlan: StudyPlan = {
            ...parentPlan,
            topics: updatedTopics,
            updatedAt: new Date().toISOString()
          };

          // Regenerate calendar events
          updatedPlan.calendarEvents = updatedTopics.map((tp, idx) => 
            analyzeStudyTopicIntoCalendarEvent(updatedPlan, tp, idx)
          );

          onSavePlan(updatedPlan);
        }
      }
    }

    // Reset interaction state
    setActiveDragId(null);
    setDragMode(null);
    setDragCurrentStartMin(null);
    setDragCurrentDuration(null);
  };

  // Instant buffer recommendation & auto-shift to clear collision
  const handleAutoShiftBuffer = (evtId: string, currentStart: number, currentDur: number) => {
    const otherEvents = events.filter(e => e.id !== evtId);
    let shiftedStart = currentStart;
    let iterations = 0;
    while (iterations < 24) {
      const clash = otherEvents.some(other => {
        const oStart = timeStringToMinutes(other.startTime || '6:00 PM');
        const oEnd = oStart + (other.durationMinutes || 60);
        return shiftedStart < oEnd && (shiftedStart + currentDur) > oStart;
      });
      if (!clash) break;
      shiftedStart += 15;
      iterations++;
    }

    if (onSavePlan) {
      const targetEvent = events.find(ev => ev.id === evtId);
      if (targetEvent) {
        const timeCalc = calculateConsistentEndTime(minutesTo12HourTime(shiftedStart), currentDur);
        const parentPlan = plans.find(p => p.date === selectedDateStr) || plans[0];
        if (parentPlan) {
          const updatedTopics = (parentPlan.topics || []).map(t => {
            const matches = (targetEvent.planTopicId && t.id === targetEvent.planTopicId) ||
              (t.topicName.toLowerCase() === targetEvent.topicName.toLowerCase());
            if (matches) {
              return {
                ...t,
                startTime: timeCalc.startTime12,
                endTime: timeCalc.endTime12,
                deadline: timeCalc.endTime12,
                estimatedMinutes: currentDur,
                date: selectedDateStr
              };
            }
            return t;
          });

          const updatedPlan: StudyPlan = {
            ...parentPlan,
            topics: updatedTopics,
            updatedAt: new Date().toISOString()
          };

          updatedPlan.calendarEvents = updatedTopics.map((tp, idx) => 
            analyzeStudyTopicIntoCalendarEvent(updatedPlan, tp, idx)
          );

          onSavePlan(updatedPlan);
        }
      }
    }
  };

  return (
    <div className="bg-surface/60 border border-theme rounded-2xl p-4 space-y-3 select-none">
      <div className="flex items-center justify-between border-b border-theme pb-2.5">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#6B705C]" />
          <h4 className="text-xs font-bold font-serif text-primary">
            Visual Day Timeline & Time-Blocking
          </h4>
          <span className="text-[10px] font-mono text-muted bg-surface px-2 py-0.5 rounded border border-theme">
            15m Magnetic Snapping
          </span>
        </div>
        <span className="text-[11px] text-muted hidden sm:inline">
          Drag block to move · Drag bottom edge to resize
        </span>
      </div>

      {/* Timeline Scroll Area */}
      <div 
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative bg-card rounded-xl border border-theme overflow-y-auto max-h-[460px] pr-2 shadow-2xs"
        style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT_PX}px` }}
      >
        {/* Hour Grid Lines */}
        {hoursList.map(h => {
          const top = (h.hour - START_HOUR) * HOUR_HEIGHT_PX;
          return (
            <div 
              key={h.hour}
              className="absolute left-0 right-0 border-t border-theme/40 flex items-center pointer-events-none"
              style={{ top: `${top}px`, height: `${HOUR_HEIGHT_PX}px` }}
            >
              <span className="text-[10px] font-mono font-bold text-muted w-16 pl-2 shrink-0 select-none">
                {h.label}
              </span>
              <div className="flex-1 border-t border-dashed border-theme/30" />
            </div>
          );
        })}

        {/* Exams Ambient Strip on timeline */}
        {dayExams.map(ex => (
          <div
            key={ex.id}
            className="absolute left-20 right-4 p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-900 dark:text-rose-200 z-10 flex items-center justify-between text-xs pointer-events-none shadow-xs"
            style={{ top: '60px', height: '54px' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🚨</span>
              <div>
                <strong>Official Exam: {ex.subjectName}</strong>
                <div className="text-[10px] text-rose-700 dark:text-rose-300 font-mono">{ex.examName}</div>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-rose-500/20 px-2 py-0.5 rounded font-mono">Protected Slot</span>
          </div>
        ))}

        {/* Draggable Event Blocks */}
        {positionedEvents.map(({ event, startMin, endMin, duration, topPx, heightPx, hasClash }) => {
          const isDraggingThis = activeDragId === event.id;

          return (
            <div
              key={event.id}
              style={{
                top: `${topPx}px`,
                height: `${heightPx}px`,
                left: '76px',
                right: '12px'
              }}
              onPointerDown={e => handleStartMove(e, event.id, startMin, duration)}
              className={`absolute rounded-xl border p-2 text-xs flex flex-col justify-between transition-shadow z-20 cursor-grab active:cursor-grabbing touch-none ${
                isDraggingThis
                  ? 'ring-2 ring-[#6B705C] shadow-lg opacity-95 bg-white dark:bg-stone-900 z-30 scale-[1.01]'
                  : hasClash
                  ? 'bg-amber-500/15 border-amber-500/60 text-amber-950 dark:text-amber-200 shadow-2xs'
                  : 'bg-surface border-theme hover:border-[#6B705C]/50 text-primary shadow-2xs'
              }`}
            >
              {/* Event Content Header */}
              <div className="flex items-start justify-between gap-2 overflow-hidden pointer-events-none">
                <div className="flex items-center gap-1.5 min-w-0">
                  <GripVertical className="w-3.5 h-3.5 text-muted shrink-0 cursor-grab" />
                  <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-card border border-theme shrink-0">
                    {event.subjectName}
                  </span>
                  <span className="font-bold truncate text-[11px] text-primary">
                    {event.topicName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto">
                  <span className="text-[10px] font-mono font-bold text-muted">
                    {minutesTo12HourTime(startMin)}–{minutesTo12HourTime(endMin)} ({duration}m)
                  </span>

                  {hasClash && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAutoShiftBuffer(event.id, startMin, duration);
                      }}
                      className="text-[9px] font-mono bg-amber-600 hover:bg-amber-700 text-white font-bold px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5 shadow-2xs"
                      title="Auto-shift block to next open 15m slot to resolve clash"
                    >
                      <AlertTriangle className="w-2.5 h-2.5" />
                      <span>⚡ Shift +15m</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Event Footer Action Buttons */}
              <div className="flex items-center justify-between pt-1 border-t border-theme/40 text-[10px]">
                <span className="text-[10px] text-muted italic truncate max-w-[200px]">
                  {event.reason || 'Study Session'}
                </span>

                <div className="flex items-center gap-1 pointer-events-auto">
                  {onStartTimerForTopic && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onStartTimerForTopic(event.subjectName, event.chapterName || '', event.topicName);
                      }}
                      className="px-2 py-0.5 rounded bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-bold flex items-center gap-1 transition cursor-pointer"
                      title="Launch timer"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Timer</span>
                    </button>
                  )}

                  {onDeleteEvent && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onDeleteEvent(event);
                      }}
                      className="p-1 rounded text-muted hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Delete session"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom Resize Handle */}
              <div
                onPointerDown={e => handleStartResize(e, event.id, startMin, duration)}
                className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize hover:bg-[#6B705C]/30 rounded-b-xl flex items-center justify-center pointer-events-auto touch-none"
                title="Drag to resize duration"
              >
                <div className="w-8 h-1 rounded-full bg-muted/60" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
