import { useId, useEffect } from 'react';
import { map } from './core/MapView';

const MapHeatmap = ({ positions }) => {
  const id = useId();

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
    map.addLayer({
      source: id,
      id: `${id}-heatmap`,
      type: 'heatmap',
      paint: {
        'heatmap-weight': 1,
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(0,0,255,0)',
          0.2,
          'royalblue',
          0.4,
          'cyan',
          0.6,
          'lime',
          0.8,
          'yellow',
          1,
          'red',
        ],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 15, 30],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 13, 1, 16, 0.5],
      },
    });

    return () => {
      if (map.getLayer(`${id}-heatmap`)) {
        map.removeLayer(`${id}-heatmap`);
      }
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    };
  }, []);

  useEffect(() => {
    map.getSource(id)?.setData({
      type: 'FeatureCollection',
      features: positions.map((p) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.longitude, p.latitude],
        },
      })),
    });
  }, [positions]);

  return null;
};

export default MapHeatmap;
