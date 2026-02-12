import React from 'react';
import { useHistory } from 'react-router-dom';
import { usePolarisDataContext } from '../api/PolarisDataContext';
import { computeScore, countResults } from '../api/polaris';

/**
 * App bar badge showing cluster Polaris score
 * Clicking navigates to the overview dashboard
 */
export default function AppBarScoreBadge() {
  const { data, loading } = usePolarisDataContext();
  const history = useHistory();

  if (loading || !data) {
    return null; // Graceful degradation when Polaris unavailable
  }

  const counts = countResults(data);
  const score = computeScore(counts);

  // Color based on score
  const getColor = (score: number): string => {
    if (score >= 80) return '#4caf50'; // green
    if (score >= 50) return '#ff9800'; // orange
    return '#f44336'; // red
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
        color: 'white',
        fontSize: '13px',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
      aria-label={`Polaris cluster score: ${score}%`}
    >
      <span>🛡️</span>
      <span>Polaris: {score}%</span>
    </button>
  );
}
