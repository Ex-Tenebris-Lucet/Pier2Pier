const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Set this based on environment
const CURRENT_LOG_LEVEL = process.env.NODE_ENV === 'development' ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;

class Logger {
  static debug(...args) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  }

  static info(...args) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
      console.info('[INFO]', ...args);
    }
  }

  static warn(...args) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) {
      console.warn('[WARN]', ...args);
    }
  }

  static error(...args) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) {
      console.error('[ERROR]', ...args);
    }
  }
}

export default Logger; 