import { useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { resizeImage } from '@/lib/image';
import { Button, Photo } from './ui';
import './photo-input.css';

/** Campo de foto principal: arrastar/soltar ou escolher, com pré-visualização grande. */
export function PhotoInput({ value, onChange, name, id }: { value?: string; onChange: (v: string | undefined) => void; name: string; id?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);

  const handle = async (file?: File) => {
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      onChange(await resizeImage(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="photo-input" id={id}>
      <div
        className="photo-input__drop"
        data-drag={drag || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files[0]);
        }}
      >
        {value ? (
          <Photo src={value} alt={`Foto de ${name || 'animal'}`} name={name} ratio="4 / 5" className="photo-input__preview" />
        ) : (
          <button type="button" className="photo-input__empty" onClick={() => input.current?.click()} aria-describedby="photo-help">
            <ImagePlus aria-hidden />
            <strong>Adicionar foto</strong>
            <span>Arraste aqui ou toque para escolher</span>
          </button>
        )}
        {loading && <div className="photo-input__loading" aria-live="polite">Processando foto…</div>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {value && (
        <div className="photo-input__actions">
          <Button size="sm" icon={<Upload aria-hidden />} onClick={() => input.current?.click()}>
            Trocar foto
          </Button>
          <Button size="sm" variant="danger-ghost" icon={<Trash2 aria-hidden />} onClick={() => onChange(undefined)}>
            Remover
          </Button>
        </div>
      )}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : (
        <p className="field__hint" id="photo-help">
          Uma foto de frente, com boa luz, ajuda muito na adoção.
        </p>
      )}
    </div>
  );
}
