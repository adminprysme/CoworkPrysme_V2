import type { INestApplication } from "@nestjs/common";

export function configureCors(app: INestApplication, allowedOrigins: string[]): void {
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"), false);
    },
  });
}

export function getPort(): number {
  const port = Number(process.env.PORT ?? 8002);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid or missing environment configuration");
  }
  return port;
}
