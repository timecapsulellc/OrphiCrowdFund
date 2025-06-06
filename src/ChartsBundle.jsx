// ChartsBundle.jsx - Simple charts component for demo
import React from 'react';

const ChartsBundle = ({ 
  poolData = [], 
  recentRegistrations = [], 
  loading = false,
  systemStats = {},
  realtimeData = {}
}) => {
  if (loading) {
    return (
      <div className="charts-section">
        <div className="chart-skeleton shimmer" style={{ height: '300px', marginBottom: '2rem' }}>
          <div className="loading-text">Loading Charts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="charts-section">
      <div className="charts-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '2rem',
        margin: '2rem 0'
      }}>
        {/* Pool Distribution Chart */}
        <div className="chart-container" style={{
          background: 'var(--orphi-midnight-blue)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(0, 212, 255, 0.2)'
        }}>
          <h3 style={{ color: 'var(--orphi-cyber-blue)', marginBottom: '1rem' }}>
            Pool Distribution
          </h3>
          <div className="pool-distribution">
            {poolData.map((pool, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: pool.color || 'var(--orphi-cyber-blue)'
                  }}></div>
                  <span style={{ color: 'var(--orphi-silver-mist)' }}>{pool.name}</span>
                </div>
                <span style={{ color: 'var(--orphi-pure-white)', fontWeight: '600' }}>
                  {parseFloat(pool.value || 0).toFixed(2)} USDT
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Registration Activity Chart */}
        <div className="chart-container" style={{
          background: 'var(--orphi-midnight-blue)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(0, 212, 255, 0.2)'
        }}>
          <h3 style={{ color: 'var(--orphi-cyber-blue)', marginBottom: '1rem' }}>
            Recent Activity
          </h3>
          <div className="activity-chart">
            {recentRegistrations.slice(0, 5).map((reg, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <span style={{ color: 'var(--orphi-silver-mist)' }}>
                  {reg.time || 'Recent'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ 
                    color: 'var(--orphi-pure-white)', 
                    fontWeight: '600' 
                  }}>
                    {reg.count || 1} user(s)
                  </span>
                  <span style={{
                    background: 'var(--orphi-royal-purple)',
                    color: 'white',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem'
                  }}>
                    ${[30, 50, 100, 200][reg.packageTier - 1] || 'N/A'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartsBundle;
