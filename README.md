# rxlax

[![npm version](https://badge.fury.io/js/rxlax.svg)](https://badge.fury.io/js/rxlax) [![Build Status](https://travis-ci.com/greguz/rxlax.svg?branch=master)](https://travis-ci.com/greguz/rxlax) [![Coverage Status](https://coveralls.io/repos/github/greguz/rxlax/badge.svg?branch=master)](https://coveralls.io/github/greguz/rxlax?branch=master) [![Dependencies Status](https://david-dm.org/greguz/rxlax.svg)](https://david-dm.org/greguz/rxlax.svg)

Make Rx.js to relax a bit.

This lib is useful to handle the [backpressure](https://nodejs.org/en/docs/guides/backpressuring-in-streams/) problem with Rx.js.
While currently exist _other methods_ to handle this problem, I've found that these methods are not always suitable for all cases, or the resulting code is just too complicated to achieve the solution.
This lib try to solve this problematic with just a simple operator.

- Node.js & Browser support
- Rx.js 6.x
- Zero dependencies
- TypeScript support

Technically this operator map the source data into an observable of the resulting data, so you have to use another operator like [mergeAll](https://rxjs-dev.firebaseapp.com/api/operators/mergeAll) to retrieve the resulting data.

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

## Mapper

The first argument is a map function, that takes a stream element as argument and returns an [observable input](https://rxjs-dev.firebaseapp.com/api/index/type-alias/ObservableInput).
This is the **async** process that have to be limited according to the
speed of the data source.

## Options

The second argument are the options.

```typescript
interface Options<T> {
  concurrency?: number;
  queue?: () => Queue<T>;
}
```

### Concurrency

Number of concurrent jobs, default to [16](https://nodejs.org/api/stream.html#stream_constructor_new_stream_writable_options).

### Custom queue

By default, all queued data is saved in memory,
tecnically a simple array,
but if the data to precess is enormous,
or the processing time is very long,
it is recommend to use a custom queue to buffer the data.

```typescript
interface Queue<T> {
  shift: () => Promise<T | undefined>;
  push: (entry: T) => Promise<any>;
  clear: () => Promise<any>;
}
```

A custom queue have to implement 3 methods used internally by **rxlax**, all of them are **async**, so you can use any DB as queue storage.

#### shift(): Promise<T | undefined>

Removes the first element from the queue and returns that removed element.

#### push(entry: T): Promise<any>

Add one element to the end of the queue.

#### clear(): Promise<any>

Clear the queue. This method is always fired just before the end of the overall process.
