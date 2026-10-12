import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Circle,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import {
  MapPin,
  Shield,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Undo2,
  Crosshair,
  Save,
  Power,
  RotateCcw,
  Sliders,
  Layers,
  Info,
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { getCurrentLocation } from '../../services/geolocationService';

// Fix for default Leaflet icon paths in Vite bundles
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom marker icon for Polygon vertices
function createVertexIcon(index) {
  return L.divIcon({
    className: 'bg-transparent border-0',
    html: `
      <div class="relative flex items-center justify-center w-6 h-6">
        <div class="absolute w-6 h-6 bg-blue-600 rounded-full opacity-30 animate-ping"></div>
        <div class="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-md border-2 border-white dark:border-gray-900 z-10">
          ${index + 1}
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

// Custom marker icon for Radius Center
const centerMarkerIcon = L.divIcon({
  className: 'bg-transparent border-0',
  html: `
    <div class="relative flex items-center justify-center w-8 h-8">
      <div class="absolute w-8 h-8 bg-emerald-500 rounded-full opacity-30 animate-ping"></div>
      <div class="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-900 z-10">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="22" y1="12" x2="18" y2="12"></line>
          <line x1="6" y1="12" x2="2" y2="12"></line>
          <line x1="12" y1="6" x2="12" y2="2"></line>
          <line x1="12" y1="22" x2="12" y2="18"></line>
        </svg>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Current User Location Icon
const userLocationIcon = L.divIcon({
  className: 'bg-transparent border-0',
  html: `
    <div class="relative flex items-center justify-center w-6 h-6">
      <div class="w-4 h-4 bg-purple-600 rounded-full border-2 border-white shadow-md z-10"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Map Click Listener component
function MapEventsHandler({ mode, onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

// Auto-fitter component
function MapBoundsAdjuster({ boundary, userLoc }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    try {
      if (boundary?.mode === 'polygon' && boundary?.polygon?.length >= 3) {
        const bounds = L.latLngBounds(boundary.polygon.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
      } else if (boundary?.mode === 'radius' && boundary?.center?.lat && boundary?.center?.lng) {
        const center = [boundary.center.lat, boundary.center.lng];
        map.setView(center, 16);
      } else if (userLoc) {
        map.setView([userLoc.lat, userLoc.lng], 16);
      }
    } catch (_) {}
  }, [boundary, userLoc, map]);

  return null;
}

const BoundaryConfigMap = ({ getAdminHeaders }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Existing boundary from server
  const [existingBoundary, setExistingBoundary] = useState(null);

  // Editable configuration state
  const [mode, setMode] = useState('polygon'); // 'polygon' | 'radius'
  const [polygonVertices, setPolygonVertices] = useState([]);
  const [radiusCenter, setRadiusCenter] = useState(null);
  const [radiusMeters, setRadiusMeters] = useState(200);
  const [maxAccuracyMeters, setMaxAccuracyMeters] = useState(100);
  const [enabled, setEnabled] = useState(true);

  // User location for quick centering
  const [userLoc, setUserLoc] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);

  // Default center if no data (e.g. New Delhi)
  const defaultCenter = [28.6139, 77.209];

  const showNotification = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Fetch boundary from server
  const fetchBoundary = useCallback(async () => {
    setLoading(true);
    try {
      const adminIdentity = typeof getAdminHeaders === 'function' ? getAdminHeaders() : null;
      const headers = adminIdentity?.headers || {};
      const res = await axios.get(`${API_BASE_URL}/boundary`, { headers });

      if (res.data?.success && res.data?.configured && res.data?.boundary) {
        const b = res.data.boundary;
        setExistingBoundary(b);
        setMode(b.mode || 'polygon');
        setEnabled(b.enabled !== false);
        setMaxAccuracyMeters(b.maxAccuracyMeters || 100);

        if (b.mode === 'polygon' && Array.isArray(b.polygon)) {
          setPolygonVertices(b.polygon);
        } else if (b.mode === 'radius' && b.center && b.radius) {
          setRadiusCenter(b.center);
          setRadiusMeters(b.radius);
        }
      } else {
        setExistingBoundary(null);
      }
    } catch (err) {
      console.error('Failed to load community boundary:', err);
      setExistingBoundary(null);
    } finally {
      setLoading(false);
    }
  }, [getAdminHeaders]);

  useEffect(() => {
    fetchBoundary();
  }, [fetchBoundary]);

  // Map click handler
  const handleMapClick = (latlng) => {
    const coords = { lat: Number(latlng.lat.toFixed(6)), lng: Number(latlng.lng.toFixed(6)) };

    if (mode === 'polygon') {
      setPolygonVertices((prev) => [...prev, coords]);
    } else if (mode === 'radius') {
      setRadiusCenter(coords);
    }
  };

  // Remove a vertex by index
  const handleRemoveVertex = (index) => {
    setPolygonVertices((prev) => prev.filter((_, i) => i !== index));
  };

  // Undo last vertex
  const handleUndoVertex = () => {
    setPolygonVertices((prev) => prev.slice(0, -1));
  };

  // Clear current drawing
  const handleClearDrawing = () => {
    if (mode === 'polygon') {
      setPolygonVertices([]);
    } else {
      setRadiusCenter(null);
    }
  };

  // Locate current position
  const handleLocateMe = async () => {
    setLocatingUser(true);
    try {
      const loc = await getCurrentLocation({ enableHighAccuracy: true });
      setUserLoc({ lat: loc.lat, lng: loc.lng });
      if (mode === 'radius' && !radiusCenter) {
        setRadiusCenter({ lat: loc.lat, lng: loc.lng });
      }
      showNotification('success', `Current location acquired: ±${loc.accuracy}m accuracy`);
    } catch (err) {
      showNotification('error', err.message || 'Unable to acquire location');
    } finally {
      setLocatingUser(false);
    }
  };

  // Save boundary configuration to backend
  const handleSaveBoundary = async () => {
    // Geometry validation
    if (mode === 'polygon') {
      if (polygonVertices.length < 3) {
        showNotification('error', 'Polygon boundary must have at least 3 vertices.');
        return;
      }
    } else if (mode === 'radius') {
      if (!radiusCenter || !radiusCenter.lat || !radiusCenter.lng) {
        showNotification('error', 'Please click on the map to place the center point for the radius.');
        return;
      }
      if (radiusMeters <= 0) {
        showNotification('error', 'Radius must be a positive number greater than 0.');
        return;
      }
    }

    const adminIdentity = typeof getAdminHeaders === 'function' ? getAdminHeaders() : null;
    if (adminIdentity?.error || !adminIdentity?.headers) {
      showNotification('error', adminIdentity?.error || 'Admin identity required to save boundary.');
      return;
    }

    setSaving(true);
    try {
      const headers = adminIdentity.headers;
      const payload = {
        mode,
        enabled,
        maxAccuracyMeters: Number(maxAccuracyMeters),
        ...(mode === 'polygon'
          ? { polygon: polygonVertices }
          : { center: radiusCenter, radius: Number(radiusMeters) }),
      };

      const res = await axios.post(`${API_BASE_URL}/boundary`, payload, { headers });

      if (res.data?.success && res.data?.boundary) {
        showNotification('success', 'Community geofence boundary saved successfully!');
        // Reload persisted boundary configuration directly from backend to confirm persistence
        await fetchBoundary();
      } else {
        showNotification('error', res.data?.message || 'Failed to save boundary.');
      }
    } catch (err) {
      console.error('Save boundary error:', err);
      let msg = 'Server error saving boundary configuration';
      if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err.response?.status === 404) {
        msg = 'Boundary service endpoint not found (404). Please ensure the backend is running with boundary routes.';
      } else if (err.response?.status === 403) {
        msg = 'Forbidden: Admin authorization failed for this community.';
      } else if (err.message && !err.response) {
        msg = `Network error: ${err.message}`;
      }
      showNotification('error', msg);
    } finally {
      setSaving(false);
    }
  };

  // Toggle enabled state
  const handleToggleEnabled = async () => {
    if (!existingBoundary) return;
    try {
      const { headers } = getAdminHeaders();
      const res = await axios.patch(
        `${API_BASE_URL}/boundary/toggle`,
        { enabled: !enabled },
        { headers }
      );
      if (res.data.success) {
        setEnabled(res.data.boundary.enabled);
        setExistingBoundary(res.data.boundary);
        showNotification(
          'success',
          `Geofence boundary is now ${res.data.boundary.enabled ? 'ACTIVE' : 'INACTIVE'}`
        );
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to toggle boundary state');
    }
  };

  // Deactivate and delete boundary
  const handleDeleteBoundary = async () => {
    if (!window.confirm('Are you sure you want to deactivate and remove this community boundary?')) {
      return;
    }
    try {
      const { headers } = getAdminHeaders();
      const res = await axios.delete(`${API_BASE_URL}/boundary`, { headers });
      if (res.data.success) {
        setExistingBoundary(null);
        setPolygonVertices([]);
        setRadiusCenter(null);
        showNotification('success', 'Boundary configuration removed.');
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to delete boundary');
    }
  };

  // Polygon coordinates for Leaflet component
  const polygonLatLngs = useMemo(() => {
    return polygonVertices.map((p) => [p.lat, p.lng]);
  }, [polygonVertices]);

  return (
    <div className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-950/20">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Community Geofence Boundary
              </h2>
              {existingBoundary ? (
                existingBoundary.enabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    Inactive
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  Not Configured
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Enforce verified location presence for gate check-ins and security entries.
            </p>
          </div>
        </div>

        {/* Mode Selector and Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-gray-200/80 dark:bg-gray-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setMode('polygon')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
                mode === 'polygon'
                  ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Polygon Mode
            </button>
            <button
              type="button"
              onClick={() => setMode('radius')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
                mode === 'radius'
                  ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              Center-Radius Mode
            </button>
          </div>

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locatingUser}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
            title="Center map on your current GPS location"
          >
            <Crosshair className={`w-3.5 h-3.5 ${locatingUser ? 'animate-spin' : ''}`} />
            {locatingUser ? 'Locating...' : 'My Location'}
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`px-6 py-3 flex items-center gap-2 text-sm font-medium border-b ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
              : 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Content: Map & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Interactive Leaflet Map (2 columns) */}
        <div className="lg:col-span-2 relative min-h-[460px] h-[520px] bg-gray-100 dark:bg-gray-950">
          <MapContainer
            center={defaultCenter}
            zoom={15}
            style={{ height: '100%', width: '100%', zIndex: 0 }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapEventsHandler mode={mode} onMapClick={handleMapClick} />
            <MapBoundsAdjuster boundary={existingBoundary} userLoc={userLoc} />

            {/* Polygon Rendering */}
            {mode === 'polygon' && (
              <>
                {polygonVertices.length >= 3 && (
                  <Polygon
                    positions={polygonLatLngs}
                    pathOptions={{
                      color: enabled ? '#2563eb' : '#9ca3af',
                      fillColor: enabled ? '#3b82f6' : '#d1d5db',
                      fillOpacity: 0.25,
                      weight: 2.5,
                      dashArray: enabled ? null : '5, 5',
                    }}
                  />
                )}
                {polygonVertices.map((vertex, idx) => (
                  <Marker
                    key={`vertex-${idx}`}
                    position={[vertex.lat, vertex.lng]}
                    icon={createVertexIcon(idx)}
                  >
                    <Popup>
                      <div className="p-1 text-xs">
                        <p className="font-bold">Vertex #{idx + 1}</p>
                        <p className="text-gray-500">
                          {vertex.lat.toFixed(5)}, {vertex.lng.toFixed(5)}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRemoveVertex(idx)}
                          className="mt-2 text-red-600 hover:text-red-700 font-semibold text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Remove Vertex
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </>
            )}

            {/* Center-Radius Rendering */}
            {mode === 'radius' && radiusCenter && (
              <>
                <Marker position={[radiusCenter.lat, radiusCenter.lng]} icon={centerMarkerIcon}>
                  <Popup>
                    <div className="p-1 text-xs">
                      <p className="font-bold text-emerald-700">Community Center Point</p>
                      <p className="text-gray-500">
                        {radiusCenter.lat.toFixed(5)}, {radiusCenter.lng.toFixed(5)}
                      </p>
                      <p className="mt-1 font-semibold">Radius: {radiusMeters} metres</p>
                    </div>
                  </Popup>
                </Marker>
                <Circle
                  center={[radiusCenter.lat, radiusCenter.lng]}
                  radius={radiusMeters}
                  pathOptions={{
                    color: enabled ? '#10b981' : '#9ca3af',
                    fillColor: enabled ? '#34d399' : '#d1d5db',
                    fillOpacity: 0.2,
                    weight: 2,
                    dashArray: enabled ? null : '5, 5',
                  }}
                />
              </>
            )}

            {/* User Location Marker */}
            {userLoc && (
              <Marker position={[userLoc.lat, userLoc.lng]} icon={userLocationIcon}>
                <Popup>
                  <div className="p-1 text-xs font-semibold text-purple-700">
                    Your Current Location
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Map Overlay Instructions */}
          <div className="absolute top-3 left-3 z-[400] bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 max-w-xs">
            {mode === 'polygon' ? (
              <span>
                💡 <strong>Click the map</strong> to place vertices for your boundary polygon. At
                least 3 points required.
              </span>
            ) : (
              <span>
                💡 <strong>Click the map</strong> to set the community center point, then adjust the
                radius slider.
              </span>
            )}
          </div>
        </div>

        {/* Configuration Side Panel */}
        <div className="p-6 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800 flex flex-col justify-between bg-white dark:bg-gray-900">
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-1">
                {mode === 'polygon' ? 'Polygon Vertices' : 'Radius Settings'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {mode === 'polygon'
                  ? `${polygonVertices.length} vertices added (${polygonVertices.length >= 3 ? 'Valid polygon' : 'Needs ' + (3 - polygonVertices.length) + ' more'})`
                  : radiusCenter
                  ? `Center set at ${radiusCenter.lat.toFixed(4)}, ${radiusCenter.lng.toFixed(4)}`
                  : 'Click on the map to set center point'}
              </p>
            </div>

            {/* Polygon Mode Controls */}
            {mode === 'polygon' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleUndoVertex}
                    disabled={polygonVertices.length === 0}
                    className="flex-1 py-2 px-3 text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Undo Point
                  </button>
                  <button
                    type="button"
                    onClick={handleClearDrawing}
                    disabled={polygonVertices.length === 0}
                    className="py-2 px-3 text-xs font-medium bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </button>
                </div>

                {/* Vertices list */}
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 border border-gray-200 dark:border-gray-800 rounded-2xl p-2 bg-gray-50/50 dark:bg-gray-950/30">
                  {polygonVertices.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400">
                      No vertices placed yet. Click on the map to begin.
                    </div>
                  ) : (
                    polygonVertices.map((v, i) => (
                      <div
                        key={`v-item-${i}`}
                        className="flex items-center justify-between text-xs p-1.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800"
                      >
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          #{i + 1}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300 font-mono text-[11px]">
                          {v.lat.toFixed(4)}, {v.lng.toFixed(4)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveVertex(i)}
                          className="text-red-500 hover:text-red-700 p-0.5"
                          title="Remove vertex"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Center-Radius Mode Controls */}
            {mode === 'radius' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Radius (Metres)
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {radiusMeters}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="2000"
                    step="10"
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>20m</span>
                    <span>500m</span>
                    <span>1000m</span>
                    <span>2000m</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(Number(e.target.value))}
                    className="w-full text-xs font-semibold px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
                    placeholder="Enter radius in metres"
                  />
                  <button
                    type="button"
                    onClick={() => setRadiusCenter(null)}
                    disabled={!radiusCenter}
                    className="py-2 px-3 text-xs font-medium bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl transition-colors disabled:opacity-40"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* Common Accuracy & Policy Settings */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Maximum GPS Accuracy (Metres)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={maxAccuracyMeters}
                    onChange={(e) => setMaxAccuracyMeters(Number(e.target.value))}
                    className="w-full text-xs font-medium px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    ± metres
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Readings with GPS error larger than this will be rejected.
                </p>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950/50 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Power
                    className={`w-4 h-4 ${enabled ? 'text-emerald-500' : 'text-gray-400'}`}
                  />
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                      Boundary Enforcement
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {enabled ? 'Active on check-ins' : 'Disabled (check-ins blocked)'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabled((prev) => !prev)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                    enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  ></div>
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-800 space-y-2 mt-4">
            <button
              type="button"
              onClick={handleSaveBoundary}
              disabled={saving}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Boundary...' : 'Save Boundary Configuration'}
            </button>

            {existingBoundary && (
              <button
                type="button"
                onClick={handleDeleteBoundary}
                className="w-full py-2 px-4 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Deactivate & Delete Boundary
              </button>
            )}

            {existingBoundary?.updatedByName && (
              <p className="text-center text-[10px] text-gray-400 pt-1">
                Last updated by {existingBoundary.updatedByName} on{' '}
                {new Date(existingBoundary.updatedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoundaryConfigMap;
