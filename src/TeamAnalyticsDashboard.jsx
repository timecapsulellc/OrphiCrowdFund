import React from 'react';
import './OrphiChain.css';

const TeamAnalyticsDashboard = ({ demoMode = false }) => {
  // Demo data
  const teamMetrics = {
    totalMembers: 2458,
    activeMembers: 1825,
    totalEarnings: 1245890,
    averageEarnings: 507
  };
  
  const performanceData = [
    { rank: 1, name: 'Alpha Team', members: 456, earnings: 245680, growth: 18.5 },
    { rank: 2, name: 'Genesis Group', members: 389, earnings: 198450, growth: 12.3 },
    { rank: 3, name: 'Stellar Network', members: 325, earnings: 167890, growth: 15.7 },
    { rank: 4, name: 'Quantum Partners', members: 301, earnings: 152360, growth: 9.8 },
    { rank: 5, name: 'Phoenix Team', members: 287, earnings: 138750, growth: 14.2 }
  ];
  
  const recentActivities = [
    { id: 1, team: 'Alpha Team', action: 'New Member', details: 'John D. joined', time: '10 minutes ago' },
    { id: 2, team: 'Genesis Group', action: 'Commission Paid', details: '$12,450 distributed', time: '1 hour ago' },
    { id: 3, team: 'Stellar Network', action: 'Level Up', details: 'Reached Diamond tier', time: '3 hours ago' },
    { id: 4, team: 'Phoenix Team', action: 'New Member', details: 'Sarah M. joined', time: '5 hours ago' }
  ];
  
  const monthlyGrowth = [
    { month: 'Jan', value: 25 },
    { month: 'Feb', value: 38 },
    { month: 'Mar', value: 45 },
    { month: 'Apr', value: 52 },
    { month: 'May', value: 68 },
    { month: 'Jun', value: 75 }
  ];
  
  return (
    <div className="team-analytics-dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Team Analytics Dashboard</h2>
        {demoMode && <span className="demo-badge">Demo Mode</span>}
      </div>
      
      <div className="metrics-overview">
        <div className="metric-card">
          <h3>Total Team Members</h3>
          <div className="metric-value">{teamMetrics.totalMembers.toLocaleString()}</div>
          <div className="metric-icon members-icon"></div>
        </div>
        
        <div className="metric-card">
          <h3>Active Members</h3>
          <div className="metric-value">{teamMetrics.activeMembers.toLocaleString()}</div>
          <div className="metric-info">({Math.round(teamMetrics.activeMembers / teamMetrics.totalMembers * 100)}% active)</div>
        </div>
        
        <div className="metric-card">
          <h3>Total Earnings</h3>
          <div className="metric-value">${teamMetrics.totalEarnings.toLocaleString()}</div>
          <div className="metric-icon earnings-icon"></div>
        </div>
        
        <div className="metric-card">
          <h3>Average Per Member</h3>
          <div className="metric-value">${teamMetrics.averageEarnings.toLocaleString()}</div>
        </div>
      </div>
      
      <div className="dashboard-grid">
        <div className="team-performance-card">
          <h3>Top Performing Teams</h3>
          <table className="performance-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team Name</th>
                <th>Members</th>
                <th>Earnings</th>
                <th>Growth</th>
              </tr>
            </thead>
            <tbody>
              {performanceData.map(team => (
                <tr key={team.rank}>
                  <td className="rank">{team.rank}</td>
                  <td className="team-name">{team.name}</td>
                  <td>{team.members}</td>
                  <td>${team.earnings.toLocaleString()}</td>
                  <td className="growth positive">+{team.growth}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="growth-chart-card">
          <h3>Monthly Growth Trend</h3>
          <div className="chart-container">
            <div className="chart-bars">
              {monthlyGrowth.map(item => (
                <div key={item.month} className="chart-bar-item">
                  <div 
                    className="chart-bar" 
                    style={{ height: `${item.value}%` }}
                    title={`${item.month}: ${item.value}% growth`}
                  ></div>
                  <div className="chart-label">{item.month}</div>
                </div>
              ))}
            </div>
            <div className="chart-y-axis">
              <div>100%</div>
              <div>75%</div>
              <div>50%</div>
              <div>25%</div>
              <div>0%</div>
            </div>
          </div>
        </div>
        
        <div className="recent-activity-card">
          <h3>Recent Team Activities</h3>
          <div className="activity-list">
            {recentActivities.map(activity => (
              <div key={activity.id} className="activity-item">
                <div className="activity-content">
                  <div className="activity-header">
                    <span className="team-name">{activity.team}</span>
                    <span className="activity-time">{activity.time}</span>
                  </div>
                  <div className="activity-details">
                    <span className="activity-action">{activity.action}:</span>
                    <span className="activity-info">{activity.details}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .team-analytics-dashboard {
          background-color: #f8f9fa;
          padding: 1.5rem;
          color: #333;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        
        .dashboard-title {
          color: var(--orphi-royal-purple);
          margin: 0;
        }
        
        .demo-badge {
          background-color: var(--orphi-energy-orange);
          color: white;
          padding: 0.3rem 0.7rem;
          border-radius: 1rem;
          font-size: 0.8rem;
          font-weight: bold;
        }
        
        .metrics-overview {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .metric-card {
          background-color: white;
          border-radius: 0.5rem;
          padding: 1.2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          position: relative;
          overflow: hidden;
        }
        
        .metric-card h3 {
          margin: 0 0 0.5rem 0;
          font-size: 0.9rem;
          color: #666;
        }
        
        .metric-value {
          font-size: 1.8rem;
          font-weight: bold;
          color: var(--orphi-royal-purple);
        }
        
        .metric-info {
          font-size: 0.8rem;
          color: #666;
          margin-top: 0.3rem;
        }
        
        .metric-icon {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background-color: rgba(123, 44, 191, 0.1);
        }
        
        .dashboard-grid {
          display: grid;
          grid-template-columns: 3fr 2fr;
          grid-template-rows: auto 1fr;
          gap: 1.5rem;
        }
        
        .team-performance-card {
          grid-column: 1;
          grid-row: 1 / 3;
          background-color: white;
          border-radius: 0.5rem;
          padding: 1.2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .team-performance-card h3 {
          margin: 0 0 1rem 0;
          color: var(--orphi-royal-purple);
        }
        
        .performance-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .performance-table th {
          text-align: left;
          padding: 0.8rem;
          border-bottom: 2px solid #eee;
          color: #666;
          font-weight: 600;
        }
        
        .performance-table td {
          padding: 0.8rem;
          border-bottom: 1px solid #eee;
        }
        
        .rank {
          font-weight: bold;
          color: var(--orphi-royal-purple);
        }
        
        .team-name {
          font-weight: 500;
        }
        
        .growth {
          font-weight: 500;
        }
        
        .growth.positive {
          color: var(--orphi-success-green);
        }
        
        .growth-chart-card {
          grid-column: 2;
          grid-row: 1;
          background-color: white;
          border-radius: 0.5rem;
          padding: 1.2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .growth-chart-card h3 {
          margin: 0 0 1rem 0;
          color: var(--orphi-royal-purple);
        }
        
        .chart-container {
          display: flex;
          height: 200px;
          position: relative;
        }
        
        .chart-y-axis {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding-right: 0.5rem;
          color: #999;
          font-size: 0.7rem;
        }
        
        .chart-bars {
          display: flex;
          justify-content: space-around;
          align-items: flex-end;
          flex-grow: 1;
          height: 100%;
          padding-bottom: 1.5rem;
          position: relative;
        }
        
        .chart-bars::after {
          content: '';
          position: absolute;
          bottom: 1.5rem;
          left: 0;
          right: 0;
          height: 1px;
          background-color: #ddd;
        }
        
        .chart-bar-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }
        
        .chart-bar {
          width: 1.5rem;
          background: linear-gradient(to top, var(--orphi-royal-purple), var(--orphi-cyber-blue));
          border-radius: 3px 3px 0 0;
          margin-bottom: 0.3rem;
        }
        
        .chart-label {
          font-size: 0.7rem;
          color: #666;
        }
        
        .recent-activity-card {
          grid-column: 2;
          grid-row: 2;
          background-color: white;
          border-radius: 0.5rem;
          padding: 1.2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .recent-activity-card h3 {
          margin: 0 0 1rem 0;
          color: var(--orphi-royal-purple);
        }
        
        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .activity-item {
          padding: 0.7rem;
          border-radius: 0.3rem;
          background-color: #f8f9fa;
        }
        
        .activity-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.3rem;
        }
        
        .activity-time {
          font-size: 0.7rem;
          color: #999;
        }
        
        .activity-details {
          font-size: 0.85rem;
        }
        
        .activity-action {
          font-weight: 500;
          color: var(--orphi-royal-purple);
          margin-right: 0.3rem;
        }
        
        .activity-info {
          color: #666;
        }
        
        @media (max-width: 992px) {
          .metrics-overview {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .dashboard-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto auto;
          }
          
          .team-performance-card, .growth-chart-card, .recent-activity-card {
            grid-column: 1;
          }
          
          .team-performance-card {
            grid-row: 1;
          }
          
          .growth-chart-card {
            grid-row: 2;
          }
          
          .recent-activity-card {
            grid-row: 3;
          }
        }
        
        @media (max-width: 576px) {
          .metrics-overview {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default TeamAnalyticsDashboard;
