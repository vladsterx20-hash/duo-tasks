import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from '../api';
import { createMap, DEFAULT_CENTER, pinIcon } from '../mapUtils';
import { getPositionOnce } from '../geolocation';

interface Props {
  initial: { lat: number; lng: number } | null;
  onDone: (v: { lat: number; lng: number; address: string }) => void;
  onCancel: () => void;
}

/** Ручная метка на карте: нажмите на карту или перетащите метку */
export function MapPicker({ initial, onDone, onCancel }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(initial);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const map = createMap(el.current!, initial ? [initial.lat, initial.lng] : DEFAULT_CENTER, initial ? 16 : 10);
    L.control.zoom({ position: 'topright', zoomInTitle: 'Приблизить', zoomOutTitle: 'Отдалить' }).addTo(map);
    let marker: L.Marker | null = null;
    const place = (ll: L.LatLng) => {
      if (marker) marker.setLatLng(ll);
      else {
        marker = L.marker(ll, { icon: pinIcon('', 'sel'), draggable: true, keyboard: false }).addTo(map);
        marker.on('dragend', () => {
          const p = marker!.getLatLng();
          setPoint({ lat: p.lat, lng: p.lng });
        });
      }
      setPoint({ lat: ll.lat, lng: ll.lng });
    };
    if (initial) place(L.latLng(initial.lat, initial.lng));
    map.on('click', (e: L.LeafletMouseEvent) => place(e.latlng));
    // Метки ещё нет — открываем карту рядом с вами (если геолокация разрешена)
    let alive = true;
    if (!initial)
      getPositionOnce().then((f) => {
        if (alive && f) map.setView([f.lat, f.lng], 15);
      });
    return () => {
      alive = false;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Подпись адреса по точке (с паузой, чтобы не превышать лимит сервиса)
  useEffect(() => {
    if (!point) return;
    setLabel('');
    setLoading(true);
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await api.reverse(point.lat, point.lng);
        if (alive) setLabel(r?.label ?? '');
      } catch {
        if (alive) setLabel('');
      } finally {
        if (alive) setLoading(false);
      }
    }, 700);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [point]);

  return (
    <div className="picker" onClick={onCancel}>
      <div className="picker-window" role="dialog" aria-modal="true" aria-label="Точка на карте" onClick={(e) => e.stopPropagation()}>
        <div ref={el} className="map" />
        <div className="picker-hint">{point ? 'Точку можно перетащить' : 'Нажмите на карту, чтобы поставить точку'}</div>
        <div className="picker-bar">
          <div className="picker-label">{point ? (loading ? 'Определяем адрес…' : label || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`) : 'Точка не выбрана'}</div>
          <div className="picker-actions">
            <button className="secondary" onClick={onCancel}>
              Закрыть
            </button>
            <button
              className="primary"
              disabled={!point}
              onClick={() => point && onDone({ ...point, address: label || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` })}
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
