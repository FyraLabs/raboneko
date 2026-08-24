declare module "cat-loggr" {
  export default class CatLoggr {
    constructor();
    log(...args: unknown[]): unknown;
    info(...args: unknown[]): unknown;
    warn(...args: unknown[]): unknown;
    error(...args: unknown[]): unknown;
    setLevel(level: string): this;
  }
}
