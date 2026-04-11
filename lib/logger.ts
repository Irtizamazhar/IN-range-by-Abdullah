import winston from "winston";

/**
 * Server-only structured logging. Do not log passwords, tokens, or full card data.
 * Use in Route Handlers / Server Actions only (not Edge).
 */
export const serverLogger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "inrange-by-abdullah" },
  transports: [new winston.transports.Console()],
});
