import { randomBytes, randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const secret = (bytes = 32) => randomBytes(bytes).toString("base64url");

const postgresAdminPassword = secret();
const postgresMigratorPassword = secret();
const postgresAppPassword = secret();
const redisPassword = secret();

const values = {
  NODE_ENV: "production",
  PORT: "3000",
  TOKEN_SECRET: secret(48),
  TOKEN_REFRESH_SECRET: secret(48),
  TOKEN_EXPIRES_TIME: "300",
  TOKEN_REFRESH_EXPIRES_TIME: "259200",
  SSO_COUNT: "3",
  SWAGGER: "false",
  HELMET: "true",
  STATIC_FILE_ROOT_PATH: "public",
  STATIC_FILE_SERVE_ROOT: "api/public",
  SEED_ADMIN_USERNAME: "xzz2021",
  SEED_ADMIN_PASSWORD: secret(24),
  SEED_ADMIN_PHONE: `139${randomInt(10_000_000, 100_000_000)}`,
  POSTGRES_DB: "app",
  POSTGRES_ADMIN_USER: "postgres",
  POSTGRES_ADMIN_PASSWORD: postgresAdminPassword,
  POSTGRES_MIGRATOR_USER: "app_migrator",
  POSTGRES_MIGRATOR_PASSWORD: postgresMigratorPassword,
  POSTGRES_APP_USER: "app_runtime",
  POSTGRES_APP_PASSWORD: postgresAppPassword,
  PG_DATABASE_URL: `postgresql://app_migrator:${encodeURIComponent(postgresMigratorPassword)}@postgres:5432/app`,
  APP_DATABASE_URL: `postgresql://app_runtime:${encodeURIComponent(postgresAppPassword)}@postgres:5432/app`,
  REDIS_HOST: "redis",
  REDIS_PORT: "6379",
  REDIS_PASSWORD: redisPassword,
};

const output = `${Object.entries(values)
  .map(([key, value]) => `${key}=${value}`)
  .join("\n")}\n`;
const outputPath = resolve(process.cwd(), ".env.generated");

writeFileSync(outputPath, output, {
  encoding: "utf8",
  mode: 0o600,
  flag: "wx",
});
console.log(
  `Generated ${outputPath}. Review it, migrate existing services, then replace .env.`,
);
