import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Filter, Clock, CheckCircle, AlertCircle, MapPin, User, Calendar, Hash } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Component to handle auto-centering map based on markers
const MapBounds = ({ markers }) => {
  const map = useMap();
  
  useEffect(() => {
    if (markers && markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.location?.lat || m.lat, m.location?.lng || m.lng]));
      // Only fit bounds if there are markers, with padding to ensure markers aren't cut off
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [markers, map]);
  
  return null;
};

// Simple Progress Tracker Component
const ProgressTracker = ({ status }) => {
  const stages = ['Submitted', 'Verified', 'Assigned', 'WIP', 'Completed'];
  
  let currentStageIdx = 0;
  if (status === 'Verified') currentStageIdx = 1;
  else if (status === 'Assigned to Worker' || status === 'Assigned') currentStageIdx = 2;
  else if (status === 'WIP' || status === 'Work In Progress') currentStageIdx = 3;
  else if (status === 'Completed') currentStageIdx = 4;
  
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

// Dummy Data Fallback
const dummyComplaints = [
  {
    id: "CMP-2024-001",
    title: "Broken Streetlight",
    description: "The streetlight near the main park entrance has been flickering and is now completely off.",
    status: "Pending",
    lat: 28.6125,
    lng: 77.2085,
    worker: "Unassigned",
    date: "2026-04-29"
  },
  {
    id: "CMP-2024-002",
    title: "Water Pipe Leak",
    description: "There is a noticeable water leak from the main pipe behind Block A.",
    status: "WIP",
    lat: 28.6139,
    lng: 77.2090,
    worker: "John Plumber",
    date: "2026-04-28"
  },
  {
    id: "CMP-2024-003",
    title: "Elevator Malfunction",
    description: "Lift #2 in Block C stops abruptly on the 3rd floor.",
    status: "Completed",
    lat: 28.6145,
    lng: 77.2105,
    worker: "Elevator Tech Inc.",
    date: "2026-04-25"
  },
  {
    id: "CMP-2024-004",
    title: "Pothole on Main Driveway",
    description: "Large pothole forming near the visitor parking area.",
    status: "Pending",
    lat: 28.6130,
    lng: 77.2110,
    worker: "Unassigned",
    date: "2026-04-30"
  }
];

const InteractiveComplaintMap = ({ complaintsData = null }) => {
  const complaints = complaintsData || dummyComplaints;
  const [filter, setFilter] = useState('All');
  
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
    if (status === 'Completed') return 'Completed';
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
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800"><AlertCircle className="w-3 h-3 mr-1" /> Pending</span>;
      case 'WIP':
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800"><Clock className="w-3 h-3 mr-1" /> In Progress</span>;
      case 'Completed':
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
        
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative z-0">
        <MapContainer 
          center={[28.6139, 77.2090]} // Default center if no markers
          zoom={15} 
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          {/* Using a visually pleasing dark/light compatible tile layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            className="map-tiles"
          />
          
          <MapBounds markers={filteredComplaints} />
          
          {filteredComplaints.map(complaint => (
            <Marker 
              key={complaint.id} 
              position={[complaint.location?.lat || complaint.lat, complaint.location?.lng || complaint.lng]}
              icon={getMarkerIcon(getCategory(complaint.status))}
            >
              <Popup className="custom-popup" minWidth={300} maxWidth={320}>
                {/* Custom styling applied inside the popup to override Leaflet defaults safely */}
                <div className="p-1">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-1.5 text-xs text-gray-500 font-medium bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                      <Hash className="w-3 h-3" />
                      <span>{complaint.id}</span>
                    </div>
                    <StatusBadge status={complaint.status} />
                  </div>
                  
                  <h4 className="text-base font-bold text-gray-900 dark:text-white mb-1.5 leading-tight">
                    {complaint.title || complaint.text || "Complaint Report"}
                  </h4>
                  
                  {complaint.image && (
                    <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 mb-3">
                      <img 
                        src={`/uploads/${complaint.image}`}
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
                      <span>{new Date(complaint.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <ProgressTracker status={complaint.status} />
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
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
