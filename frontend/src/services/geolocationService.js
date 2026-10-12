/**
 * Geolocation Service
 *
 * Provides browser geolocation acquisition with high accuracy, timeout protection,
 * structured error handling, and geodesic distance math for client-side feedback.
 */

/**
 * Checks if geolocation is supported by the user's browser.
 */
export function isGeolocationSupported() {
  return typeof window !== 'undefined' && 'navigator' in window && 'geolocation' in navigator;
}

/**
 * Queries the current permission status for geolocation (where supported).
 * Returns 'granted' | 'prompt' | 'denied' | 'unknown'.
 */
export async function getGeolocationPermissionState() {
  if (!isGeolocationSupported()) return 'not_supported';
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      return status.state;
    } catch (_) {
      return 'unknown';
    }
  }
  return 'unknown';
}

/**
 * Acquires the current one-time browser GPS position with high accuracy.
 *
 * @param {Object} options
 * @param {boolean} options.enableHighAccuracy - Request GPS hardware if available (default true)
 * @param {number} options.timeout - Timeout in milliseconds (default 12000ms)
 * @param {number} options.maximumAge - Maximum cached age in ms (default 0 for fresh fix)
 * @returns {Promise<{ lat: number, lng: number, accuracy: number, timestamp: number }>}
 */
export function getCurrentLocation(options = {}) {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      return reject({
        code: 'NOT_SUPPORTED',
        message: 'Geolocation is not supported by your browser.',
      });
    }

    const geoOptions = {
      enableHighAccuracy: options.enableHighAccuracy !== false,
      timeout: options.timeout || 12000,
      maximumAge: options.maximumAge !== undefined ? options.maximumAge : 0,
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Number(pos.coords.latitude),
          lng: Number(pos.coords.longitude),
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: pos.timestamp || Date.now(),
        });
      },
      (err) => {
        let code = 'UNKNOWN_ERROR';
        let message = 'Failed to acquire location.';

        switch (err.code) {
          case err.PERMISSION_DENIED:
            code = 'PERMISSION_DENIED';
            message =
              'Location access was denied. Please allow location permissions in your browser to verify gate presence.';
            break;
          case err.POSITION_UNAVAILABLE:
            code = 'POSITION_UNAVAILABLE';
            message =
              'GPS location unavailable. Please check that location services or GPS are turned on.';
            break;
          case err.TIMEOUT:
            code = 'TIMEOUT';
            message =
              'Location request timed out. Please ensure you have a clear GPS signal and try again.';
            break;
          default:
            message = err.message || message;
        }

        reject({ code, message, originalError: err });
      },
      geoOptions
    );
  });
}

/**
 * Calculates geodesic distance between two points on Earth in metres.
 */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Client-side point-in-polygon helper for preview and instant feedback.
 */
export function isPointInPolygonClient(point, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
