import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Typography, AppBar, Toolbar, IconButton, Box, Chip, Divider } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHashtag,
  faMicrochip,
  faNetworkWired,
  faServer,
  faMobileAlt,
  faCrosshairs,
  faCheckCircle,
  faMapMarkerAlt,
  faLocationArrow,
  faMountain,
  faTachometerAlt,
  faCompass,
  faStreetView,
  faBullseye,
  faWifi,
  faDrawPolygon,
  faRoad,
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';
import { useEffectAsync } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import PositionValue from '../common/components/PositionValue';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import BackIcon from '../common/components/BackIcon';
import fetchOrThrow from '../common/util/fetchOrThrow';

const iconMap = {
  id: faHashtag,
  deviceId: faMicrochip,
  protocol: faNetworkWired,
  serverTime: faServer,
  deviceTime: faMobileAlt,
  fixTime: faCrosshairs,
  valid: faCheckCircle,
  latitude: faMapMarkerAlt,
  longitude: faLocationArrow,
  altitude: faMountain,
  speed: faTachometerAlt,
  course: faCompass,
  address: faStreetView,
  accuracy: faBullseye,
  network: faWifi,
  geofenceIds: faDrawPolygon,
  distance: faRoad,
};

const defaultIcon = faCircleInfo;

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: theme.palette.mode === 'dark' ? theme.palette.background.default : '#f5f6fa',
  },
  deviceTitle: {
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  content: {
    overflow: 'auto',
    padding: theme.spacing(3),
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: theme.spacing(2),
    alignItems: 'start',
  },
  section: {
    borderRadius: 16,
    background: theme.palette.background.paper,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  sectionHeader: {
    padding: theme.spacing(1.5, 2.5),
    background:
      theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(25, 118, 210, 0.07)',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1.5, 2.5),
    gap: theme.spacing(2),
    transition: 'background 0.15s',
    '&:hover': {
      background:
        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(25, 118, 210, 0.04)',
    },
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme.palette.mode === 'dark' ? 'rgba(25,118,210,0.2)' : 'rgba(25,118,210,0.1)',
    color: theme.palette.primary.main,
    flexShrink: 0,
  },
  labelGroup: {
    flex: 1,
    minWidth: 0,
  },
  attributeName: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
    lineHeight: 1.2,
  },
  humanName: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    lineHeight: 1.3,
  },
  valueChip: {
    fontWeight: 600,
    fontSize: '0.8rem',
    maxWidth: 180,
    height: 'auto',
    padding: theme.spacing(0.25, 0),
    '& .MuiChip-label': {
      whiteSpace: 'normal',
      wordBreak: 'break-all',
    },
  },
  divider: {
    marginLeft: theme.spacing(8),
  },
}));

const SECTIONS = [
  {
    label: 'Identity',
    icon: faMicrochip,
    keys: ['id', 'deviceId', 'protocol'],
  },
  {
    label: 'Timestamps',
    icon: faServer,
    keys: ['serverTime', 'deviceTime', 'fixTime'],
  },
  {
    label: 'Location',
    icon: faMapMarkerAlt,
    keys: ['valid', 'latitude', 'longitude', 'altitude', 'accuracy', 'address'],
  },
  {
    label: 'Movement',
    icon: faTachometerAlt,
    keys: ['speed', 'course', 'distance'],
  },
  {
    label: 'Network & Geofences',
    icon: faWifi,
    keys: ['network', 'geofenceIds'],
  },
];

const getSectionForKey = (key) => {
  for (const section of SECTIONS) {
    if (section.keys.includes(key)) return section.label;
  }
  return 'Other';
};

const PositionRow = ({ property, attribute, item, positionAttributes, classes }) => {
  const key = property || attribute;
  const icon = iconMap[key] || defaultIcon;

  const attrMeta = positionAttributes[key];
  const humanName = attrMeta?.name;

  return (
    <Box className={classes.row}>
      <Box className={classes.iconWrapper}>
        <FontAwesomeIcon icon={icon} size="sm" />
      </Box>
      <Box className={classes.labelGroup}>
        <Typography className={classes.attributeName}>{key}</Typography>
        {humanName && <Typography className={classes.humanName}>{humanName}</Typography>}
      </Box>
      <Chip
        label={
          property ? (
            <PositionValue position={item} property={property} />
          ) : (
            <PositionValue position={item} attribute={attribute} />
          )
        }
        variant="outlined"
        color="primary"
        size="small"
        className={classes.valueChip}
      />
    </Box>
  );
};

const PositionPage = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();

  const positionAttributes = usePositionAttributes(t);

  const { id } = useParams();
  const [item, setItem] = useState();

  useEffectAsync(async () => {
    if (id) {
      const response = await fetchOrThrow(`/api/positions?id=${id}`);
      const positions = await response.json();
      if (positions.length > 0) {
        setItem(positions[0]);
      }
    }
  }, [id]);

  const deviceName = useSelector((state) => {
    if (item) {
      const device = state.devices.items[item.deviceId];
      if (device) return device.name;
    }
    return null;
  });

  const buildSections = () => {
    if (!item) return [];

    const allRows = [
      ...Object.getOwnPropertyNames(item)
        .filter((it) => it !== 'attributes')
        .map((property) => ({ type: 'property', key: property })),
      ...Object.getOwnPropertyNames(item.attributes).map((attribute) => ({
        type: 'attribute',
        key: attribute,
      })),
    ];

    const sectionMap = {};
    for (const section of SECTIONS) {
      sectionMap[section.label] = { ...section, rows: [] };
    }
    sectionMap['Other'] = { label: 'Other', icon: faCircleInfo, rows: [] };

    for (const row of allRows) {
      const sectionLabel = getSectionForKey(row.key);
      if (!sectionMap[sectionLabel]) {
        sectionMap[sectionLabel] = { label: sectionLabel, icon: faCircleInfo, rows: [] };
      }
      sectionMap[sectionLabel].rows.push(row);
    }

    return Object.values(sectionMap).filter((s) => s.rows.length > 0);
  };

  const sections = buildSections();

  return (
    <div className={classes.root}>
      <AppBar position="sticky">
        <Toolbar>
          <IconButton edge="start" sx={{ mr: 2, color: 'inherit' }} onClick={() => navigate(-1)}>
            <BackIcon />
          </IconButton>
          <FontAwesomeIcon icon={faMobileAlt} style={{ marginRight: 10, opacity: 0.85 }} />
          <Typography variant="h6" className={classes.deviceTitle}>
            {deviceName || '—'}
          </Typography>
        </Toolbar>
      </AppBar>

      <div className={classes.content}>
        <div className={classes.grid}>
          {sections.map((section) => (
            <Box key={section.label} className={classes.section}>
              <Box className={classes.sectionHeader}>
                <FontAwesomeIcon icon={section.icon} size="sm" />
                <Typography className={classes.sectionTitle}>{section.label}</Typography>
              </Box>
              {section.rows.map((row, idx) => (
                <Box key={row.key}>
                  <PositionRow
                    property={row.type === 'property' ? row.key : undefined}
                    attribute={row.type === 'attribute' ? row.key : undefined}
                    item={item}
                    positionAttributes={positionAttributes}
                    classes={classes}
                  />
                  {idx < section.rows.length - 1 && <Divider className={classes.divider} />}
                </Box>
              ))}
            </Box>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PositionPage;
