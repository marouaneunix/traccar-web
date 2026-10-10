import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, TextField, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { useTranslation } from '../../common/components/LocalizationProvider';
import useReportStyles from '../common/useReportStyles';
import ReportDateRangePicker from './ReportDateRangePicker';
import SplitButton from '../../common/components/SplitButton';
import SelectField from '../../common/components/SelectField';
import { useRestriction } from '../../common/util/permissions';
import { deviceEquality } from '../../common/util/deviceEquality';

export const updateReportParams = (searchParams, setSearchParams, key, values) => {
  const newParams = new URLSearchParams(searchParams);
  newParams.delete(key);
  newParams.delete('from');
  newParams.delete('to');
  values.forEach((value) => newParams.append(key, value));
  setSearchParams(newParams, { replace: true });
};

const ReportFilter = ({ children, onShow, onExport, onSchedule, deviceType, loading }) => {
  const { classes } = useReportStyles();
  const t = useTranslation();

  const [searchParams, setSearchParams] = useSearchParams();

  const readonly = useRestriction('readonly');

  const devices = useSelector((state) => state.devices.items, deviceEquality(['id', 'name']));
  const groups = useSelector((state) => state.groups.items);
  const deviceList = useMemo(
    () => Object.values(devices).sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  );
  const groupList = useMemo(
    () => Object.values(groups).sort((a, b) => a.name.localeCompare(b.name)),
    [groups],
  );

  const deviceIds = useMemo(() => searchParams.getAll('deviceId').map(Number), [searchParams]);
  const groupIds = useMemo(() => searchParams.getAll('groupId').map(Number), [searchParams]);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const [dateRange, setDateRange] = useState(() => [
    from && dayjs(from).isValid() ? dayjs(from) : dayjs().startOf('day'),
    to && dayjs(to).isValid() ? dayjs(to) : dayjs().endOf('day'),
  ]);
  const [selectedOption, setSelectedOption] = useState('json');

  const [description, setDescription] = useState();
  const [calendarId, setCalendarId] = useState();

  const evaluateDisabled = () => {
    if (deviceType === 'single' && !deviceIds.length) {
      return true;
    }
    if (selectedOption === 'schedule' && (!description || !calendarId)) {
      return true;
    }
    return loading;
  };
  const disabled = evaluateDisabled();
  const loaded = from && to && !loading;

  const evaluateOptions = () => {
    const result = {
      json: t('reportShow'),
    };
    if (onExport && loaded) {
      result.export = t('reportExport');
      result.print = t('reportPrint');
    }
    if (onSchedule && !readonly) {
      result.schedule = t('reportSchedule');
    }
    return result;
  };
  const options = evaluateOptions();

  useEffect(() => {
    if (from && to) {
      onShow({ deviceIds, groupIds, from, to });
    }
  }, [deviceIds, groupIds, from, to]);

  useEffect(() => {
    if (from && to && dayjs(from).isValid() && dayjs(to).isValid()) {
      setDateRange([dayjs(from), dayjs(to)]);
    }
  }, [from, to]);

  const showReport = () => {
    const [selectedFrom, selectedTo] = dateRange;
    if (!selectedFrom?.isValid() || !selectedTo?.isValid() || selectedTo.isBefore(selectedFrom)) {
      return;
    }

    const newParams = new URLSearchParams(searchParams);
    newParams.set('from', selectedFrom.toISOString());
    newParams.set('to', selectedTo.toISOString());
    setSearchParams(newParams, { replace: true });
  };

  const onSelected = (type) => {
    switch (type) {
      case 'export':
        onExport({ deviceIds, groupIds, from, to });
        break;
      case 'print':
        window.print();
        break;
      default:
        setSelectedOption(type);
        break;
    }
  };

  const onClick = (type) => {
    switch (type) {
      case 'schedule':
        onSchedule(deviceIds, groupIds, {
          description,
          calendarId,
          attributes: {},
        });
        break;
      case 'json':
      default:
        showReport();
        break;
    }
  };

  return (
    <div className={classes.filter}>
      {deviceType !== 'none' && (
        <div className={classes.filterItem}>
          <SelectField
            label={t(deviceType === 'multiple' ? 'deviceTitle' : 'reportDevice')}
            data={deviceList}
            value={deviceType === 'multiple' ? deviceIds : deviceIds.find(() => true)}
            placeholder={
              deviceType === 'multiple' && !groupIds.length ? t('notificationAlways') : null
            }
            onChange={(e) => {
              const values =
                deviceType === 'multiple' ? e.target.value : [e.target.value].filter((id) => id);
              updateReportParams(searchParams, setSearchParams, 'deviceId', values);
            }}
            multiple={deviceType === 'multiple'}
            singleLine={deviceType === 'multiple'}
            fullWidth
          />
        </div>
      )}
      {deviceType === 'multiple' && (
        <div className={classes.filterItem}>
          <SelectField
            label={t('settingsGroups')}
            data={groupList}
            value={groupIds}
            onChange={(e) => {
              const values = e.target.value;
              updateReportParams(searchParams, setSearchParams, 'groupId', values);
            }}
            multiple
            singleLine
            fullWidth
          />
        </div>
      )}
      {selectedOption !== 'schedule' ? (
        <div className={classes.filterDateRange}>
          <ReportDateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      ) : (
        <>
          <div className={classes.filterItem}>
            <TextField
              value={description || ''}
              onChange={(event) => setDescription(event.target.value)}
              label={t('sharedDescription')}
              fullWidth
            />
          </div>
          <div className={classes.filterItem}>
            <SelectField
              value={calendarId}
              onChange={(event) => setCalendarId(Number(event.target.value))}
              endpoint="/api/calendars"
              label={t('sharedCalendar')}
              fullWidth
            />
          </div>
        </>
      )}
      {children}
      <div className={classes.filterItem}>
        {Object.keys(options).length === 1 ? (
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            disabled={disabled}
            onClick={onClick}
          >
            <Typography variant="button" noWrap>
              {t(loading ? 'sharedLoading' : 'reportShow')}
            </Typography>
          </Button>
        ) : (
          <SplitButton
            fullWidth
            variant="outlined"
            color="secondary"
            disabled={disabled}
            onClick={onClick}
            selected={selectedOption}
            setSelected={onSelected}
            options={options}
          />
        )}
      </div>
    </div>
  );
};

export default ReportFilter;
