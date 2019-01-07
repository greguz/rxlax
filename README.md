# rxlax

[![npm version](https://badge.fury.io/js/rxlax.svg)](https://badge.fury.io/js/rxlax) [![Build Status](https://travis-ci.com/greguz/rxlax.svg?branch=master)](https://travis-ci.com/greguz/rxlax) [![Coverage Status](https://coveralls.io/repos/github/greguz/rxlax/badge.svg?branch=master)](https://coveralls.io/github/greguz/rxlax?branch=master) [![Dependencies Status](https://david-dm.org/greguz/rxlax.svg)](https://david-dm.org/greguz/rxlax.svg)

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
  const start = new Date();
  await doSomethingCool(data);
  const end = new Date();

  return {
    data,
    start,
    end
  };
}

const results = await getBigAndFastFiringObservable()
  .pipe(rxlax(slowAsyncProcess, { concurrency: 10 }))
  .pipe(mergeAll())
  .pipe(toArray())
  .toPromise();
```

## Options

The second argument of **rxlax** is the options.

```typescript
interface Options<T> {
  concurrency?: number;
  queue?: () => Queue<T>;
}
```

### Concurrency

Number of concurrent jobs.

### Custom queue

By default, all queued data is saved in memory,
tecnically a simple array,
but if the processed data is enormous,
or the processing time is very long,
it is recommend to use a custom queue to buffer the data to be processed.

```typescript
interface Queue<T> {
  shift: () => Promise<T | undefined>;
  push: (entry: T) => Promise<any>;
  clear: () => Promise<any>;
}
```

A custom queue have to implement 3 methods used internally by **rxlax**, all of them are **async**, so you can use any DB as queue storage.

#### shift(): Promise<T | undefined>

Removes from the queue and return the first queued element, _undefined_ if no elements are present.

#### push(entry: T): Promise<any>

Save a new element into the queue.

#### clear(): Promise<any>

Clear the queue. This method is fired when the process throw for any reason.
