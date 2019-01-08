import { from, Observable, ObservableInput } from "rxjs";

import { defaultQueue } from "./defaultQueue";
import { Errors } from "./Errors";
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

      // Push error util
      function pushError(error: any) {
        if (error !== undefined) {
          errors.push(error);
        }
        hasErrors = errors.length > 0;
      }

      // Ensure single error for queue#shift and queue#push methods
      const onShiftError = once(pushError);
      const onPushError = once(pushError);

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

      // Try to end this execution and perform clean steps
      function tryToExit() {
        if (jobs <= 0 && (hasErrors || hasEnded)) {
          if (hasErrors) {
            queue
              .clear()
              .catch(pushError)
              .then(exit);
          } else {
            exit();
          }
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
          pushError(sourceError);
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
