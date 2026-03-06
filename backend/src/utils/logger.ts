function timestamp(): string {
  return new Date().toISOString();
}

export const log = {
  info(...args: any[]) {
    console.log(`[${timestamp()}]`, ...args);
  },
  warn(...args: any[]) {
    console.warn(`[${timestamp()}]`, ...args);
  },
  error(...args: any[]) {
    console.error(`[${timestamp()}]`, ...args);
  },
};
