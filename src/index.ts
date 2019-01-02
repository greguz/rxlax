import { from, Observable, ObservableInput } from "rxjs";

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
    throw new Error();
  }

  // Return the operator implemetation
  return (source: Observable<A>) => {
    return new Observable<Observable<B>>(subscriber => {
      // Currently active jobs count
      let jobs: number = 0;

      // Queued entries
      let queue: A[] = [];

      // True when the source has finished
      let end: boolean = false;

      // Map the entry from the source observable
      //  into another observable and listen for its finish,
      //  then notify the resulting observable
      function jobStart(entry: A) {
        jobs++;
        subscriber.next(from(mapper(entry)).pipe(onEnd(jobEnd)));
      }

      // Called when a created job/observable has finisched,
      //  just try to run another job
      function jobEnd() {
        jobs--;
        unqueue();
      }

      // Try to run the next job and handle the observable end
      function unqueue() {
        if (jobs < concurrency && queue.length > 0) {
          jobStart(queue.shift() as A);
        } else if (jobs <= 0 && queue.length <= 0 && end === true) {
          subscriber.complete();
        }
      }

      // Start data flow
      return source.subscribe(
        entry => {
          if (jobs >= concurrency) {
            queue.push(entry);
          } else {
            jobStart(entry);
          }
        },
        err => {
          // Clear the queue to stop the data flow
          queue = [];
          // Flag the end of source stream
          end = true;
          // Notify now the error (not sure, maybe we should wait the current jobs to end?)
          subscriber.error(err);
        },
        () => {
          // Flag the end of source stream
          end = true;
          // Handle empty source stream
          unqueue();
        }
      );
    });
  };
}
