import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Filter, Clock, CheckCircle, AlertCircle, MapPin, User, Calendar, Hash, LocateFixed } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCurrentLocation } from '../services/geolocationService';

// Strict coordinate validator: guarantees finite numbers within valid geographic bounds
// Never uses truthiness checks so valid zero coordinates (0, 0) are strictly preserved
const isValidCoordinate = (lat, lng) => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const numLat = Number(lat);
  const numLng = Number(lng);
  return (
    Number.isFinite(numLat) &&
    Number.isFinite(numLng) &&
    numLat >= -90 &&
    numLat <= 90 &&
    numLng >= -180 &&
    numLng <= 180
  );
};

const isValidLatLngPair = (coord) =>
  Array.isArray(coord) &&
  coord.length === 2 &&
  isValidCoordinate(coord[0], coord[1]);

// Component to handle auto-centering map based on markers
const MapBounds = ({ markers }) => {
  const map = useMap();
  
  useEffect(() => {
    if (markers && markers.length > 0) {
      const validCoords = markers
        .map(m => [Number(m.location?.lat ?? m.lat), Number(m.location?.lng ?? m.lng)])
        .filter(([lat, lng]) => isValidCoordinate(lat, lng));
      
      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [markers, map]);
  
  return null;
};

// Component to handle dynamic center adjustments when boundary or user location changes
const MapViewController = ({ center, zoom, userLocation, hasMarkers }) => {
  const map = useMap();

  useEffect(() => {
    if (isValidLatLngPair(userLocation)) {
      map.flyTo(userLocation, 16);
    } else if (!hasMarkers && isValidLatLngPair(center)) {
      map.setView(center, zoom || 15);
    }
  }, [center, zoom, userLocation, hasMarkers, map]);

  return null;
};

// Simple Progress Tracker Component
const ProgressTracker = ({ status }) => {
  const stages = ['Submitted', 'Verified', 'Assigned', 'WIP', 'Completed'];
  
  let currentStageIdx = 0;
  if (status === 'Verified') currentStageIdx = 1;
  else if (status === 'Assigned to Worker' || status === 'Assigned') currentStageIdx = 2;
  else if (status === 'WIP' || status === 'Work In Progress') currentStageIdx = 3;
  else if (status === 'Completed' || status === 'Closed' || status === 'Resolved') currentStageIdx = 4;
  
  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50">
      <div className="flex justify-between relative">
        {/* Connecting line */}
        <div className="absolute top-1.5 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -z-10"></div>
        <div 
          className="absolute top-1.5 left-0 h-0.5 bg-blue-500 transition-all duration-500 ease-in-out -z-10"
          style={{ width: `${(currentStageIdx / (stages.length - 1)) * 100}%` }}
        ></div>
        
        {stages.map((stage, idx) => (
          <div key={stage} className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 transition-colors duration-300 ${
              idx <= currentStageIdx ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}></div>
            <span className={`text-[9px] mt-1.5 font-medium ${
              idx <= currentStageIdx ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'
            }`}>
              {stage}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Neutral default coordinates for unconfigured communities (global view, not a fabricated location)
const NEUTRAL_CENTER = [20, 0];
const NEUTRAL_ZOOM = 2;

const InteractiveComplaintMap = ({ complaintsData = [], communityCenter = null }) => {
  // Never fallback to demo complaints or fabricated coordinates
  const complaints = Array.isArray(complaintsData) ? complaintsData : [];
  const hasValidCenter = isValidLatLngPair(communityCenter);
  const [filter, setFilter] = useState('All');
  const [userLocation, setUserLocation] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const handleLocateMe = async () => {
    if (locating) return;
    setLocating(true);
    setLocationError(null);
    try {
      const loc = await getCurrentLocation({ enableHighAccuracy: true, timeout: 12000 });
      if (isValidCoordinate(loc?.lat, loc?.lng)) {
        setUserLocation([Number(loc.lat), Number(loc.lng)]);
        setUserAccuracy(Number.isFinite(loc.accuracy) ? loc.accuracy : null);
        if (loc.accuracy && loc.accuracy > 10000) {
          setLocationError(`Location acquired with low accuracy (±${Math.round(loc.accuracy / 1000)} km).`);
        }
      } else {
        throw new Error('Received invalid coordinate fix from browser geolocation.');
      }
    } catch (err) {
      let message = 'Unable to acquire location.';
      if (err?.code === 'PERMISSION_DENIED') {
        message = 'Location permission was denied. Please allow location access in your browser settings to locate your position.';
      } else if (err?.code === 'POSITION_UNAVAILABLE') {
        message = 'GPS position unavailable. Please ensure device location services or GPS are turned on.';
      } else if (err?.code === 'TIMEOUT') {
        message = 'Location request timed out. Please verify your GPS signal or network connection and try again.';
      } else if (err?.code === 'NOT_SUPPORTED') {
        message = 'Geolocation is not supported by your browser.';
      } else if (err?.message) {
        message = err.message;
      }
      setLocationError(message);
    } finally {
      setLocating(false);
    }
  };

  const getUserMarkerIcon = () => {
    return L.divIcon({
      className: 'bg-transparent border-0',
      html: `<div class="relative w-6 h-6 flex items-center justify-center">
               <div class="absolute w-full h-full rounded-full opacity-40 animate-ping bg-blue-600"></div>
               <div class="w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 bg-blue-600 shadow-md z-10"></div>
             </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });
  };
  
  // Custom marker icon generator based on status
  const getMarkerIcon = (status) => {
    let colorClass = "";
    switch(status) {
      case 'Pending': colorClass = "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"; break;
      case 'WIP': colorClass = "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]"; break;
      case 'Completed': colorClass = "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]"; break;
      default: colorClass = "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"; break;
    }
    
    return L.divIcon({
      className: 'bg-transparent border-0',
      html: `<div class="relative w-6 h-6 flex items-center justify-center">
               <div class="absolute w-full h-full rounded-full opacity-50 animate-ping ${colorClass}"></div>
               <div class="w-4 h-4 rounded-full border-[2.5px] border-white dark:border-gray-900 z-10 ${colorClass}"></div>
             </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });
  };

  // Filter map categories to match backend
  const getCategory = (status) => {
    if (status === 'Completed' || status === 'Closed' || status === 'Resolved') return 'Completed';
    if (status === 'Work In Progress' || status === 'Assigned to Worker' || status === 'WIP') return 'WIP';
    return 'Pending'; // Submitted, Verified, Pending
  };

  // Filter complaints based on selected status
  const filteredComplaints = useMemo(() => {
    return filter === 'All' 
      ? complaints 
      : complaints.filter(c => getCategory(c.status) === filter);
  }, [complaints, filter]);

  // Statistics for the filter badges
  const stats = useMemo(() => {
    const counts = { All: complaints.length, Pending: 0, WIP: 0, Completed: 0 };
    complaints.forEach(c => {
      const cat = getCategory(c.status);
      if (counts[cat] !== undefined) counts[cat]++;
    });
    return counts;
  }, [complaints]);

  // Helper to render status badge with right colors
  const StatusBadge = ({ status }) => {
    switch(status) {
      case 'Pending':
      case 'Submitted':
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800"><AlertCircle className="w-3 h-3 mr-1" /> Pending</span>;
      case 'WIP':
      case 'Work In Progress':
      case 'Assigned to Worker':
      case 'Assigned':
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800"><Clock className="w-3 h-3 mr-1" /> In Progress</span>;
      case 'Completed':
      case 'Closed':
      case 'Resolved':
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Completed</span>;
      default:
        return <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[600px] w-full bg-white dark:bg-gray-900/50 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden relative">
      
      {/* Filter Controls Header */}
      <div className="p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Map Filters</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Showing {filteredComplaints.length} locations</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {['All', 'Pending', 'WIP', 'Completed'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center space-x-1 border
                ${filter === status 
                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white shadow-md' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
                }`}
            >
              <span>{status}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                filter === status 
                  ? 'bg-white/20 dark:bg-black/10' 
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                {stats[status]}
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center space-x-1 border border-blue-200 dark:border-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 disabled:opacity-50"
            title="Locate my position via browser GPS"
          >
            <LocateFixed className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
            <span>{locating ? 'Locating...' : 'Locate Me'}</span>
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative z-0">
        <MapContainer 
          center={hasValidCenter ? [Number(communityCenter[0]), Number(communityCenter[1])] : NEUTRAL_CENTER}
          zoom={hasValidCenter ? 15 : NEUTRAL_ZOOM} 
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          {/* Using a visually pleasing dark/light compatible tile layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            className="map-tiles"
          />
          
          <MapViewController 
            center={communityCenter} 
            zoom={15} 
            userLocation={userLocation} 
            hasMarkers={filteredComplaints.length > 0} 
          />
          
          <MapBounds markers={filteredComplaints} />

          {isValidLatLngPair(userLocation) && (
            <Marker position={userLocation} icon={getUserMarkerIcon()}>
              <Popup className="custom-popup" minWidth={220}>
                <div className="p-2 text-center">
                  <div className="flex items-center justify-center space-x-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>Your Location</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Browser GPS fix (one-time request)
                  </p>
                  {Number.isFinite(userAccuracy) && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                      Accuracy: &plusmn;{userAccuracy}m
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          )}
          
          {filteredComplaints.map(complaint => {
            const rawLat = complaint.location?.lat ?? complaint.lat;
            const rawLng = complaint.location?.lng ?? complaint.lng;
            if (!isValidCoordinate(rawLat, rawLng)) {
              return null;
            }
            const lat = Number(rawLat);
            const lng = Number(rawLng);

            return (
              <Marker 
                key={complaint.id || complaint._id || `${lat}-${lng}`} 
                position={[lat, lng]}
                icon={getMarkerIcon(getCategory(complaint.status))}
              >
                <Popup className="custom-popup" minWidth={300} maxWidth={320}>
                  {/* Custom styling applied inside the popup to override Leaflet defaults safely */}
                  <div className="p-1">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-1.5 text-xs text-gray-500 font-medium bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                        <Hash className="w-3 h-3" />
                        <span>{complaint.id || complaint._id || 'N/A'}</span>
                      </div>
                      <StatusBadge status={complaint.status} />
                    </div>
                    
                    <h4 className="text-base font-bold text-gray-900 dark:text-white mb-1.5 leading-tight">
                      {complaint.title || complaint.text || "Complaint Report"}
                    </h4>
                    
                    {complaint.image && (
                      <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 mb-3">
                        <img 
                          src={complaint.image.startsWith('http') || complaint.image.startsWith('/') ? complaint.image : `/uploads/${complaint.image}`}
                          alt="Complaint evidence" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                      {complaint.description || complaint.text || "No description provided."}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                        <User className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                        <span className="truncate" title={complaint.worker || complaint.assignedWorker || 'Unassigned'}>
                          {complaint.worker || complaint.assignedWorker || 'Unassigned'}
                        </span>
                      </div>
                      <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                        <Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                        <span>{new Date(complaint.date || complaint.createdAt || Date.now()).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <ProgressTracker status={complaint.status} />
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Empty State Overlay */}
        {filteredComplaints.length === 0 && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] max-w-sm w-full px-4 pointer-events-none">
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-5 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 text-center pointer-events-auto">
              {complaints.length === 0 ? (
                !hasValidCenter && !userLocation ? (
                  <>
                    <MapPin className="w-8 h-8 text-blue-500 dark:text-blue-400 mx-auto mb-2 opacity-80" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Neutral Map View</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4 leading-relaxed">
                      No community boundary center or geolocated complaints are configured. Click below or enable location permissions in your browser to center on your position.
                    </p>
                    <button
                      type="button"
                      onClick={handleLocateMe}
                      disabled={locating}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl shadow transition-colors disabled:opacity-50"
                    >
                      <LocateFixed className={`w-3.5 h-3.5 mr-1.5 ${locating ? 'animate-spin' : ''}`} />
                      {locating ? 'Acquiring GPS...' : 'Locate My Position'}
                    </button>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-80" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Zero Complaints</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      There are currently no geolocated complaints reported in your community.
                    </p>
                  </>
                )
              ) : (
                <>
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-80" />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">No Matching Complaints</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
                    No complaints found under the &ldquo;{filter}&rdquo; filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFilter('All')}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg transition-colors"
                  >
                    Show All ({complaints.length})
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* GPS Error Notification */}
        {locationError && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] max-w-sm w-full px-4 pointer-events-none">
            <div className="bg-red-50 dark:bg-red-950/90 border border-red-200 dark:border-red-800 p-3 rounded-xl shadow-lg flex items-center justify-between text-xs text-red-700 dark:text-red-300 pointer-events-auto">
              <div className="flex items-center space-x-2 mr-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{locationError}</span>
              </div>
              <button
                type="button"
                onClick={() => setLocationError(null)}
                className="text-red-500 hover:text-red-700 dark:hover:text-red-200 font-bold ml-2 shrink-0 p-1"
              >
                &times;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Embedded CSS for custom dark mode styles in Leaflet popups */}
      <style dangerouslySetInnerHTML={{__html: `
        /* Make map tiles react to dark mode */
        html.dark .map-tiles {
          filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
        }
        
        /* Custom Popup Styling */
        .leaflet-popup-content-wrapper {
          background-color: var(--tw-prose-body) !important;
          border-radius: 1rem !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
          overflow: hidden;
        }
        
        html.dark .leaflet-popup-content-wrapper, html.dark .leaflet-popup-tip {
          background-color: #1f2937 !important; /* gray-800 */
          color: #f3f4f6 !important; /* gray-100 */
        }
        
        .leaflet-popup-tip {
          background-color: white !important;
        }
        
        html.dark .leaflet-popup-tip {
          background-color: #1f2937 !important;
        }
        
        .leaflet-popup-content {
          margin: 12px 14px !important;
          line-height: normal !important;
        }
        
        /* Hide default close button to keep UI clean */
        .leaflet-container a.leaflet-popup-close-button {
          color: #9ca3af !important;
          padding: 6px !important;
          border-radius: 50% !important;
        }
        
        html.dark .leaflet-container a.leaflet-popup-close-button {
          color: #6b7280 !important;
        }
        
        .leaflet-container a.leaflet-popup-close-button:hover {
          background-color: rgba(0,0,0,0.05) !important;
          color: #4b5563 !important;
        }
        
        html.dark .leaflet-container a.leaflet-popup-close-button:hover {
          background-color: rgba(255,255,255,0.1) !important;
          color: #e5e7eb !important;
        }
      `}} />
    </div>
  );
};

export default InteractiveComplaintMap;
