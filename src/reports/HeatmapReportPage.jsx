import { useState } from 'react';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import ReportFilter from './components/ReportFilter';
import useReportStyles from './common/useReportStyles';
import MapView from '../map/core/MapView';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import MapScale from '../map/MapScale';
import MapHeatmap from '../map/MapHeatmap';
import { useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';

const HeatmapReportPage = () => {
  const { classes } = useReportStyles();

  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);

  const onShow = useCatch(async ({ deviceIds, from, to }) => {
    const query = new URLSearchParams({ from, to });
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
    setLoading(true);
    try {
      const response = await fetchOrThrow(`/api/reports/route?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      setPositions(await response.json());
    } finally {
      setLoading(false);
    }
  });

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportHeatmap']}>
      <div className={classes.container}>
        <div className={classes.header}>
          <ReportFilter onShow={onShow} deviceType="single" loading={loading} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <MapView>
            <MapGeofence />
            {positions.length > 0 && <MapHeatmap positions={positions} />}
          </MapView>
          <MapScale />
          {positions.length > 0 && (
            <MapCamera
              latitude={positions[Math.floor(positions.length / 2)].latitude}
              longitude={positions[Math.floor(positions.length / 2)].longitude}
            />
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default HeatmapReportPage;
