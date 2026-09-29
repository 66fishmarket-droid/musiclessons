import { splitChords } from '../lib/text.ts';

/** Lesson text with each {Chord} rendered as a tappable chip that opens its shapes. */
export function ChordText({ text, onChord }: { text: string; onChord: (chord: string) => void }) {
  return (
    <>
      {splitChords(text).map((seg, k) =>
        'chord' in seg
          ? <button key={k} type="button" className="chip" onClick={() => onChord(seg.chord)}>{seg.chord}</button>
          : <span key={k}>{seg.text}</span>)}
    </>
  );
}
