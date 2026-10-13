import { useEffect, useState } from 'react';
import type { Attachment } from '../types';
import { fileKind, fmtSize, openFile } from '../utils';
import { pushBack } from '../backStack';
import { Icon } from './Icon';

interface Props {
  /** файлы, которые умеет показать просмотрщик (фото и текст) */
  files: Attachment[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}

const TEXT_LIMIT = 512 * 1024; // показываем не больше 512 КБ текста, чтобы страница не зависала

/** Текст файла: сначала UTF-8, если не получилось — Windows-1251 (частый случай для русских .txt) */
async function loadText(url: string): Promise<{ text: string; truncated: boolean }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('load');
  const buf = await res.arrayBuffer();
  const head = buf.slice(0, TEXT_LIMIT);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: true });
  } catch {
    text = new TextDecoder('windows-1251').decode(head);
  }
  return { text, truncated: buf.byteLength > TEXT_LIMIT };
}

/** Просмотрщик внутри приложения: фото (нажатие — приблизить) и текстовые файлы, листание между файлами */
export function FileViewer({ files, index, onIndex, onClose }: Props) {
  const file = files[index];
  const kind = fileKind(file);
  const [zoomed, setZoomed] = useState(false);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [text, setText] = useState('');
  const [truncated, setTruncated] = useState(false);

  // «Назад» в Telegram и Esc закрывают просмотрщик
  useEffect(() => pushBack(onClose), [onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      if (e.key === 'ArrowRight' && index < files.length - 1) onIndex(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, files.length, onClose, onIndex]);

  // Новый файл — состояние с нуля
  useEffect(() => {
    setZoomed(false);
    setState('loading');
    setText('');
    setTruncated(false);
    if (kind !== 'text') return;
    let alive = true;
    loadText(file.file_url)
      .then((r) => {
        if (!alive) return;
        setText(r.text);
        setTruncated(r.truncated);
        setState('ok');
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, [file.id, file.file_url, kind]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`Файл: ${file.file_name}`}>
      <div className="viewer-bar">
        <button className="round-btn dark" onClick={onClose} aria-label="Закрыть">
          <Icon name="x" size={20} />
        </button>
        <div className="viewer-title">
          <b className="ellipsis">{file.file_name}</b>
          <span className="muted">
            {fmtSize(file.size)}
            {files.length > 1 ? ` · ${index + 1} из ${files.length}` : ''}
          </span>
        </div>
        <button className="round-btn dark" onClick={() => openFile(file.file_url)} aria-label="Открыть в браузере или скачать">
          <Icon name="download" size={20} />
        </button>
      </div>

      <div className={'viewer-body' + (kind === 'image' ? ' image' : ' text')}>
        {kind === 'image' && state !== 'error' && (
          <div className={'viewer-scroll' + (zoomed ? ' zoomed' : '')}>
            <img
              src={file.file_url}
              alt={file.file_name}
              className={zoomed ? 'zoomed' : ''}
              onClick={() => setZoomed(!zoomed)}
              onLoad={() => setState('ok')}
              onError={() => setState('error')}
            />
          </div>
        )}
        {kind === 'text' && state === 'ok' && (
          <div className="viewer-text">
            <pre>{text || '(файл пустой)'}</pre>
            {truncated && <div className="muted">Показано начало файла (до 512 КБ). Полный файл — по кнопке сверху.</div>}
          </div>
        )}
        {state === 'loading' && <div className="viewer-note muted">Загружаем…</div>}
        {state === 'error' && (
          <div className="viewer-note">
            <p>Не удалось показать файл здесь.</p>
            <button className="primary narrow" onClick={() => openFile(file.file_url)}>
              Открыть в браузере
            </button>
          </div>
        )}
      </div>

      {files.length > 1 && (
        <>
          <button className="viewer-nav prev" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label="Предыдущий файл">
            <Icon name="back" size={22} strokeWidth={2.6} />
          </button>
          <button className="viewer-nav next" disabled={index === files.length - 1} onClick={() => onIndex(index + 1)} aria-label="Следующий файл">
            <Icon name="chevron" size={22} strokeWidth={2.6} />
          </button>
        </>
      )}
      {kind === 'image' && state === 'ok' && <div className="viewer-hint muted">Нажмите на фото, чтобы приблизить</div>}
    </div>
  );
}
