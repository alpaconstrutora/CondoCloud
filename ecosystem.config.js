module.exports = {
  apps: [
    {
      name: 'condocloud-api',
      cwd: './apps/api',
      script: './node_modules/@nestjs/cli/bin/nest.js',
      args: 'start --watch',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
        PORT: '3001',
      },
    },
  ],
};
