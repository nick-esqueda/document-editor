import { createApp } from "./app";
import { loadConfig, loadEnvFileIfPresent } from "./config";
import { createPool } from "./db/pool";

function startServer(): void {
  loadEnvFileIfPresent();
  const config = loadConfig();

  const pool = createPool(config.databaseUrl);
  const app = createApp({
    pool,
    sessionSecret: config.sessionSecret,
    isProduction: config.isProduction,
    clientDistDir: config.clientDistDir,
  });

  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });
}

startServer();
