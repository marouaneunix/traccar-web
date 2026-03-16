import { useState } from 'react';
import { IconButton, Paper, Toolbar, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useNavigate } from 'react-router-dom';
import MapView from '../map/core/MapView';
import MapGeofence from '../map/MapGeofence';
import MapScale from '../map/MapScale';
import MapCamera from '../map/MapCamera';
import MapHeatmap from '../map/MapHeatmap';
import ReportFilter from './components/ReportFilter';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatch } from '../reactHelper';
import BackIcon from '../common/components/BackIcon';
import fetchOrThrow from '../common/util/fetchOrThrow';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    zIndex: 3,
    left: 0,
    top: 0,
    margin: theme.spacing(1.5),
    width: theme.dimensions.drawerWidthDesktop,
    [theme.breakpoints.down('md')]: {
      width: '100%',
      margin: 0,
    },
  },
  title: {
    flexGrow: 1,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(1),
    },
    [theme.breakpoints.up('md')]: {
      marginTop: theme.spacing(1),
    },
  },
}));

const HeatmapReportPage = () => {
  const t = useTranslation();
  const { classes } = useStyles();
  const navigate = useNavigate();

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
    <div className={classes.root}>
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
      <div className={classes.sidebar}>
        <Paper elevation={3} square>
          <Toolbar>
            <IconButton edge="start" sx={{ mr: 2 }} onClick={() => navigate(-1)}>
              <BackIcon />
            </IconButton>
            <Typography variant="h6" className={classes.title}>
              {t('reportHeatmap')}
            </Typography>
          </Toolbar>
        </Paper>
        <Paper className={classes.content} square>
          <ReportFilter onShow={onShow} deviceType="single" loading={loading} />
        </Paper>
      </div>
    </div>
  );
};

export default HeatmapReportPage;
