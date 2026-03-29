export default {
  MuiAppBar: {
    styleOverrides: {
      root: ({ theme }) => ({
        background:
          theme.palette.mode === 'dark'
            ? theme.palette.background.paper
            : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        color: theme.palette.mode === 'dark' ? theme.palette.text.primary : '#fff',
      }),
    },
  },
  MuiUseMediaQuery: {
    defaultProps: {
      noSsr: true,
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.background.default,
      }),
    },
  },
  MuiButton: {
    styleOverrides: {
      sizeMedium: {
        height: '40px',
      },
    },
  },
  MuiFormControl: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiSnackbar: {
    defaultProps: {
      anchorOrigin: {
        vertical: 'bottom',
        horizontal: 'center',
      },
    },
  },
  MuiTooltip: {
    defaultProps: {
      enterDelay: 500,
      enterNextDelay: 500,
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }) => ({
        '@media print': {
          color: theme.palette.alwaysDark.main,
        },
      }),
    },
  },
};
