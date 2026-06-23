import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { ISSUE_TYPES } from '../utils/api';

// Create a custom icon for each issue type
function createMarkerIcon(issue) {
  const config = ISSUE_TYPES[issue.type] || ISSUE_TYPES.other;
  const size = issue.upvotes >= 10 ? 'lg' : issue.upvotes >= 5 ? 'md' : 'sm';
  const sizeMap = { sm: 28, md: 34, lg: 42 };
  const px = sizeMap[size];
  const resolvedClass = issue.status === 'resolved' ? ' resolved' : '';
  
  return L.divIcon({
    className: '',
    iconSize: [px, px],
    iconAnchor: [px / 2, px],
    popupAnchor: [0, -px + 4],
    html: `<div class="custom-marker size-${size}${resolvedClass}" style="background-color: ${config.color}">
      <span class="marker-icon">${config.icon}</span>
    </div>`
  });
}

export default function MapView({ issues, onIssueClick, onMapClick, selectedIssue }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(null);
  const markerObjsRef = useRef({});
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [17.385, 78.4867], // Hyderabad, India default
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
      maxZoom: 19,
      minZoom: 3,
    });

    // Dark-themed tile layer (free, no API key)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Create marker cluster group
    const markers = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      animate: true
    });

    map.addLayer(markers);
    markersRef.current = markers;
    mapInstanceRef.current = map;

    // Try to get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 14);
        },
        () => {
          // Keep default center
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }

    // Map click handler for selecting a report location
    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick(e.latlng);
      }
    });

    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when issues change
  useEffect(() => {
    if (!mapReady || !markersRef.current) return;

    const clusterGroup = markersRef.current;
    const existingIds = new Set(Object.keys(markerObjsRef.current));
    const newIds = new Set(issues.map(i => i.id));

    // Remove markers for deleted issues
    for (const id of existingIds) {
      if (!newIds.has(id)) {
        clusterGroup.removeLayer(markerObjsRef.current[id]);
        delete markerObjsRef.current[id];
      }
    }

    // Add or update markers
    for (const issue of issues) {
      const existingMarker = markerObjsRef.current[issue.id];
      
      if (existingMarker) {
        // Update existing marker icon (for upvote changes, status changes)
        existingMarker.setIcon(createMarkerIcon(issue));
        // Update popup content
        existingMarker.setPopupContent(createPopupContent(issue));
      } else {
        // Create new marker
        const marker = L.marker([issue.lat, issue.lng], {
          icon: createMarkerIcon(issue),
          riseOnHover: true
        });

        marker.bindPopup(createPopupContent(issue), {
          maxWidth: 300,
          className: 'custom-popup'
        });

        marker.on('click', () => {
          if (onIssueClick) onIssueClick(issue);
        });

        clusterGroup.addLayer(marker);
        markerObjsRef.current[issue.id] = marker;
      }
    }
  }, [issues, mapReady]);

  // Fly to selected issue
  useEffect(() => {
    if (!mapReady || !selectedIssue || !mapInstanceRef.current) return;

    mapInstanceRef.current.flyTo(
      [selectedIssue.lat, selectedIssue.lng],
      16,
      { duration: 0.8 }
    );

    // Open popup for selected marker
    const marker = markerObjsRef.current[selectedIssue.id];
    if (marker) {
      setTimeout(() => marker.openPopup(), 800);
    }
  }, [selectedIssue, mapReady]);

  return <div ref={mapRef} className="map-container" id="main-map" />;
}

function createPopupContent(issue) {
  const config = ISSUE_TYPES[issue.type] || ISSUE_TYPES.other;
  const statusClass = issue.status.replace('_', '-');
  
  let photoHtml = '';
  if (issue.photo_url) {
    photoHtml = `<img src="${issue.photo_url}" alt="Issue photo" class="popup-photo" loading="lazy" onerror="this.style.display='none'" />`;
  }

  return `
    <div class="popup-content">
      <div class="popup-header">
        <span class="issue-type-badge ${issue.type}">
          ${config.icon} ${config.label}
        </span>
        <span class="issue-status-badge ${issue.status}">
          ${issue.status === 'in_progress' ? 'In Progress' : issue.status}
        </span>
      </div>
      ${photoHtml}
      ${issue.description ? `<p class="popup-description">${issue.description}</p>` : ''}
      <div class="popup-meta">
        <span>👤 ${issue.display_name || 'Anonymous'}</span>
        <span>👍 ${issue.upvotes} vote${issue.upvotes !== 1 ? 's' : ''}</span>
      </div>
    </div>
  `;
}
