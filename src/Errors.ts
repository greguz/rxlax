export class Errors extends Error {
  public errors: any[];

  constructor(errors: any[]) {
    super("Multiple errors detected");
    this.errors = errors;
    Error.captureStackTrace(this, Errors);
  }
}
