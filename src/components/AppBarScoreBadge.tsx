import { useTheme } from '@mui/material/styles';
import React from 'react';
import { useHistory } from 'react-router-dom';
import { computeScore, countResults } from '../api/polaris';
import { usePolarisDataContext } from '../api/PolarisDataContext';

/**
 * App bar badge showing cluster Polaris score
 * Clicking navigates to the overview dashboard
 */
export default function AppBarScoreBadge() {
  const theme = useTheme();
  const { data, loading } = usePolarisDataContext();
  const history = useHistory();

  if (loading || !data) {
    return null; // Graceful degradation when Polaris unavailable
  }

  const counts = countResults(data);
  const score = computeScore(counts);

  // Color based on score using theme palette
  const getColor = (s: number): string => {
    if (s >= 80) return theme.palette.success.main;
    if (s >= 50) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const getContrastColor = (s: number): string => {
    if (s >= 80) return theme.palette.success.contrastText;
    if (s >= 50) return theme.palette.warning.contrastText;
    return theme.palette.error.contrastText;
  };

  const handleClick = () => {
    history.push('/polaris');
  };

  return (
    <button
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        marginRight: '8px',
        padding: '4px 12px',
        borderRadius: '16px',
        border: 'none',
        backgroundColor: getColor(score),
        color: getContrastColor(score),
        fontSize: '13px',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
      aria-label={`Polaris cluster score: ${score}%`}
    >
      <span>Polaris: {score}%</span>
    </button>
  );
}
