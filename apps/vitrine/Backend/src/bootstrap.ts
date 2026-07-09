export function configureCors(
  app: {
    enableCors: (options: {
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => void;
    }) => void;
  },
  allowedOrigins: string[],
) {
  app.enableCors({
    origin: (origin, callback) => {
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

export function getListenHost(): string | undefined {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }
  return "0.0.0.0";
}
