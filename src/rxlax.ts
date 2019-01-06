import { from, Observable, ObservableInput } from "rxjs";

import { Queue } from "./Queue";

function buildDefaultQueue<T>(): Queue<T> {
  const store: T[] = [];

  return {
    async shift() {
      return store.shift();
    },
    async push(entry: T) {
      store.push(entry);
    },
    async clear() {
      store.splice(0, store.length);
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

export function rxlax<A, B>(
  concurrency: number,
  mapper: (entry: A) => ObservableInput<B>
) {
  // Ensure positive int number as concurrency
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error("Concurrency must be a positive integer");
  }

  // Ensure mapper type
  if (typeof mapper !== "function") {
    throw new Error("Mapper is not a function");
  }

  // Return the operator implemetation
  return (source: Observable<A>) => {
    return new Observable<Observable<B>>(subscriber => {
      // Build the execution queue
      const queue = buildDefaultQueue<A>();

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
          subscriber.error(errors);
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
      let hasEnd: boolean = false;

      // Start a new job util
      function jobStart(entry: A) {
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
              } else if (hasEnd === true && jobs <= 0) {
                cleanAndExit();
              }
            })
            .catch(pushError);
        }
      }

      // Start data flow
      return source.subscribe(
        entry => {
          // Keet firing jobs if there's no errors
          if (!hasErrors) {
            if (jobs >= concurrency) {
              queue.push(entry).catch(pushError);
            } else {
              jobStart(entry);
            }
          }
        },
        sourceError => {
          hasEnd = true;
          pushError(sourceError);
          if (jobs <= 0) {
            cleanAndExit();
          }
        },
        () => {
          hasEnd = true;
          if (jobs <= 0) {
            cleanAndExit();
          }
        }
      );
    });
  };
}
