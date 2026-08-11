import { LOCATION_LIMITS, type GeoPoint } from '../types';
import { AppError } from './errorMessage';

export const EARTH_RADIUS_M = 6371000;

/** Haversine distance in meters; mirrors public.haversine_distance_m in SQL. */
export function haversineDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const sinLat = Math.sin(toRad(lat2 - lat1) / 2);
  const sinLon = Math.sin(toRad(lon2 - lon1) / 2);
  const value =
    sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLon * sinLon;
  return EARTH_RADIUS_M * 2 * Math.asin(Math.min(1, Math.sqrt(value)));
}

export function distanceToLocationM(
  point: Pick<GeoPoint, 'latitude' | 'longitude'>,
  location: { latitude: number; longitude: number },
): number {
  return haversineDistanceM(point.latitude, point.longitude, location.latitude, location.longitude);
}

export function isWithinRadius(
  point: Pick<GeoPoint, 'latitude' | 'longitude'>,
  location: { latitude: number; longitude: number; radiusM: number },
): boolean {
  return distanceToLocationM(point, location) <= location.radiusM;
}

/** Reject positions too inaccurate to trust for check-in/out (150 m limit). */
export function assertAccuracy(point: GeoPoint): void {
  if (!Number.isFinite(point.accuracyM) || point.accuracyM < 0) {
    throw new AppError('定位数据不正确', 'VALIDATION');
  }
  if (point.accuracyM > LOCATION_LIMITS.accuracyLimitM) {
    throw new AppError('当前定位精度不足，请移动到窗边或室外后重试。', 'VALIDATION');
  }
}

const IOS_SETTINGS_HINT =
  '请前往「系统设置 → 隐私与安全性 → 定位服务」，允许浏览器或 StudyBloom 使用定位后重试。';

export function toGeolocationError(error: GeolocationPositionError): AppError {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return new AppError(`定位权限被拒绝。${IOS_SETTINGS_HINT}`, 'FORBIDDEN', { cause: error });
    case error.POSITION_UNAVAILABLE:
      return new AppError('无法获取当前位置，请确认系统定位服务已开启后重试', 'VALIDATION', { cause: error });
    case error.TIMEOUT:
      return new AppError('定位超时，请移动到窗边或室外后重试', 'VALIDATION', { cause: error });
    default:
      return new AppError('获取定位失败，请稍后重试', 'UNKNOWN', { cause: error });
  }
}

/**
 * One-shot position read. Only call this from an explicit user action
 * (check-in / check-out / "use current location") — never on page load,
 * never repeatedly, never from the service worker.
 */
export function getCurrentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (
      typeof navigator === 'undefined' ||
      !('geolocation' in navigator) ||
      typeof navigator.geolocation?.getCurrentPosition !== 'function'
    ) {
      reject(new AppError('当前浏览器不支持定位功能', 'VALIDATION'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          reject(new AppError('定位数据不正确', 'VALIDATION'));
          return;
        }
        resolve({ latitude, longitude, accuracyM: Number.isFinite(accuracy) ? accuracy : LOCATION_LIMITS.accuracyLimitM + 1 });
      },
      (error) => reject(toGeolocationError(error)),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  });
}

export function formatDistanceM(meters: number): string {
  return `${Math.round(meters)} 米`;
}
