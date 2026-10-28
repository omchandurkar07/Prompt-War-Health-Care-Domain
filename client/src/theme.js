import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#4f46e5',
      dark: '#3730a3',
      light: '#e0e7ff',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7c3aed',
      dark: '#5b21b6',
      light: '#f3e8ff',
      contrastText: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      muted: '#64748b',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    success: {
      main: '#10b981',
      light: '#d1fae5',
      dark: '#047857',
    },
    warning: {
      main: '#f59e0b',
      light: '#fef3c7',
      dark: '#b45309',
    },
    error: {
      main: '#ef4444',
      light: '#fee2e2',
      dark: '#b91c1c',
    },
    info: {
      main: '#3b82f6',
      light: '#dbeafe',
      dark: '#1d4ed8',
    }
  },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    }
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '8px 20px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          textTransform: 'none',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          }
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #3730a3 0%, #5b21b6 100%)',
            boxShadow: '0 6px 20px rgba(79, 70, 229, 0.3)',
          }
        }
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          transition: 'border-color 300ms ease, box-shadow 300ms ease',
          '& .MuiOutlinedInput-notchedOutline': {
            transition: 'border-color 300ms ease, border-width 300ms ease',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgb(200, 200, 200)',
          },
          '&.Mui-focused': {
            boxShadow: '0 0 0 3px rgba(150, 150, 200, 0.14)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgb(150, 150, 200)',
            borderWidth: '2px',
          }
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          transition: 'color 300ms ease, transform 300ms ease, background-color 300ms ease',
        },
        outlined: {
          '&.MuiInputLabel-shrink': {
            padding: '0 6px',
            borderRadius: 4,
            backgroundColor: '#fff',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          border: '1px solid rgba(15, 23, 42, 0.05)',
          boxShadow: '0 10px 30px -10px rgba(15, 23, 42, 0.04)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.08)',
            borderColor: 'rgba(79, 70, 229, 0.15)',
          }
        },
      },
    },
  },
});

export default theme;
