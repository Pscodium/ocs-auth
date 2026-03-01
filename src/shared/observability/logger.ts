export type AppLogger = {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

export function getLogger(logger: unknown): AppLogger {
  return logger as AppLogger;
}
