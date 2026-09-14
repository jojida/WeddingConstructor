module.exports = {
  apps: [
    {
      name: 'wedding-api',
      cwd: './backend',
      script: 'dist/index.js',
      shell: true,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
      },
    },
    {
      name: 'wedding-frontend',
      cwd: './frontend',
      script: 'npx',
      args: 'next start',
      shell: true,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
};
