import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Camera, FileText, ImagePlus, X } from 'lucide-react';
import { formatBytes } from '../lib/format';
import { isAcceptedFile, isPdf } from '../lib/images';
import { toast } from '../lib/ui';

export interface PickedFile {
  id: string;
  file: File;
}

let seq = 0;

export function toPicked(files: File[]): PickedFile[] {
  return files.map((file) => ({ id: `f${++seq}`, file }));
}

/** Filtrerer bort filtyper vi ikke støtter, med et varsel. */
export function acceptFiles(files: File[], opts: { imagesOnly?: boolean } = {}): File[] {
  const ok = files.filter((f) => (opts.imagesOnly ? isAcceptedFile(f) && !isPdf(f) : isAcceptedFile(f)));
  if (ok.length < files.length) {
    toast(opts.imagesOnly ? 'Bare bilder kan brukes her.' : 'Bare bilder og PDF-er kan lastes opp.', { kind: 'error' });
  }
  return ok;
}

export function useIsTouch(): boolean {
  const [touch] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  return touch;
}

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  accept: string;
  imagesOnly?: boolean;
  compact?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
}

/** Slippsone med «Velg filer» og (på berøringsskjermer) «Ta bilde». */
export function DropZone({ onFiles, accept, imagesOnly, compact, disabled, hint }: DropZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const touch = useIsTouch();

  const take = (list: FileList | null) => {
    const files = acceptFiles(Array.from(list ?? []), { imagesOnly });
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={`dropzone${over ? ' is-over' : ''}${compact ? ' is-compact' : ''}`}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        if (!disabled) take(e.dataTransfer.files);
      }}
    >
      {!compact && <ImagePlus size={28} aria-hidden className="dropzone-icon" />}
      {!compact && (
        <p className="dropzone-text">
          {touch ? 'Ta bilde av sidene eller velg filer' : 'Dra bilder eller PDF-er hit'}
          {hint && <span className="dropzone-hint">{hint}</span>}
        </p>
      )}
      <div className="dropzone-buttons">
        {touch && (
          <button type="button" className="btn btn-primary" onClick={() => cameraRef.current?.click()} disabled={disabled}>
            <Camera size={18} aria-hidden />
            Ta bilde
          </button>
        )}
        <button
          type="button"
          className={`btn ${touch ? '' : 'btn-primary'}`}
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
        >
          <ImagePlus size={18} aria-hidden />
          {compact ? 'Legg til flere' : 'Velg filer'}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** Liste over valgte filer med miniatyr, rekkefølge og fjerning. */
export function PickedList({
  items,
  onMove,
  onRemove,
  disabled,
  label = 'Side',
}: {
  items: PickedFile[];
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <ol className="picked-list" aria-label="Valgte filer">
      {items.map((it, i) => (
        <li key={it.id} className="picked-item">
          <span className="picked-index" aria-hidden>
            {i + 1}
          </span>
          <Thumb item={it} />
          <span className="picked-meta">
            <span className="picked-name" title={it.file.name}>
              {it.file.name || `${label} ${i + 1}`}
            </span>
            <span className="picked-size">
              {isPdf(it.file) ? 'PDF · ' : ''}
              {formatBytes(it.file.size)}
            </span>
          </span>
          <span className="picked-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label={`Flytt ${label.toLowerCase()} ${i + 1} opp`}
              disabled={disabled || i === 0}
              onClick={() => onMove(i, -1)}
            >
              <ArrowUp size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Flytt ${label.toLowerCase()} ${i + 1} ned`}
              disabled={disabled || i === items.length - 1}
              onClick={() => onMove(i, 1)}
            >
              <ArrowDown size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Fjern ${it.file.name || `${label.toLowerCase()} ${i + 1}`}`}
              disabled={disabled}
              onClick={() => onRemove(i)}
            >
              <X size={18} aria-hidden />
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Thumb({ item }: { item: PickedFile }) {
  const [url, setUrl] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
    if (isPdf(item.file)) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(item.file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [item.file]);
  if (!url || broken) {
    return (
      <span className="picked-thumb is-file" aria-hidden>
        <FileText size={22} />
      </span>
    );
  }
  return <img className="picked-thumb" src={url} alt="" onError={() => setBroken(true)} decoding="async" />;
}

/** Felles tilstand for en liste med valgte filer. */
export function usePickedFiles(initial: File[] = []) {
  const [items, setItems] = useState<PickedFile[]>(() => toPicked(initial));
  return {
    items,
    add: (files: File[]) => setItems((prev) => [...prev, ...toPicked(files)]),
    move: (index: number, delta: -1 | 1) =>
      setItems((prev) => {
        const next = [...prev];
        const j = index + delta;
        if (j < 0 || j >= next.length) return prev;
        [next[index], next[j]] = [next[j]!, next[index]!];
        return next;
      }),
    remove: (index: number) => setItems((prev) => prev.filter((_, i) => i !== index)),
    clear: () => setItems([]),
  };
}
