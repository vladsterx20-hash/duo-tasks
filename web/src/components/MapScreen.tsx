import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { ActiveTab, Task } from '../types';
import { fmtDue, openRoute } from '../utils';
import { createMap, DEFAULT_CENTER, meIcon, pinIcon } from '../mapUtils';
import { canOpenLocationSettings, openLocationSettings, watchPosition, type GeoFix, type GeoProblem } from '../geolocation';
import { Icon } from './Icon';

interface Props {
  tasks: Task[];
  /** Вкладка общая со списком задач: что выбрано в «Задачах», то и на карте */
  tab: ActiveTab;
  onTab: (t: ActiveTab) => void;
  onList: () => void;
  onOpen: (t: Task) => void;
}

const TABS: [ActiveTab, string][] = [
  ['new', 'Новые'],
  ['in_progress', 'В работе'],
];

export function MapScreen({ tasks, tab: view, onTab: setView, onList, onOpen }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const [selId, setSelId] = useState<number | null>(null);

  // На карте — задачи выбранной вкладки (новые или в работе), у которых есть точка
  const onMap = (t: Task, v: ActiveTab) => t.status === v && t.lat !== null && t.lng !== null;
  const pts = useMemo(() => tasks.filter((t) => onMap(t, view)), [tasks, view]);
  const selected = pts.find((t) => t.id === selId);
  const countOn = (v: ActiveTab) => tasks.filter((t) => onMap(t, v)).length;
  // Задачи этой вкладки без точки: на карте их не показать — подскажем, почему
  const withoutPoint = tasks.filter((t) => t.status === view && (t.lat === null || t.lng === null)).length;

  // Открыли карту на вкладке без меток, а на другой они есть (например, задачу взяли в работу) — сразу показываем её
  const autoSwitched = useRef(false);
  useEffect(() => {
    if (autoSwitched.current) return;
    autoSwitched.current = true;
    const other: ActiveTab = view === 'new' ? 'in_progress' : 'new';
    if (countOn(view) === 0 && countOn(other) > 0) setView(other);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Сменили вкладку — сбрасываем выбор и заново подгоняем карту под метки
  useEffect(() => {
    setSelId(null);
    fitted.current = false;
  }, [view]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layer.current;
    if (!map || !group) return;
    group.clearLayers();
    pts.forEach((t) => {
      const cls = (t.id === selId ? 'sel ' : '') + (t.status === 'in_progress' ? 'work' : '');
      L.marker([t.lat!, t.lng!], { icon: pinIcon(String(t.id), cls), keyboard: false })
        .on('click', () => setSelId(t.id))
        .addTo(group);
    });
    if (!fitted.current && pts.length) {
      map.fitBounds(L.latLngBounds(pts.map((t) => [t.lat!, t.lng!] as [number, number])), { padding: [70, 70], maxZoom: 16 });
      fitted.current = true;
    }
  }, [pts, selId]);

  // Моя геопозиция: следим, пока открыта карта; уходим с экрана — слежение останавливается
  const [problem, setProblem] = useState<GeoProblem | null>(null);
  const [located, setLocated] = useState(false);
  const fix = useRef<GeoFix | null>(null);
  const dot = useRef<L.Marker | null>(null);
  const circle = useRef<L.Circle | null>(null);

  useEffect(() => {
    const stop = watchPosition(
      (f) => {
        const map = mapRef.current;
        if (!map) return;
        const first = fix.current === null;
        fix.current = f;
        const ll = L.latLng(f.lat, f.lng);
        if (!dot.current) {
          dot.current = L.marker(ll, { icon: meIcon(), interactive: false, keyboard: false, zIndexOffset: -1000 }).addTo(map);
          circle.current = L.circle(ll, { radius: f.accuracy, className: 'me-accuracy', interactive: false }).addTo(map);
        } else {
          dot.current.setLatLng(ll);
          circle.current?.setLatLng(ll).setRadius(f.accuracy);
        }
        setProblem(null);
        setLocated(true);
        // Если на карте нет меток задач — сразу показываем, где вы
        if (first && !fitted.current) map.setView(ll, 15);
      },
      (p) => setProblem(p)
    );
    return () => {
      stop();
      dot.current = null;
      circle.current = null;
      fix.current = null;
    };
  }, []);

  function goToMe() {
    const map = mapRef.current;
    if (map && fix.current) map.setView([fix.current.lat, fix.current.lng], Math.max(map.getZoom(), 15), { animate: true });
  }

  return (
    <div className="map-screen">
      <div ref={el} className="map" />

      <div className="map-tabs seg-pill two" role="tablist" aria-label="Статус задач на карте">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'active' : ''} onClick={() => setView(k)}>
            {label}
            <span className="badge">{countOn(k)}</span>
          </button>
        ))}
      </div>

      <div className="map-zoom" role="group" aria-label="Масштаб карты">
        <button onClick={() => mapRef.current?.zoomIn()} aria-label="Приблизить карту">
          <Icon name="plus" size={24} strokeWidth={2.6} />
        </button>
        <button onClick={() => mapRef.current?.zoomOut()} aria-label="Отдалить карту">
          <Icon name="minus" size={24} strokeWidth={2.6} />
        </button>
      </div>

      {problem && !located && (
        <div className="geo-note" role="status">
          <span>
            {problem === 'denied'
              ? 'Нет доступа к геолокации. Разрешите её для Telegram в настройках телефона.'
              : problem === 'unsupported'
                ? 'Геолокация недоступна на этом устройстве.'
                : 'Не удаётся определить, где вы. Проверьте, что включён GPS.'}
          </span>
          {problem === 'denied' && canOpenLocationSettings() && (
            <button className="link-orange" onClick={openLocationSettings}>
              Открыть настройки
            </button>
          )}
        </div>
      )}
      {pts.length === 0 && (
        <div className="map-empty">
          {view === 'new' ? 'Нет новых задач с точкой на карте' : 'Нет задач в работе с точкой на карте'}
          {withoutPoint > 0 && <span className="map-empty-sub">Без точки: {withoutPoint}. Укажите адрес в задаче через «Показать на карте».</span>}
        </div>
      )}

      {selected && (
        <div className="map-card">
          <button className="map-card-main" onClick={() => onOpen(selected)}>
            <span className="pin-num">{selected.id}</span>
            <span className="map-card-text">
              <b className="ellipsis">{selected.title}</b>
              <span className="muted ellipsis">{selected.address || 'Адрес не указан'}</span>
              <b className="map-due">Выполнить до {fmtDue(selected.due_at)}</b>
            </span>
          </button>
          <button className="route-btn" onClick={() => openRoute(selected.lat!, selected.lng!)}>
            Маршрут
          </button>
        </div>
      )}

      <button className="float-btn left" onClick={onList}>
        <Icon name="list" size={18} strokeWidth={2.4} /> Список
      </button>
      <button className="map-loc" onClick={goToMe} disabled={!located} aria-label="Где я">
        <Icon name="locate" size={24} strokeWidth={2.4} />
      </button>
    </div>
  );
}
