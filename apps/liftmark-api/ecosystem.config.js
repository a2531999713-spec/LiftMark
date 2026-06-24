module.exports = {
  apps: [
    {
      name: 'liftmark-api',
      cwd: '/home/deploy/liftmark/apps/liftmark-api',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3000',
      },
      error_file: '/home/deploy/liftmark/logs/liftmark-api.err.log',
      out_file: '/home/deploy/liftmark/logs/liftmark-api.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};

