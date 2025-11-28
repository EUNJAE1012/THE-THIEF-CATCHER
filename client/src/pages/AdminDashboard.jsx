import { useState, useEffect } from 'react';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin}/api/stats`);
        if (!response.ok) throw new Error('Failed to fetch stats');
        const data = await response.json();
        setStats(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 3000); // 3초마다 업데이트

    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="dashboard">Loading...</div>;
  if (error) return <div className="dashboard">Error: {error}</div>;

  return (
    <div className="dashboard">
      <h1>🎮 Server Monitoring Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <h2>👥 Users</h2>
          <div className="stat-value">{stats.connectedUsers}</div>
          <div className="stat-label">Connected Now</div>
          <div className="stat-sub">Total: {stats.totalConnections}</div>
        </div>

        <div className="stat-card">
          <h2>🚪 Rooms</h2>
          <div className="stat-value">{stats.activeRooms}</div>
          <div className="stat-label">Active Rooms</div>
          <div className="stat-sub">Total Created: {stats.totalRoomsCreated}</div>
        </div>

        <div className="stat-card">
          <h2>🎯 Games</h2>
          <div className="stat-value">{stats.completedGames}</div>
          <div className="stat-label">Completed Games</div>
        </div>

        <div className="stat-card">
          <h2>⏱️ Uptime</h2>
          <div className="stat-value-small">{stats.uptimeFormatted}</div>
        </div>
      </div>

      <div className="memory-section">
        <h2>💾 Memory Usage</h2>
        <div className="memory-grid">
          <div className="memory-item">
            <span className="memory-label">Heap Used:</span>
            <span className="memory-value">{stats.memory.heapUsed} MB</span>
          </div>
          <div className="memory-item">
            <span className="memory-label">Heap Total:</span>
            <span className="memory-value">{stats.memory.heapTotal} MB</span>
          </div>
          <div className="memory-item">
            <span className="memory-label">RSS:</span>
            <span className="memory-value">{stats.memory.rss} MB</span>
          </div>
          <div className="memory-item">
            <span className="memory-label">External:</span>
            <span className="memory-value">{stats.memory.external} MB</span>
          </div>
        </div>

        <div className="memory-bar">
          <div
            className="memory-bar-fill"
            style={{ width: `${(stats.memory.heapUsed / stats.memory.heapTotal) * 100}%` }}
          />
        </div>
        <div className="memory-percentage">
          {Math.round((stats.memory.heapUsed / stats.memory.heapTotal) * 100)}% of heap used
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
