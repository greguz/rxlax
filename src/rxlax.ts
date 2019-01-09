import { from, Observable, ObservableInput } from "rxjs";

import { defaultQueue } from "./defaultQueue";
import { Options } from "./Options";

function once(fn: (error?: any) => void): (error?: any) => void {
  let called = false;
  return (error?: any) => {
    if (!called) {
      called = true;
      fn(error);
    }
  };
}

function buildMultiError(errors: any[]) {
  const error: any = new Error("Multiple errors detected");
  error.errors = errors;
  return error;
}

/**
 * Swallow errors and call the callback (async) at the end
 */
function onEnd<T>(callback: (err?: any) => void) {
  return function operator(source: Observable<T>) {
    return new Observable<T>(subscriber => {
      source.subscribe(
        entry => {
          subscriber.next(entry);
        },
        err => {
          subscriber.complete();
          setImmediate(callback, err);
        },
        () => {
          subscriber.complete();
          setImmediate(callback);
        }
      );
    });
  };
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
    options.concurrency === undefined ? 16 : options.concurrency;

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

      // Currently active jobs count
      let jobs: number = 0;

      // True when the source has finished
      let hasEnded: boolean = false;

      // Push error util
      function handleError(error: any) {
        if (error !== undefined) {
          errors.push(error);
        }
        hasErrors = errors.length > 0;
      }

      // Ensure single error for queue#shift and queue#push methods
      const onShiftError = once(handleError);
      const onPushError = once(handleError);

      // Exit utility (final callback)
      function exit() {
        if (errors.length <= 0) {
          subscriber.complete();
        } else if (errors.length === 1) {
          subscriber.error(errors[0]);
        } else {
          subscriber.error(buildMultiError(errors));
        }
      }

      // Perform clean step and exit (also ensure single call)
      const cleanAndExit = once(() => {
        queue
          .clear()
          .catch(handleError)
          .then(exit);
      });

      // Try to end this execution and perform clean steps
      function tryToExit() {
        if (jobs <= 0 && (hasErrors || hasEnded)) {
          cleanAndExit();
        }
      }

      // Start a new job util
      function jobStart(entry: S) {
        jobs++;
        subscriber.next(from(mapper(entry)).pipe(onEnd(jobEnd)));
      }

      // Job end callback
      function jobEnd(jobError?: any) {
        jobs--;

        // Handle possible error
        handleError(jobError);

        // Try to run another job if no errors
        if (hasErrors) {
          tryToExit();
        } else {
          queue
            .shift()
            .then(entry => {
              if (entry !== undefined) {
                jobStart(entry);
              }
            })
            .catch(onShiftError)
            .then(tryToExit);
        }
      }

      // Start data flow
      return source.subscribe(
        entry => {
          // Keep firing jobs if there's no errors
          if (!hasErrors) {
            if (jobs >= concurrency) {
              queue.push(entry).catch(onPushError);
            } else {
              jobStart(entry);
            }
          }
        },
        sourceError => {
          hasEnded = true;
          handleError(sourceError);
          tryToExit();
        },
        () => {
          hasEnded = true;
          tryToExit();
        }
      );
    });
  };
}
