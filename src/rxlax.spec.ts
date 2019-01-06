import "mocha";
import { expect } from "chai";

import { from } from "rxjs";
import { mergeAll } from "rxjs/operators";
import { fill } from "lodash";

import { rxlax } from "./index";

describe("rxlax", () => {
  it("should work", async () => {
    const length = 100;

    const concurrency = 10;

    let calls = 0;
    let jobs = 0;

    await from(fill(new Array(length), "x"))
      .pipe(
        rxlax(concurrency, data => {
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
        })
      )
      .pipe(mergeAll())
      .toPromise();

    expect(calls).to.be.equal(length);
  });
});
