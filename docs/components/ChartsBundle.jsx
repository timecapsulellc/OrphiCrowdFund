// ChartsBundle.jsx - Code-split charts component
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

const ORPHI_COLORS = {
  primary: '#00D4FF',      // Cyber Blue
  secondary: '#7B2CBF',    // Royal Purple
  accent: '#FF6B35',       // Energy Orange
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.7)'
};

const ChartsBundle = ({ 
  poolData, 
  recentRegistrations, 
  loading,
  systemStats,
  realtimeData 
}) => {
  return (
    <div className="charts-section">
      <div className="chart-container">
        <div className="chart-header">
          <h3>Pool Balances Distribution</h3>
          <div className="chart-legend">
            {poolData.map((entry, index) => (
              <div key={index} className="legend-item">
                <div className="legend-color" style={{ backgroundColor: entry.color }}></div>
                <span className="legend-label">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="chart-skeleton shimmer" aria-hidden="true"></div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={poolData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${parseFloat(value).toFixed(2)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                stroke="none"
                isAnimationActive={true}
                animationDuration={900}
              >
                {poolData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => [parseFloat(value).toFixed(4), "USDT"]}
                contentStyle={{
                  backgroundColor: 'rgba(10, 10, 10, 0.9)',
                  border: '1px solid var(--orphi-cyber-blue)',
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-container">
        <div className="chart-header">
          <h3>Recent Registration Activity</h3>
          <div className="activity-stats">
            <span className="stat-item">
              <span className="stat-value">{realtimeData.registrations.length}</span>
              <span className="stat-label">Recent</span>
            </span>
          </div>
        </div>
        {loading ? (
          <div className="chart-skeleton shimmer" aria-hidden="true"></div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={recentRegistrations} isAnimationActive={true} animationDuration={900}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis 
                dataKey="time" 
                tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.3)' }}
              />
              <YAxis 
                tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.3)' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(10, 10, 10, 0.9)',
                  border: '1px solid var(--orphi-cyber-blue)',
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
              <Bar dataKey="count" fill={ORPHI_COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default ChartsBundle;
