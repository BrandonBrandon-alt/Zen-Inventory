const path = require('node:path');

// El puerto del backend se comparte con el resto del monorepo vía ../.env.
try {
  process.loadEnvFile(path.resolve(__dirname, '../.env'));
} catch {
  // Sin .env: se usa el puerto por defecto.
}

const port = process.env['SPRING_LOCAL_PORT'] || '8080';

module.exports = {
  '/api': {
    target: `http://localhost:${port}`,
    secure: false,
    changeOrigin: true,
  },
};
