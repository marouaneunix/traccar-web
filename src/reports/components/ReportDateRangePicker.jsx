import { useId, useState } from 'react';
import { Box, Button, InputAdornment, Popover, Stack, TextField } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickerDay } from '@mui/x-date-pickers/PickerDay';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { useLocalization, useTranslation } from '../../common/components/LocalizationProvider';

const RangeDay = ({ day, rangeStart, rangeEnd, ...props }) => {
  const start = rangeStart?.isValid() && day.isSame(rangeStart, 'day');
  const end = rangeEnd?.isValid() && day.isSame(rangeEnd, 'day');
  const inRange =
    rangeStart?.isValid() &&
    rangeEnd?.isValid() &&
    !day.isBefore(rangeStart, 'day') &&
    !day.isAfter(rangeEnd, 'day');

  return (
    <PickerDay
      {...props}
      day={day}
      selected={!!(start || end)}
      aria-selected={!!(start || end)}
      isVisuallySelected={!!(start || end)}
      sx={
        inRange && !start && !end
          ? { borderRadius: 0, bgcolor: 'action.selected', '&:hover': { bgcolor: 'action.hover' } }
          : undefined
      }
    />
  );
};

const ReportDateRangePicker = ({ value, onChange }) => {
  const t = useTranslation();
  const { language } = useLocalization();
  const locale = language.replace('_', '-').toLowerCase();
  const id = useId();
  const [anchorEl, setAnchorEl] = useState(null);
  const [draft, setDraft] = useState(value);
  const [selectingStart, setSelectingStart] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(value[0].startOf('month'));
  const valid = draft[0]?.isValid() && draft[1]?.isValid() && !draft[1].isBefore(draft[0], 'day');
  const label = `${t('reportFrom')} – ${t('reportTo')}`;

  const openPicker = (event) => {
    setDraft(value);
    setSelectingStart(true);
    setCalendarMonth(value[0].startOf('month'));
    setAnchorEl(event.currentTarget);
  };

  const selectDate = (date) => {
    if (selectingStart || !draft[0]?.isValid() || date.isBefore(draft[0], 'day')) {
      setDraft([date, null]);
      setSelectingStart(false);
    } else {
      setDraft([draft[0], date]);
      setSelectingStart(true);
    }
  };

  const shortcuts = [
    ['reportToday', 0, 'day'],
    ['reportYesterday', 1, 'day'],
    ['reportThisWeek', 0, 'week'],
    ['reportPreviousWeek', 1, 'week'],
    ['reportThisMonth', 0, 'month'],
    ['reportPreviousMonth', 1, 'month'],
  ];

  return (
    <>
      <TextField
        label={label}
        value={`${value[0].locale(locale).format('L')} – ${value[1].locale(locale).format('L')}`}
        fullWidth
        onClick={openPicker}
        slotProps={{
          input: {
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <CalendarMonthIcon />
              </InputAdornment>
            ),
          },
          htmlInput: {
            'aria-haspopup': 'dialog',
            'aria-expanded': !!anchorEl,
            'aria-controls': anchorEl ? id : undefined,
            onKeyDown: (event) => {
              if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
                event.preventDefault();
                openPicker(event);
              }
            },
          },
        }}
      />
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { maxHeight: 'calc(100% - 32px)' } } }}
      >
        <Box id={id} role="dialog" aria-label={label} sx={{ p: 2, maxWidth: '100%' }}>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ maxWidth: 640, mb: 2 }}>
            {shortcuts.map(([key, offset, unit]) => (
              <Button
                key={key}
                size="small"
                variant="outlined"
                onClick={() => {
                  const date = dayjs().subtract(offset, unit);
                  setDraft([date.startOf(unit), date.endOf(unit)]);
                  setCalendarMonth(date.startOf(unit).startOf('month'));
                  setSelectingStart(true);
                }}
              >
                {t(key)}
              </Button>
            ))}
          </Stack>
          <Stack direction="row" spacing={2} sx={{ maxWidth: 640 }}>
            {['reportFrom', 'reportTo'].map((key, index) => (
              <TextField
                key={key}
                label={t(key)}
                type="date"
                size="small"
                fullWidth
                value={
                  draft[index]?.isValid() ? draft[index].locale('en').format('YYYY-MM-DD') : ''
                }
                onChange={(event) => {
                  const date = event.target.value ? dayjs(event.target.value) : null;
                  setDraft(index === 0 ? [date, draft[1]] : [draft[0], date]);
                  setSelectingStart(index !== 0);
                  if (date?.isValid()) {
                    setCalendarMonth(date.startOf('month'));
                  }
                }}
                error={index === 1 && !!draft[1] && !valid}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            ))}
          </Stack>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={locale}>
            <Stack direction="row">
              {[0, 1].map((offset) => (
                <DateCalendar
                  key={`${calendarMonth.format('YYYY-MM')}-${offset}`}
                  value={null}
                  referenceDate={calendarMonth.add(offset, 'month')}
                  onChange={selectDate}
                  views={['day']}
                  slots={{ day: RangeDay }}
                  slotProps={{ day: { rangeStart: draft[0], rangeEnd: draft[1] } }}
                  sx={{
                    width: { xs: 280, sm: 320 },
                    display: offset ? { xs: 'none', sm: 'block' } : undefined,
                  }}
                />
              ))}
            </Stack>
          </LocalizationProvider>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={() => setAnchorEl(null)}>{t('sharedCancel')}</Button>
            <Button
              variant="contained"
              disabled={!valid}
              onClick={() => {
                onChange([draft[0].startOf('day'), draft[1].endOf('day')]);
                setAnchorEl(null);
              }}
            >
              {t('sharedSave')}
            </Button>
          </Stack>
        </Box>
      </Popover>
    </>
  );
};

export default ReportDateRangePicker;
