import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { GeoResult } from '../types';
import { Icon } from './Icon';

export interface AddressValue {
  address: string;
  lat: number | null;
  lng: number | null;
}

interface Props {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  onShowOnMap: () => void;
  mapBusy?: boolean;
}

const PAUSE_MS = 800; // запрос только после паузы в наборе, а не на каждую букву

export function AddressField({ value, onChange, onShowOnMap, mapBusy }: Props) {
  const [items, setItems] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const abort = useRef<AbortController>();
  const box = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      abort.current?.abort();
    },
    []
  );

  // Закрываем подсказки при нажатии вне поля
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setItems([]);
        setEmpty(false);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  function handleInput(v: string) {
    onChange({ address: v, lat: null, lng: null }); // текст изменён вручную — прежние координаты не подходят
    clearTimeout(timer.current);
    abort.current?.abort();
    setEmpty(false);
    const q = v.trim();
    if (q.length < 3) {
      setItems([]);
      setLoading(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const ac = new AbortController();
      abort.current = ac;
      setLoading(true);
      try {
        const res = await api.geocode(q, ac.signal);
        setItems(res);
        setEmpty(res.length === 0);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setItems([]);
          setEmpty(false);
        }
      } finally {
        if (abort.current === ac) setLoading(false);
      }
    }, PAUSE_MS);
  }

  function choose(g: GeoResult) {
    onChange({ address: g.label, lat: g.lat, lng: g.lng });
    setItems([]);
    setEmpty(false);
  }

  return (
    <div ref={box} className="address">
      <input
        className="field"
        value={value.address}
        onChange={(e) => handleInput(e.target.value)}
        placeholder="Начните вводить адрес"
        maxLength={300}
        autoComplete="off"
        aria-autocomplete="list"
      />
      {(items.length > 0 || loading || empty) && (
        <ul className="suggest" role="listbox">
          {loading && <li className="suggest-note">Ищем…</li>}
          {!loading && empty && <li className="suggest-note">Ничего не найдено</li>}
          {items.map((g, i) => (
            <li key={i} role="option" aria-selected={false}>
              <button type="button" onClick={() => choose(g)}>
                {g.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="dashed" onClick={onShowOnMap} disabled={mapBusy}>
        <Icon name="map" size={16} /> {mapBusy ? 'Ищем адрес…' : 'Показать на карте'}
      </button>
      {value.lat !== null && <div className="muted hint">Точка на карте сохранена ✓</div>}
    </div>
  );
}
