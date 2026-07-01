export async function register() {
  const { initVitrineWebEnv } = await import("@coworkprysme/shared/vitrine-web");
  initVitrineWebEnv();
}
