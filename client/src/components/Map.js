import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { point, center, featureCollection, distance } from '@turf/turf';
import getInfoFromNowStatus from '../getInfoFromNowStatus';
import { debounce } from 'lodash';

import '../styles/map.css';

const getDirectionsUrl = (addr) => {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
}

export const Map = ({
  data,
  day,
  time,
  userGps,
  zoom,
  mapCoords,
  loading,
  setLoading,
  handleMapCoordsChange,
}) => {
  const initialZoom = 12.9;
  const markers = useRef([]);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  const moveEndHandler = (event) => {
    const coords = mapRef.current.getCenter();
    mapCoords.current = { lat: coords.lat.toFixed(6), lng: coords.lng.toFixed(6) };
    zoom.current = mapRef.current.getZoom().toFixed(2);
    if (!event.originalEvent) {
      // ignore moveend events triggered by 'flyTo' or 'fitBounds'
      return;
    } else {
      handleMapCoordsChange();
    }
  }

  const debounceMoveEndHandler = debounce(moveEndHandler, 3000, { leading: false, trailing: true });

  useEffect(() => {
    if (!userGps.latitude || !userGps.longitude || mapRef.current || !mapContainerRef.current) return;
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [userGps.longitude, userGps.latitude],
      zoom: initialZoom
    });
    const map = mapRef.current;
    const coords = map.getCenter();
    mapCoords.current = { lat: coords.lat.toFixed(6), lng: coords.lng.toFixed(6) };
    zoom.current = map.getZoom().toFixed(2);
    map.on('load', () => {
      if (loading) {
        setLoading(false);
      }
    });
    
    map.on('moveend', debounceMoveEndHandler);

    handleMapCoordsChange();
  }, [userGps]);

  useEffect(() => {
    if (!mapRef.current || !mapContainerRef) return;
    markers.current.forEach(marker => {
      marker.remove();
    });
    const fromPoint = userGps.longitude && userGps.latitude ? point([ userGps.longitude, userGps.latitude ]) : null;
    const newMarkers = [];
    const turfPoints = [];
    for (let loc of data.locations) {
      if (!isNaN(Number(loc.longitude)) && !isNaN(Number(loc.latitude))) {
        const lnglat = { lng: Number(loc.longitude), lat: Number(loc.latitude) };
        const toPoint = point([ lnglat.lng, lnglat.lat ]);
        turfPoints.push(toPoint);
        loc.distance = fromPoint ? Number(distance(fromPoint, toPoint)).toFixed(4) : '?';
        loc.directions = getDirectionsUrl(loc.address);
        let statusStr = '';
        if (day === -1) {
          statusStr = loc.nowStatus;
        } else if (loc.allStatus && loc.allStatus[day]) {
          const stat = loc.allStatus[day].filter(stat => stat.time === time)[0];
          statusStr = stat && stat.status && stat.status !== '' ? stat.status : 'No popular times data';
        } else {
          statusStr = 'No popular times data';
        }
        const { status, img } = getInfoFromNowStatus(statusStr);

        let popupEl = document.createElement('div');
        popupEl.className = 'popup-inner';
        popupEl.innerHTML = `
          <div class="top">
            <div class="crowded-${status}">${statusStr}</div>
            ${day === -1 && loc.live ?'<div class="live"><span class="dot"></span>Live</div>' : ''}
          </div>
          <div class="middle">
            <div>${loc.name}</div>
            <div>${loc.distance} km</div>
            <div>${loc.address}</div>
          </div>
          <div class="bottom">
            <a href=${encodeURI(loc.link)}>VIEW</a>
            <a href=${encodeURI(loc.directions)}>DIRECTIONS</a>
          </div>`;
        const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setLngLat(lnglat)
        .setDOMContent(popupEl);

        let markerEl = document.createElement('div');
        markerEl.className = `marker${loc.live ? ' live' : ''}`
        markerEl.innerHTML = `<img src="${process.env.PUBLIC_URL}${img}" />`
        newMarkers.push(new mapboxgl.Marker(markerEl)
        .setLngLat(lnglat)
        .setPopup(popup)
        .addTo(mapRef.current));
      }
    }
    if (turfPoints.length > 0) {
      const newCenter = center(featureCollection(turfPoints));
      
      mapRef.current.flyTo({
        center: newCenter.geometry.coordinates,
        speed: 0.5,
        curve: 0,
        essential: true
      });
      const bounds = new mapboxgl.LngLatBounds();
      turfPoints.forEach(function(pt) {
        bounds.extend(pt.geometry.coordinates);
      });
      mapRef.current.fitBounds(bounds, { padding: 100 });
    }
    
    markers.current = newMarkers;
  }, [data, day, time]);

  const wrapperStyle = {
    height: '500px'
  };

  return (
    <div className="Fade">
      <div className="contentWrapper">
        <div style={wrapperStyle} ref={mapContainerRef} className='mapContainer'/>
      </div>
    </div>
  )
}

export default Map;