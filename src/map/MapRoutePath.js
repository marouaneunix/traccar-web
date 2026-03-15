import { useTheme } from '@mui/material/styles';
import { useId, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { map } from './core/MapView';
import getSpeedColor from '../common/util/colors';
import { useAttributePreference } from '../common/util/preferences';

const smoothCoordinates = (coords, iterations = 3) => {
  let pts = coords;
  for (let it = 0; it < iterations; it++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      next.push([0.75 * pts[i][0] + 0.25 * pts[i + 1][0], 0.75 * pts[i][1] + 0.25 * pts[i + 1][1]]);
      next.push([0.25 * pts[i][0] + 0.75 * pts[i + 1][0], 0.25 * pts[i][1] + 0.75 * pts[i + 1][1]]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
};

const MapRoutePath = ({ positions }) => {
  const id = useId();

  const theme = useTheme();

  const reportColor = useSelector((state) => {
    const position = positions?.find(() => true);
    if (position) {
      const attributes = state.devices.items[position.deviceId]?.attributes;
      if (attributes) {
        const color = attributes['web.reportColor'];
        if (color) {
          return color;
        }
      }
    }
    return null;
  });

  const mapLineWidth = useAttributePreference('mapLineWidth', 2);
  const mapLineOpacity = useAttributePreference('mapLineOpacity', 1);

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [],
        },
      },
    });
    map.addLayer({
      source: id,
      id: `${id}-line`,
      type: 'line',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity'],
      },
    });

    return () => {
      if (map.getLayer(`${id}-line`)) {
        map.removeLayer(`${id}-line`);
      }
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    };
  }, []);

  useEffect(() => {
    const minSpeed = positions.map((p) => p.speed).reduce((a, b) => Math.min(a, b), Infinity);
    const maxSpeed = positions.map((p) => p.speed).reduce((a, b) => Math.max(a, b), -Infinity);
    const iterations = 3;
    const step = 2 ** iterations;
    const smoothed = smoothCoordinates(
      positions.map((p) => [p.longitude, p.latitude]),
      iterations,
    );
    const features = [];
    for (let j = 0; j < smoothed.length - 1; j += 1) {
      const origIdx = Math.min(Math.floor(j / step), positions.length - 2);
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [smoothed[j], smoothed[j + 1]],
        },
        properties: {
          color: reportColor || getSpeedColor(positions[origIdx + 1].speed, minSpeed, maxSpeed),
          width: mapLineWidth,
          opacity: mapLineOpacity,
        },
      });
    }
    map.getSource(id)?.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [theme, positions, reportColor, mapLineWidth, mapLineOpacity]);

  return null;
};

export default MapRoutePath;
