import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { Task } from '../types';
import { fmtDue, openRoute } from '../utils';
import { createMap, DEFAULT_CENTER, pinIcon } from '../mapUtils';

export function MapScreen({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const [selId, setSelId] = useState<number | null>(null);

  const pts = useMemo(() => tasks.filter((t) => t.lat !== null && t.lng !== null), [tasks]);
  const selected = pts.find((t) => t.id === selId);

  useEffect(() => {
    const map = createMap(el.current!, DEFAULT_CENTER, 10);
    mapRef.current = map;
    layer.current = L.layerGroup().addTo(map);
    map.on('click', () => setSelId(null));
    return () => {
      map.remove();
      mapRef.current = null;
      layer.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layer.current;
    if (!map || !group) return;
    group.clearLayers();
    pts.forEach((t) => {
      const cls = (t.id === selId ? 'sel ' : '') + (t.status === 'done' ? 'done' : '');
      L.marker([t.lat!, t.lng!], { icon: pinIcon(String(t.id), cls), keyboard: false })
        .on('click', () => setSelId(t.id))
        .addTo(group);
    });
    if (!fitted.current && pts.length) {
      map.fitBounds(L.latLngBounds(pts.map((t) => [t.lat!, t.lng!] as [number, number])), { padding: [60, 60], maxZoom: 16 });
      fitted.current = true;
    }
  }, [pts, selId]);

  return (
    <div className="map-screen">
      <div ref={el} className="map" />
      {pts.length === 0 && <div className="map-empty">Пока нет задач с адресом.<br />Укажите адрес при создании задачи.</div>}
      {selected && (
        <div className="map-card">
          <button className="map-card-main" onClick={() => onOpen(selected)}>
            <span className="pin-num">{selected.id}</span>
            <span className="map-card-text">
              <b className="ellipsis">{selected.title}</b>
              <span className="muted ellipsis">{selected.address || 'Адрес не указан'}</span>
              <b className="map-due">
                {selected.status === 'done' ? 'Завершена' : `Выполнить до ${fmtDue(selected.due_at)}`}
              </b>
            </span>
          </button>
          <button className="route-btn" onClick={() => openRoute(selected.lat!, selected.lng!)}>
            Маршрут
          </button>
        </div>
      )}
    </div>
  );
}
