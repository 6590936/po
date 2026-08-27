module.exports = {
  apps: [
    {
      name: 'meiou-crm',
      script: 'server/index.js',
      args: [],
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // 如果需要，PM2 会在重启后保持旧的日志与错误输出
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
