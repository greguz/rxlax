import "mocha";
import { expect } from "chai";

import { from, Observable } from "rxjs";
import { mergeAll } from "rxjs/operators";
import { fill } from "lodash";

import { defaultQueue } from "./defaultQueue";
import { rxlax } from "./index";

describe("rxlax", () => {
  function wait(ms: number) {
    return function mapper<T>(data: T) {
      return new Promise<T>(resolve => {
        setTimeout(() => {
          resolve(data);
        }, ms);
      });
    };
  }

  it("should validate arguments", () => {
    expect(() => rxlax({} as any)).to.throw();

    expect(() => rxlax(wait(0), { concurrency: "0" as any })).to.throw();
    expect(() => rxlax(wait(0), { concurrency: 1.2 })).to.throw();
    expect(() => rxlax(wait(0), { concurrency: -1 })).to.throw();
    expect(() => rxlax(wait(0), { concurrency: 0 })).to.throw();
  });

  it("should work", async () => {
    const length = 100;
    const concurrency = 10;

    let calls = 0;
    let jobs = 0;

    await from(fill(new Array(length), "x"))
      .pipe(
        rxlax(
          data => {
            calls++;
            jobs++;
            return new Promise<string>((resolve, reject) => {
              if (jobs > concurrency) {
                return reject(new Error("nooo"));
              }
              setTimeout(() => {
                jobs--;
                resolve(data);
              }, 10);
            });
          },
          {
            concurrency
          }
        )
      )
      .pipe(mergeAll())
      .toPromise();

    expect(calls).to.be.equal(length);
  });

  it("should handle single job error", done => {
    from([0])
      .pipe(rxlax(data => Promise.reject(new Error("STOP"))))
      .pipe(mergeAll())
      .subscribe(
        undefined,
        error => {
          if (error instanceof Error && error.message === "STOP") {
            done();
          } else {
            done(error);
          }
        },
        () => {
          done(new Error("Done without errors"));
        }
      );
  });

  it("should handle multiple job errors", done => {
    from([0, 1, 2, 3, 4])
      .pipe(
        rxlax(data => Promise.reject(new Error("STOP")), { multiError: true })
      )
      .pipe(mergeAll())
      .subscribe(
        undefined,
        error => {
          if (Array.isArray(error.errors) && error.errors.length === 5) {
            done();
          } else {
            done(error);
          }
        },
        () => {
          done(new Error("Done without errors"));
        }
      );
  });

  it("should handle observable errors", done => {
    const observable = new Observable<string>(subscriber => {
      subscriber.next("a");
      subscriber.next("b");
      subscriber.next("c");
      subscriber.error(new Error("STOP"));
    });

    observable
      .pipe(rxlax(wait(10), { concurrency: 1 }))
      .pipe(mergeAll())
      .subscribe(
        undefined,
        error => {
          if (error instanceof Error && error.message === "STOP") {
            done();
          } else {
            done(error);
          }
        },
        () => {
          done(new Error("Done without errors"));
        }
      );
  });

  it("should work with empty observables", done => {
    const observable = new Observable<string>(subscriber => {
      subscriber.complete();
    });

    observable
      .pipe(rxlax(wait(10), { concurrency: 1 }))
      .pipe(mergeAll())
      .subscribe(undefined, done, done);
  });

  it("should work with empty observables", done => {
    const observable = new Observable<string>(subscriber => {
      subscriber.error(new Error("STOP"));
    });

    observable
      .pipe(rxlax(wait(10), { concurrency: 1 }))
      .pipe(mergeAll())
      .subscribe(
        undefined,
        error => {
          if (error instanceof Error && error.message === "STOP") {
            done();
          } else {
            done(error);
          }
        },
        () => {
          done(new Error("Done without errors"));
        }
      );
  });

  it("should handle queue.shift errors", done => {
    const queue = defaultQueue<any>();
    queue.shift = () => Promise.reject(new Error("STOP"));

    from(fill(new Array(100), "x"))
      .pipe(rxlax(wait(10), { queue: () => queue }))
      .pipe(mergeAll())
      .subscribe(
        undefined,
        error => {
          if (error instanceof Error && error.message === "STOP") {
            done();
          } else {
            done(error);
          }
        },
        () => {
          done(new Error("Done without errors"));
        }
      );
  });

  it("should handle queue.push errors", done => {
    const queue = defaultQueue<any>();
    queue.push = () => Promise.reject(new Error("STOP"));

    from(fill(new Array(100), "x"))
      .pipe(rxlax(wait(10), { queue: () => queue }))
      .pipe(mergeAll())
      .subscribe(
        undefined,
        error => {
          if (error instanceof Error && error.message === "STOP") {
            done();
          } else {
            done(error);
          }
        },
        () => {
          done(new Error("Done without errors"));
        }
      );
  });

  it("should handle queue.clear errors", done => {
    const queue = defaultQueue<any>();
    queue.clear = () => Promise.reject(new Error("STOP"));

    from(fill(new Array(100), "x"))
      .pipe(rxlax(wait(10), { queue: () => queue }))
      .pipe(mergeAll())
      .subscribe(
        undefined,
        error => {
          if (error instanceof Error && error.message === "STOP") {
            done();
          } else {
            done(error);
          }
        },
        () => {
          done(new Error("Done without errors"));
        }
      );
  });

  it("should handle multiple errors", done => {
    const queue = defaultQueue<any>();
    queue.shift = () => Promise.reject(new Error("Shift error"));
    queue.push = () => Promise.reject(new Error("Push error"));
    queue.clear = () => Promise.reject(new Error("Clear error"));

    from(fill(new Array(100), "x"))
      .pipe(rxlax(wait(10), { multiError: true, queue: () => queue }))
      .pipe(mergeAll())
      .subscribe(
        undefined,
        error => {
          if (Array.isArray(error.errors) && error.errors.length === 2) {
            done();
          } else {
            done(error);
          }
        },
        () => {
          done(new Error("Done without errors"));
        }
      );
  });

  it("should not start more jobs on errors", done => {
    const observable = new Observable(subscriber => {
      let i = 0;
      const timer = setInterval(() => {
        subscriber.next(i++);
        subscriber.next(i++);
        subscriber.next(i++);
        subscriber.next(i++);
        subscriber.next(i++);
      }, 10);
      return function unsubscribe() {
        clearInterval(timer);
      };
    });

    observable
      .pipe(
        rxlax(
          index =>
            new Promise((resolve, reject) => {
              setTimeout(() => {
                if (index === 2) {
                  reject(new Error("STOP"));
                } else {
                  resolve(index);
                }
              }, 20);
            })
        )
      )
      .pipe(mergeAll())
      .subscribe(
        undefined,
        error => {
          if (error instanceof Error && error.message === "STOP") {
            done();
          } else {
            done(error);
          }
        },
        () => {
          done(new Error("Done without errors"));
        }
      );
  });
});
