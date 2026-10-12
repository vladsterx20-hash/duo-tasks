import L from 'leaflet';

export const DEFAULT_CENTER: [number, number] = [55.7558, 37.6173];

/** Бесплатная карта OpenStreetMap, без ключей. Подпись авторов обязательна по условиям OSM. */
export function createMap(el: HTMLElement, center: [number, number], zoom: number): L.Map {
  const map = L.map(el, { zoomControl: false, attributionControl: false }).setView(center, zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  L.control.attribution({ position: 'topright', prefix: false }).addAttribution('© OpenStreetMap').addTo(map);
  setTimeout(() => map.invalidateSize(), 0);
  return map;
}

/** Чёрная круглая метка с номером; выбранная — с оранжевой обводкой */
export const pinIcon = (label: string, cls = '') =>
  L.divIcon({
    className: 'pin-wrap',
    html: `<div class="pin ${cls}">${label}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
