import "mocha";
import { expect } from "chai";

import { from, Observable } from "rxjs";
import { mergeAll } from "rxjs/operators";
import { fill } from "lodash";

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

  it("should handle job errors", done => {
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
});
