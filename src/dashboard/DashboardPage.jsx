import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import TuneIcon from '@mui/icons-material/Tune';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';
import { devicesActions, sessionActions } from '../store';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from '../reports/components/ReportsMenu';
import ReportDateRangePicker from '../reports/components/ReportDateRangePicker';
import SelectField from '../common/components/SelectField';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import { useAdministrator, useRestriction } from '../common/util/permissions';
import { formatDistance, formatTime, formatStatus } from '../common/util/formatter';
import { useAttributePreference } from '../common/util/preferences';
import fetchOrThrow from '../common/util/fetchOrThrow';
import {
  aggregateActivity,
  aggregateWallet,
  classificationKeys,
  defaultRules,
} from './dashboardUtils';

const Metric = ({ label, value, detail, loading, color = 'text.primary' }) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {loading ? (
        <Skeleton width="65%" height={48} />
      ) : (
        <Typography variant="h4" color={color} sx={{ my: 1, fontWeight: 600 }}>
          {value ?? '—'}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </CardContent>
  </Card>
);

const grid = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
  gap: 2,
};

const getSettings = (value, accountId) => {
  try {
    const saved = typeof value === 'string' ? JSON.parse(value) : value;
    return saved?.accounts?.[accountId] || { rules: defaultRules, overrides: {} };
  } catch {
    return { rules: defaultRules, overrides: {} };
  }
};

const DashboardPage = () => {
  const t = useTranslation();
  const { language } = useLocalization();
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const admin = useAdministrator();
  const disableReports = useRestriction('disableReports');
  const distanceUnit = useAttributePreference('distanceUnit', 'km');
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const user = useSelector((state) => state.session.user);
  const deviceList = useMemo(
    () => Object.values(devices).sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [defaults] = useState(() => [dayjs().startOf('month'), dayjs().endOf('day')]);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const from = fromParam && dayjs(fromParam).isValid() ? fromParam : defaults[0].toISOString();
  const to = toParam && dayjs(toParam).isValid() ? toParam : defaults[1].toISOString();
  const rangeValid = !dayjs(to).isBefore(dayjs(from));
  const [connectionState, setConnectionState] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [reload, setReload] = useState(0);
  const [reportState, setReportState] = useState({ loading: false });
  const [walletState, setWalletState] = useState({ loading: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState(defaultRules);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [classificationFilter, setClassificationFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const deviceId =
    Number(searchParams.get('deviceId')) ||
    selectedDeviceId ||
    deviceList.find(
      (item) => typeof item.attributes?.accountId === 'string' && item.attributes.accountId.trim(),
    )?.id ||
    deviceList[0]?.id;
  const device = devices[deviceId];
  const position = positions[deviceId];
  const accountAttribute =
    typeof device?.attributes?.accountId === 'string' ? device.attributes.accountId.trim() : '';
  const mappingKey = `${deviceId}:${accountAttribute}`;
  const connection = connectionState?.mappingKey === mappingKey ? connectionState : null;
  const queryKey = `${deviceId}:${from}:${to}`;
  const report =
    reportState.queryKey === queryKey
      ? reportState
      : { loading: !!device && rangeValid && !disableReports };
  const walletQueryKey = `${queryKey}:${mappingKey}:${connection?.accountId || ''}`;
  const wallet = walletState.queryKey === walletQueryKey ? walletState : { loading: false };
  const settings = useMemo(
    () => getSettings(user.attributes.walletDashboard, connection?.accountId),
    [user.attributes.walletDashboard, connection?.accountId],
  );
  const finance = useMemo(
    () => (admin && wallet.data ? aggregateWallet(wallet.data.records, settings) : null),
    [admin, wallet.data, settings],
  );
  const activity = useMemo(
    () => aggregateActivity(report.summaries || [], report.trips || []),
    [report.summaries, report.trips],
  );
  const money = (amount, currency = 'MAD') =>
    new Intl.NumberFormat(language.replace('_', '-'), {
      style: 'currency',
      currency: /^[A-Z]{3}$/.test(currency) ? currency : 'MAD',
      maximumFractionDigits: 2,
    }).format(amount);

  useEffect(() => {
    if (!admin || disableReports || !device) return undefined;
    setConnectionState(null);
    setConnectionError(null);
    const controller = new AbortController();
    const loadConnection = async () => {
      try {
        const response = await fetch(`/api/dashboard/wallet/status?deviceId=${deviceId}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'walletUnavailable');
        }
        const data = await response.json();
        if (!controller.signal.aborted) {
          setConnectionState({ ...data, mappingKey });
          setConnectionError(null);
        }
      } catch (error) {
        if (!controller.signal.aborted) setConnectionError(error.message);
      }
    };
    loadConnection();
    return () => controller.abort();
  }, [admin, disableReports, deviceId, !!device, mappingKey, reload]);

  useEffect(() => {
    if (!device || !rangeValid || disableReports) return undefined;
    const controller = new AbortController();
    const query = new URLSearchParams({ deviceId, from, to });
    const fetchData = async (path) => {
      const response = await fetch(path, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        if (path.startsWith('/api/dashboard')) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'walletUnavailable');
        }
        throw new Error('dashboardActivityError');
      }
      return response.json();
    };
    setReportState({ loading: true, queryKey });
    const loadActivity = async () => {
      const [summaries, trips] = await Promise.allSettled([
        fetchData(`/api/reports/summary?${query}&daily=true`),
        fetchData(`/api/reports/trips?${query}`),
      ]);
      if (!controller.signal.aborted)
        setReportState({
          loading: false,
          queryKey,
          summaries: summaries.status === 'fulfilled' ? summaries.value : null,
          trips: trips.status === 'fulfilled' ? trips.value : null,
          error: summaries.status === 'rejected' || trips.status === 'rejected',
        });
    };
    loadActivity();
    setWalletState({ loading: false, queryKey: walletQueryKey });
    if (admin && connection?.configured && Number(connection.deviceId) === Number(deviceId)) {
      setWalletState({ loading: true, queryKey: walletQueryKey });
      fetchData(`/api/dashboard/wallet?${query}`)
        .then((data) => {
          if (!controller.signal.aborted) {
            if (data.accountId !== connection.accountId) throw new Error('walletMappingChanged');
            setWalletState({ loading: false, data, queryKey: walletQueryKey });
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setWalletState({ loading: false, error: error.message, queryKey: walletQueryKey });
        });
    }
    return () => controller.abort();
  }, [deviceId, !!device, from, to, rangeValid, disableReports, admin, connection, reload]);

  useEffect(() => {
    setSettingsOpen(false);
    setClassificationFilter('all');
    setPage(0);
  }, [mappingKey]);

  const updateFilters = (values) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(values).forEach(([key, value]) => params.set(key, value));
    setSearchParams(params, { replace: true });
    setPage(0);
  };

  const saveSettings = async (next) => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved =
        typeof user.attributes.walletDashboard === 'string'
          ? JSON.parse(user.attributes.walletDashboard)
          : user.attributes.walletDashboard || {};
      const value = { ...saved, accounts: { ...saved.accounts, [connection.accountId]: next } };
      const response = await fetchOrThrow(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...user,
          attributes: { ...user.attributes, walletDashboard: JSON.stringify(value) },
        }),
      });
      dispatch(sessionActions.updateUser(await response.json()));
      setSettingsOpen(false);
    } catch {
      setSaveError(t('dashboardSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const transactions =
    finance?.transactions.filter(
      (item) => classificationFilter === 'all' || item.classification === classificationFilter,
    ) || [];
  const safePage = Math.min(page, Math.max(0, Math.ceil(transactions.length / rowsPerPage) - 1));
  const financialDetail =
    finance && !finance.complete ? t('dashboardClassifiedOnly') : t('dashboardRecordedDateBasis');
  const chartStyle = {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
  };
  const statusColor =
    device?.status === 'online' ? 'success' : device?.status === 'offline' ? 'error' : 'default';

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['dashboardTitle']}>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1600, width: '100%', mx: 'auto' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <DashboardIcon color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {t('dashboardTitle')}
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t('dashboardSubtitle')}
        </Typography>
        {disableReports ? (
          <Alert severity="warning">{t('dashboardReportsDisabled')}</Alert>
        ) : (
          <>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
              <Box sx={{ flex: 1 }}>
                <SelectField
                  label={t('reportDevice')}
                  data={deviceList}
                  value={deviceId || ''}
                  onChange={(event) => updateFilters({ deviceId: event.target.value })}
                  fullWidth
                />
              </Box>
              <Box sx={{ flex: 2 }}>
                <ReportDateRangePicker
                  value={[dayjs(from), dayjs(to)]}
                  onChange={([start, end]) =>
                    updateFilters({ from: start.toISOString(), to: end.toISOString() })
                  }
                />
              </Box>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => setReload((value) => value + 1)}
                disabled={report.loading || wallet.loading}
              >
                {t('dashboardRefresh')}
              </Button>
              {admin && connection?.accountId && (
                <Button
                  variant="outlined"
                  startIcon={<TuneIcon />}
                  onClick={() => {
                    setRuleDraft({ ...defaultRules, ...settings.rules });
                    setSettingsOpen(true);
                  }}
                >
                  {t('dashboardClassification')}
                </Button>
              )}
            </Stack>
            {!device && <Alert severity="info">{t('dashboardChooseVehicle')}</Alert>}
            {!rangeValid && <Alert severity="error">{t('walletInvalidPeriod')}</Alert>}
            {device && (
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Box>
                      <Typography variant="overline">{t('dashboardCurrentStatus')}</Typography>
                      <Typography variant="h6">{device.name}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Chip
                          size="small"
                          label={formatStatus(device.status, t)}
                          color={statusColor}
                        />
                        <Chip
                          size="small"
                          label={
                            position?.attributes?.motion === true
                              ? t('dashboardMoving')
                              : position?.attributes?.motion === false
                                ? t('dashboardStopped')
                                : t('dashboardMotionUnknown')
                          }
                        />
                      </Stack>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('dashboardLastGps')}
                      </Typography>
                      <Typography>
                        {position?.fixTime
                          ? formatTime(position.fixTime, 'seconds')
                          : t('dashboardNoGps')}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {position?.address ||
                          (position
                            ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
                            : '—')}
                      </Typography>
                    </Box>
                    <Button
                      startIcon={<DirectionsCarIcon />}
                      onClick={() => {
                        dispatch(devicesActions.selectId(deviceId));
                        navigate('/');
                      }}
                    >
                      {t('dashboardViewMap')}
                    </Button>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {t('dashboardCurrentStatusHint')}
                  </Typography>
                </CardContent>
              </Card>
            )}
            {report.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {t('dashboardActivityError')}
              </Alert>
            )}
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t('dashboardVehicleActivity')}
            </Typography>
            <Box sx={grid}>
              <Metric
                label={t('sharedDistance')}
                value={report.summaries ? formatDistance(activity.distance, distanceUnit, t) : null}
                loading={report.loading}
                detail={t('dashboardGpsDistance')}
              />
              <Metric
                label={t('dashboardDrivingHours')}
                value={
                  report.trips ? `${activity.drivingHours.toFixed(1)} ${t('sharedHours')}` : null
                }
                loading={report.loading}
                detail={t('dashboardTripDuration')}
              />
              <Metric
                label={t('dashboardActiveDays')}
                value={report.summaries ? activity.activeDays : null}
                loading={report.loading}
                detail={t('dashboardActiveDaysHint')}
              />
              <Metric
                label={t('reportTrips')}
                value={report.trips ? activity.tripCount : null}
                loading={report.loading}
                detail={t('dashboardGpsTrips')}
              />
            </Box>
            <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
              {t('dashboardFinances')}
            </Typography>
            {!admin && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('dashboardAdminFinance')}
              </Alert>
            )}
            {admin && (connectionError || wallet.error) && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {t(wallet.error || connectionError) || t('walletUnavailable')}
              </Alert>
            )}
            {admin && connection && !connection.configured && (
              <Alert
                severity="info"
                sx={{ mb: 2 }}
                action={
                  <Button
                    size="small"
                    onClick={() =>
                      navigate(
                        connection.accountId
                          ? '/settings/attributes'
                          : `/settings/device/${deviceId}`,
                      )
                    }
                  >
                    {t('sharedEdit')}
                  </Button>
                }
              >
                {t(connection.accountId ? 'walletNotConfigured' : 'walletAccountMissing')}
              </Alert>
            )}
            {wallet.data?.syncInProgress && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('dashboardSyncInProgress')}
              </Alert>
            )}
            {finance && !finance.complete && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {t('dashboardIncomplete')}{' '}
                {finance.unclassifiedCount > 0 &&
                  `${t('dashboardUnclassified')}: ${finance.unclassifiedCount}. `}
                {finance.excludedCount > 0 &&
                  `${t('dashboardUnsupportedRecords')}: ${finance.excludedCount}. `}
                {finance.unmatchedLoss > 0 &&
                  `${t('dashboardUnmatchedLoss')}: ${money(finance.unmatchedLoss)}.`}
              </Alert>
            )}
            {finance && !finance.transactions.length && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('dashboardNoTransactions')}
              </Alert>
            )}
            <Box sx={grid}>
              <Metric
                label={t('dashboardAdjustedEarnings')}
                value={finance ? money(finance.earned) : null}
                loading={wallet.loading}
                detail={financialDetail}
                color="success.main"
              />
              <Metric
                label={t('dashboardLostEarnings')}
                value={finance ? money(finance.lostEarnings) : null}
                loading={wallet.loading}
                detail={t('dashboardLostEarningsHint')}
                color="warning.main"
              />
              <Metric
                label={t('dashboardOperatingCosts')}
                value={finance ? money(finance.operatingCost) : null}
                loading={wallet.loading}
                detail={financialDetail}
              />
              <Metric
                label={t('dashboardOperatingResult')}
                value={finance ? money(finance.result) : null}
                loading={wallet.loading}
                detail={financialDetail}
                color={finance?.result < 0 ? 'error.main' : 'success.main'}
              />
            </Box>
            {finance && (
              <Card variant="outlined" sx={{ mt: 2 }}>
                <CardContent>
                  <Stack direction="row" useFlexGap flexWrap="wrap" gap={3}>
                    {[
                      ['dashboardReceivedIncome', finance.receivedIncome],
                      ['dashboardExpectedIncome', finance.expectedIncome],
                      ['dashboardAdvances', finance.advance],
                      ['dashboardHousehold', finance.household],
                      ['dashboardAdjustments', finance.adjustment],
                      ['dashboardRecordedNet', finance.recordedNet],
                    ].map(([key, amount]) => (
                      <Box key={key}>
                        <Typography variant="caption" color="text.secondary">
                          {t(key)}
                        </Typography>
                        <Typography fontWeight={600}>{money(amount)}</Typography>
                      </Box>
                    ))}
                  </Stack>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    {t('dashboardCalculationHint')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('dashboardLastSync')}: {formatTime(wallet.data.fetchedAt, 'seconds')}
                    {wallet.data.lastDataChangeAt &&
                      ` · ${t('dashboardLastWalletChange')}: ${formatTime(wallet.data.lastDataChangeAt, 'seconds')}`}
                  </Typography>
                </CardContent>
              </Card>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
                gap: 2,
                mt: 3,
              }}
            >
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6">{t('dashboardDailyDistance')}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('dashboardKilometres')}
                  </Typography>
                  <Box sx={{ height: 260, mt: 2 }}>
                    {report.loading ? (
                      <Skeleton variant="rectangular" height={240} />
                    ) : activity.days.length ? (
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                        minWidth={0}
                        initialDimension={{ width: 400, height: 260 }}
                      >
                        <AreaChart data={activity.days}>
                          <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) => dayjs(value).format('DD MMM')}
                          />
                          <YAxis />
                          <Tooltip
                            contentStyle={chartStyle}
                            formatter={(value) => [
                              `${Number(value).toFixed(1)} km`,
                              t('sharedDistance'),
                            ]}
                          />
                          <Area
                            dataKey="distance"
                            type="monotone"
                            stroke={theme.palette.primary.main}
                            fill={theme.palette.primary.light}
                            fillOpacity={0.3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <Typography color="text.secondary">{t('dashboardNoActivity')}</Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6">{t('dashboardDailyFinances')}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('dashboardRecordedDateBasis')}
                  </Typography>
                  <Box sx={{ height: 260, mt: 2 }}>
                    {wallet.loading ? (
                      <Skeleton variant="rectangular" height={240} />
                    ) : finance?.days.length ? (
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                        minWidth={0}
                        initialDimension={{ width: 400, height: 260 }}
                      >
                        <BarChart data={finance.days}>
                          <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) => dayjs(value).format('DD MMM')}
                          />
                          <YAxis />
                          <Tooltip contentStyle={chartStyle} formatter={(value) => money(value)} />
                          <Legend />
                          <Bar
                            dataKey="earned"
                            name={t('dashboardAdjustedEarnings')}
                            fill={theme.palette.success.main}
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="operatingCost"
                            name={t('dashboardOperatingCosts')}
                            fill={theme.palette.error.main}
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <Typography color="text.secondary">
                        {t('dashboardFinanceUnavailable')}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Box>
            {finance && (
              <Card variant="outlined" sx={{ mt: 3 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  justifyContent="space-between"
                  sx={{ p: 2 }}
                >
                  <Typography variant="h6">{t('dashboardTransactions')}</Typography>
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel>{t('dashboardClassification')}</InputLabel>
                    <Select
                      label={t('dashboardClassification')}
                      value={classificationFilter}
                      onChange={(event) => {
                        setClassificationFilter(event.target.value);
                        setPage(0);
                      }}
                    >
                      <MenuItem value="all">{t('dashboardAllRecords')}</MenuItem>
                      {Object.entries(classificationKeys).map(([key, label]) => (
                        <MenuItem value={key} key={key}>
                          {t(label)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
                {saving && <LinearProgress />}
                {saveError && <Alert severity="error">{saveError}</Alert>}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {[
                          'dashboardDate',
                          'dashboardNote',
                          'dashboardLabels',
                          'dashboardAmount',
                          'dashboardClassification',
                        ].map((key) => (
                          <TableCell key={key}>{t(key)}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transactions
                        .slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage)
                        .map((record) => (
                          <TableRow key={record.id}>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {formatTime(record.recordDate, 'date')}
                            </TableCell>
                            <TableCell sx={{ minWidth: 180 }}>{record.note || '—'}</TableCell>
                            <TableCell>
                              {(record.labels || []).map((label) => label.name).join(', ') || '—'}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {Number.isFinite(record.amount?.value)
                                ? money(record.amount.value, record.amount.currencyCode)
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <Select
                                size="small"
                                value={settings.overrides?.[record.id] || 'auto'}
                                disabled={
                                  saving ||
                                  record.excluded ||
                                  !!record.transfer ||
                                  record.recordType === 'transfer'
                                }
                                inputProps={{
                                  'aria-label': `${t('dashboardClassification')}: ${record.note || record.id}`,
                                }}
                                onChange={(event) => {
                                  const overrides = { ...settings.overrides };
                                  if (event.target.value === 'auto') delete overrides[record.id];
                                  else overrides[record.id] = event.target.value;
                                  saveSettings({ ...settings, overrides });
                                }}
                                sx={{ minWidth: 220 }}
                              >
                                <MenuItem value="auto">
                                  {t('dashboardAutomatic')} (
                                  {t(classificationKeys[record.classification])})
                                </MenuItem>
                                {Object.entries(classificationKeys).map(([key, label]) => (
                                  <MenuItem key={key} value={key}>
                                    {t(label)}
                                  </MenuItem>
                                ))}
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={transactions.length}
                  page={safePage}
                  rowsPerPage={rowsPerPage}
                  onPageChange={(_, next) => setPage(next)}
                  onRowsPerPageChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setPage(0);
                  }}
                />
              </Card>
            )}
          </>
        )}
      </Box>
      <Dialog
        open={settingsOpen}
        onClose={() => !saving && setSettingsOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t('dashboardClassification')}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t('dashboardRulesHint')}
          </Typography>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {Object.keys(defaultRules).map((key) => (
              <TextField
                key={key}
                label={t(classificationKeys[key])}
                value={ruleDraft[key] || ''}
                onChange={(event) => setRuleDraft({ ...ruleDraft, [key]: event.target.value })}
                fullWidth
              />
            ))}
          </Stack>
          {saveError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {saveError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setSettingsOpen(false)}>
            {t('sharedCancel')}
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={() => saveSettings({ ...settings, rules: ruleDraft })}
          >
            {t('sharedSave')}
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  );
};

export default DashboardPage;
