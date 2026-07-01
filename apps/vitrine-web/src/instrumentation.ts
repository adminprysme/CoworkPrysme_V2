export async function register() {
  const { initServerEnv } = await import("@coworkprysme/shared/server");
  initServerEnv();
}
