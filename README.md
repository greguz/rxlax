# rxlax

[![npm version](https://badge.fury.io/js/rxlax.svg)](https://badge.fury.io/js/rxlax) [![Dependencies Status](https://david-dm.org/greguz/rxlax.svg)](https://david-dm.org/greguz/rxlax.svg)

Make Rx.js to relax a bit.

This lib is useful to handle the [backpressure](https://nodejs.org/en/docs/guides/backpressuring-in-streams/) problem with Rx.js.

- Node.js >= 8.x
- Rx.js 6.x
- Zero dependencies
- TypeScript support

## Example

```javascript
const { mergeAll, toArray } = require("rxjs/operators");
const { rxlax } = require("rxlax");

function getBigAndFastFiringObservable() {
  // Return a fast-firing observable, like an array or a file read
}

function slowAsyncProcess(data) {
  // Process slowly the input data
  return new Promise(resolve => setTimeout(resolve, 1000));
}

const results = await getBigAndFastFiringObservable()
  // run max 10 times slowAsyncProcess() until end
  .pipe(rxlax(slowAsyncProcess, { concurrency: 10 }))
  .pipe(mergeAll())
  .pipe(toArray())
  .toPromise();
```
