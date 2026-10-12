import WebApp from '@twa-dev/sdk';
import { inTelegram } from './utils';

export interface GeoFix {
  lat: number;
  lng: number;
  /** точность в метрах */
  accuracy: number;
}

export type GeoProblem = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

const toFix = (p: GeolocationPosition): GeoFix => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: p.coords.accuracy,
});

const toProblem = (e: GeolocationPositionError): GeoProblem =>
  e.code === e.PERMISSION_DENIED ? 'denied' : e.code === e.TIMEOUT ? 'timeout' : 'unavailable';

/** Слежение за положением. Данные остаются на устройстве, на сервер не отправляются. Возвращает функцию остановки. */
export function watchPosition(onFix: (f: GeoFix) => void, onProblem: (p: GeoProblem) => void): () => void {
  if (!('geolocation' in navigator)) {
    onProblem('unsupported');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onFix(toFix(p)),
    (e) => onProblem(toProblem(e)),
    { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Одноразовое определение положения (например, чтобы открыть карту рядом с вами) */
export function getPositionOnce(): Promise<GeoFix | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(toFix(p)),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 }
    );
  });
}

/** Если доступ запрещён, в Telegram можно открыть его настройки для мини-приложения */
export function canOpenLocationSettings(): boolean {
  try {
    return inTelegram() && !!WebApp.LocationManager && WebApp.isVersionAtLeast('8.0');
  } catch {
    return false;
  }
}

export function openLocationSettings() {
  try {
    const lm = WebApp.LocationManager;
    lm.init(() => lm.openSettings());
  } catch {
    /* ignore */
  }
}
