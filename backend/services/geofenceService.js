const CommunityBoundary = require('../models/CommunityBoundary');

/**
 * Geodesic distance between two geographic coordinates using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Distance in metres
 */
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Mean Earth radius in metres
  const toRad = (x) => (x * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks if a point lies directly on a line segment with a small numerical epsilon.
 * Handles exact-edge cases for polygon boundaries.
 */
function isPointOnSegment(point, p1, p2, epsilon = 1e-6) {
  const crossProduct =
    (point.lat - p1.lat) * (p2.lng - p1.lng) -
    (point.lng - p1.lng) * (p2.lat - p1.lat);

  if (Math.abs(crossProduct) > epsilon) {
    return false;
  }

  const minLat = Math.min(p1.lat, p2.lat) - epsilon;
  const maxLat = Math.max(p1.lat, p2.lat) + epsilon;
  const minLng = Math.min(p1.lng, p2.lng) - epsilon;
  const maxLng = Math.max(p1.lng, p2.lng) + epsilon;

  return (
    point.lat >= minLat &&
    point.lat <= maxLat &&
    point.lng >= minLng &&
    point.lng <= maxLng
  );
}

/**
 * Ray-casting algorithm to determine if a point is inside a polygon.
 * Includes point-on-edge tolerance for exact boundary matches.
 * @param {{ lat: number, lng: number }} point
 * @param {Array<{ lat: number, lng: number }>} polygon
 * @returns {boolean} True if point is inside or on the boundary of the polygon
 */
function isPointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false;

  const n = polygon.length;
  let inside = false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const p1 = polygon[i];
    const p2 = polygon[j];

    // Check if point is on the segment/vertex
    if (isPointOnSegment(point, p1, p2)) {
      return true;
    }

    const intersect =
      p1.lat > point.lat !== p2.lat > point.lat &&
      point.lng <
        ((p2.lng - p1.lng) * (point.lat - p1.lat)) / (p2.lat - p1.lat) + p1.lng;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Validates coordinate numbers within legal terrestrial bounds.
 */
function isValidLatitude(lat) {
  return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
}

function isValidLongitude(lng) {
  return typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
}

/**
 * Validates boundary configuration data before persisting to database.
 * @param {Object} boundaryData - { mode, polygon, center, radius, maxAccuracyMeters, maxAgeSeconds }
 * @returns {{ valid: boolean, error?: string }}
 */
function validateBoundaryConfiguration(boundaryData) {
  if (!boundaryData || typeof boundaryData !== 'object') {
    return { valid: false, error: 'Boundary data must be a valid object' };
  }

  const { mode, polygon, center, radius, maxAccuracyMeters } = boundaryData;

  if (mode !== 'polygon' && mode !== 'radius') {
    return { valid: false, error: "Boundary mode must be either 'polygon' or 'radius'" };
  }

  if (mode === 'polygon') {
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return { valid: false, error: 'Polygon boundary must contain at least 3 vertices' };
    }
    for (let i = 0; i < polygon.length; i++) {
      const v = polygon[i];
      if (!v || !isValidLatitude(v.lat) || !isValidLongitude(v.lng)) {
        return {
          valid: false,
          error: `Invalid vertex coordinates at index ${i}: lat must be in [-90, 90] and lng in [-180, 180]`,
        };
      }
    }
  }

  if (mode === 'radius') {
    if (!center || !isValidLatitude(center.lat) || !isValidLongitude(center.lng)) {
      return { valid: false, error: 'Center coordinates must be valid (lat in [-90, 90], lng in [-180, 180])' };
    }
    const r = Number(radius);
    if (isNaN(r) || r <= 0 || r > 50000) {
      return { valid: false, error: 'Radius must be a positive number between 1 and 50,000 metres' };
    }
  }

  if (maxAccuracyMeters !== undefined && maxAccuracyMeters !== null) {
    const acc = Number(maxAccuracyMeters);
    if (isNaN(acc) || acc < 5 || acc > 1000) {
      return { valid: false, error: 'Maximum accuracy threshold must be between 5 and 1,000 metres' };
    }
  }

  return { valid: true };
}

/**
 * Validates a submitted client location reading for check-in.
 * Checks coordinate validity, accuracy, and reading timestamp staleness.
 *
 * @param {Object} locationReading - { lat, lng, accuracy, timestamp }
 * @param {Object} boundaryDoc - Configured CommunityBoundary document
 * @returns {{ valid: boolean, errorCode?: string, errorMessage?: string, parsedLocation?: Object }}
 */
function validateLocationReading(locationReading, boundaryDoc) {
  if (
    !locationReading ||
    typeof locationReading !== 'object' ||
    (locationReading.lat === undefined && locationReading.lng === undefined)
  ) {
    return {
      valid: false,
      errorCode: 'LOCATION_REQUIRED',
      errorMessage: 'Location coordinates (latitude and longitude) are required for check-in verification',
    };
  }

  const lat = Number(locationReading.lat);
  const lng = Number(locationReading.lng);

  if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
    return {
      valid: false,
      errorCode: 'INVALID_COORDINATES',
      errorMessage: 'Invalid location coordinates: latitude must be between -90 and 90, longitude between -180 and 180',
    };
  }

  // Validate accuracy
  const accuracy = Number(locationReading.accuracy);
  if (locationReading.accuracy === undefined || locationReading.accuracy === null || isNaN(accuracy) || accuracy <= 0) {
    return {
      valid: false,
      errorCode: 'ACCURACY_REQUIRED',
      errorMessage: 'Reported GPS accuracy in metres is required and must be a positive number',
    };
  }

  const maxAllowedAccuracy = boundaryDoc?.maxAccuracyMeters || 100;
  if (accuracy > maxAllowedAccuracy) {
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_ACCURACY',
      errorMessage: `Reported GPS accuracy (±${Math.round(accuracy)}m) exceeds maximum allowable threshold (±${maxAllowedAccuracy}m). Please move to an open area or enable high-accuracy GPS.`,
    };
  }

  // Validate timestamp if provided
  if (locationReading.timestamp) {
    const readingTime = new Date(locationReading.timestamp).getTime();
    if (!isNaN(readingTime)) {
      const now = Date.now();
      const maxAgeMs = (boundaryDoc?.maxAgeSeconds || 120) * 1000;
      const clockSkewToleranceMs = 15000; // 15 seconds forward tolerance

      if (readingTime > now + clockSkewToleranceMs) {
        return {
          valid: false,
          errorCode: 'INVALID_TIMESTAMP',
          errorMessage: 'Location reading timestamp is in the future. Please check device system clock.',
        };
      }

      if (now - readingTime > maxAgeMs) {
        const ageSec = Math.round((now - readingTime) / 1000);
        return {
          valid: false,
          errorCode: 'STALE_LOCATION',
          errorMessage: `Location reading is stale (${ageSec} seconds old; maximum allowed is ${boundaryDoc?.maxAgeSeconds || 120}s). Please acquire a fresh GPS position.`,
        };
      }
    }
  }

  return {
    valid: true,
    parsedLocation: { lat, lng, accuracy, timestamp: locationReading.timestamp },
  };
}

/**
 * Validates whether the given location reading is authorized inside the community boundary.
 *
 * @param {string|mongoose.Types.ObjectId} communityId - Target community ID
 * @param {Object} locationReading - { lat, lng, accuracy, timestamp }
 * @returns {Promise<{
 *   success: boolean,
 *   inside: boolean,
 *   distanceMeters?: number,
 *   boundaryMode?: string,
 *   errorCode?: string,
 *   message?: string
 * }>}
 */
async function verifyGeofenceMembership(communityId, locationReading) {
  if (!communityId) {
    return {
      success: false,
      inside: false,
      errorCode: 'COMMUNITY_ID_REQUIRED',
      message: 'Community ID is required for geofence verification',
    };
  }

  // 1. Fetch community boundary configuration
  const boundary = await CommunityBoundary.findOne({ communityId }).lean();

  if (!boundary) {
    return {
      success: false,
      inside: false,
      errorCode: 'GEOFENCE_NOT_CONFIGURED',
      message: 'Community boundary has not been configured by an administrator. Check-in is restricted until a boundary is established.',
    };
  }

  if (boundary.enabled === false) {
    return {
      success: false,
      inside: false,
      errorCode: 'GEOFENCE_DISABLED',
      message: 'Community boundary geofencing is currently disabled. Check-in is restricted while geofencing is inactive.',
    };
  }

  // 2. Validate client location reading
  const readingValidation = validateLocationReading(locationReading, boundary);
  if (!readingValidation.valid) {
    return {
      success: false,
      inside: false,
      errorCode: readingValidation.errorCode,
      message: readingValidation.errorMessage,
    };
  }

  const { lat, lng } = readingValidation.parsedLocation;

  // 3. Evaluate boundary based on mode
  if (boundary.mode === 'radius') {
    const { center, radius } = boundary;
    if (!center || !center.lat || !center.lng || !radius) {
      return {
        success: false,
        inside: false,
        errorCode: 'INVALID_BOUNDARY_DEFINITION',
        message: 'Community radius boundary configuration is incomplete or invalid.',
      };
    }

    const distance = haversineDistanceMeters(lat, lng, center.lat, center.lng);
    // Allow slight tolerance (0.5m) for floating-point calculations
    const inside = distance <= radius + 0.5;

    if (!inside) {
      const excess = Math.round(distance - radius);
      return {
        success: false,
        inside: false,
        distanceMeters: Math.round(distance),
        radiusMeters: radius,
        boundaryMode: 'radius',
        errorCode: 'OUTSIDE_BOUNDARY',
        message: `Check-in rejected: Location is ${excess}m outside the authorized community radius (${radius}m from center).`,
      };
    }

    return {
      success: true,
      inside: true,
      distanceMeters: Math.round(distance),
      radiusMeters: radius,
      boundaryMode: 'radius',
      message: 'Location verified inside community radius boundary',
    };
  }

  if (boundary.mode === 'polygon') {
    const { polygon } = boundary;
    if (!polygon || polygon.length < 3) {
      return {
        success: false,
        inside: false,
        errorCode: 'INVALID_BOUNDARY_DEFINITION',
        message: 'Community polygon boundary configuration is incomplete or invalid.',
      };
    }

    const inside = isPointInPolygon({ lat, lng }, polygon);

    if (!inside) {
      return {
        success: false,
        inside: false,
        boundaryMode: 'polygon',
        errorCode: 'OUTSIDE_BOUNDARY',
        message: 'Check-in rejected: Location is outside the authorized community polygon boundary.',
      };
    }

    return {
      success: true,
      inside: true,
      boundaryMode: 'polygon',
      message: 'Location verified inside community polygon boundary',
    };
  }

  return {
    success: false,
    inside: false,
    errorCode: 'UNKNOWN_BOUNDARY_MODE',
    message: `Unsupported boundary mode: ${boundary.mode}`,
  };
}

module.exports = {
  haversineDistanceMeters,
  isPointInPolygon,
  validateBoundaryConfiguration,
  validateLocationReading,
  verifyGeofenceMembership,
};
