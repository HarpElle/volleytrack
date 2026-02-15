/**
 * Lightweight logger that no-ops in production.
 * Replaces bare console.log/warn/error calls across the codebase.
 */

const isDev = __DEV__;

export const logger = {
    log: (...args: any[]) => { if (isDev) console.log(...args); },
    warn: (...args: any[]) => { if (isDev) console.warn(...args); },
    error: (...args: any[]) => { if (isDev) console.error(...args); },
    info: (...args: any[]) => { if (isDev) console.info(...args); },
};
