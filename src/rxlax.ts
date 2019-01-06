import { from, Observable, ObservableInput } from "rxjs";
import * as os from "os";

import { defaultQueue } from "./defaultQueue";
import { Errors } from "./Errors";
import { Options } from "./Options";

function onEnd<T>(callback: (err?: any) => void) {
  return function operator(source: Observable<T>) {
    return new Observable<T>(subscriber => {
      source.subscribe(
        entry => {
          subscriber.next(entry);
        },
        err => {
          subscriber.error(err);
          callback(err);
        },
        () => {
          subscriber.complete();
          callback();
        }
      );
    });
  };
}

function defaultConcurrency() {
  const cpus = os.cpus().length;
  return cpus > 1 ? cpus - 1 : cpus;
}

/**
 * Make Rx.js to relax a bit
 */
export function rxlax<S, T>(
  mapper: (entry: S) => ObservableInput<T>,
  options: Options<S> = {}
) {
  // Ensure mapper type
  if (typeof mapper !== "function") {
    throw new Error("Mapper is not a function");
  }

  // Get configured concurrency
  const concurrency =
    options.concurrency !== undefined
      ? options.concurrency
      : defaultConcurrency();

  // Ensure positive int number as concurrency
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error("Concurrency must be a positive integer");
  }

  // Return the operator implemetation
  return (source: Observable<S>) => {
    return new Observable<Observable<T>>(subscriber => {
      // Build the execution queue
      const queue = options.queue ? options.queue() : defaultQueue<S>();

      // All collected errors during this execution
      const errors: any[] = [];

      // True when the errors array has entries
      let hasErrors = false;

      // Push error util
      function pushError(error: any) {
        if (error !== undefined) {
          errors.push(error);
        }
        hasErrors = errors.length > 0;
      }

      // Exit utility (final callback)
      function exit() {
        if (errors.length <= 0) {
          subscriber.complete();
        } else if (errors.length === 1) {
          subscriber.error(errors[0]);
        } else {
          subscriber.error(new Errors(errors));
        }
      }

      // End this execution and perform clean steps
      function cleanAndExit() {
        if (hasErrors) {
          queue
            .clear()
            .catch(pushError)
            .then(exit);
        } else {
          exit();
        }
      }

      // Currently active jobs count
      let jobs: number = 0;

      // True when the source has finished
      let hasEnded: boolean = false;

      // Start a new job util
      function jobStart(entry: S) {
        jobs++;
        subscriber.next(from(mapper(entry)).pipe(onEnd(jobEnd)));
      }

      // Job end callback
      function jobEnd(jobError?: any) {
        jobs--;

        // Handle possible error
        pushError(jobError);

        // Try to run another job if no errors
        if (hasErrors) {
          if (jobs <= 0) {
            cleanAndExit();
          }
        } else {
          queue
            .shift()
            .then(entry => {
              if (entry !== undefined) {
                jobStart(entry);
              } else if (hasEnded && jobs <= 0) {
                cleanAndExit();
              }
            })
            .catch(queueError => {
              pushError(queueError);
              if (jobs <= 0) {
                cleanAndExit();
              }
            });
        }
      }

      // Start data flow
      return source.subscribe(
        entry => {
          // Keep firing jobs if there's no errors
          if (!hasErrors) {
            if (jobs >= concurrency) {
              queue.push(entry).catch(pushError);
            } else {
              jobStart(entry);
            }
          }
        },
        sourceError => {
          hasEnded = true;
          pushError(sourceError);
          if (jobs <= 0) {
            cleanAndExit();
          }
        },
        () => {
          hasEnded = true;
          if (jobs <= 0) {
            cleanAndExit();
          }
        }
      );
    });
  };
}
