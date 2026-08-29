/** Per-day free-text notes (gymlog:notes): "YYYY-MM-DD" → note text. */
import { create } from 'zustand';
import { getNotes, saveNotes } from '@/lib/storage';
import type { NotesMap } from '@/lib/types';

export interface NotesState {
  notes: NotesMap;
  setNotes: (notes: NotesMap) => void;
  /** Set (or clear with empty string) the note for a date. */
  setNoteForDate: (date: string, text: string) => void;
}

export const useNotesStore = create<NotesState>((set, get) => {
  const persist = (notes: NotesMap) => {
    set({ notes });
    void saveNotes(notes);
  };

  return {
    notes: getNotes(),
    setNotes: (notes) => persist(notes),
    setNoteForDate: (date, text) => {
      const notes = { ...get().notes };
      if (text) notes[date] = text;
      else delete notes[date];
      persist(notes);
    },
  };
});

export const selectNoteForDate =
  (date: string) =>
  (s: NotesState): string =>
    s.notes[date] ?? '';
