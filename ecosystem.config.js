module.exports = {
  apps: [
    {
      name: 'wedding-backend',
      cwd: './backend',
      script: 'npx',
      args: 'ts-node-dev --respawn --transpile-only src/index.ts',
      shell: true,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
        PORT: '4000',
      },
    },
    {
      name: 'wedding-frontend',
      cwd: './frontend',
      script: 'npx',
      args: 'next dev',
      shell: true,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
        PORT: '3000',
      },
    },
  ],
};
