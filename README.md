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

async function slowAsyncProcess(data) {
  // Process the input data, like a slow DB update
}

const results = await getBigAndFastFiringObservable()
  .pipe(rxlax(10, data => slowAsyncProcess(data)))
  .pipe(mergeAll())
  .pipe(toArray())
  .toPromise();
```
