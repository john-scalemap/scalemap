export class Logger {
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
  debug = jest.fn();
  child = jest.fn().mockReturnThis();
}

export const logger = new Logger();