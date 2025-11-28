class StatsCollector {
  constructor() {
    this.stats = {
      startTime: Date.now(),
      connectedUsers: 0,
      totalConnections: 0,
      activeRooms: 0,
      totalRoomsCreated: 0,
      completedGames: 0
    };
  }

  // 접속자 증가
  incrementUsers() {
    this.stats.connectedUsers++;
    this.stats.totalConnections++;
  }

  // 접속자 감소
  decrementUsers() {
    this.stats.connectedUsers--;
  }

  // 방 생성
  createRoom() {
    this.stats.activeRooms++;
    this.stats.totalRoomsCreated++;
  }

  // 방 종료
  closeRoom() {
    this.stats.activeRooms--;
  }

  // 게임 완료
  completeGame() {
    this.stats.completedGames++;
  }

  // 현재 통계 가져오기
  getStats() {
    const memoryUsage = process.memoryUsage();
    const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);

    return {
      ...this.stats,
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024) // MB
      },
      uptime: uptime,
      uptimeFormatted: this.formatUptime(uptime)
    };
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  }
}

module.exports = new StatsCollector();
