# rxlax

[![npm version](https://badge.fury.io/js/rxlax.svg)](https://badge.fury.io/js/rxlax) [![Build Status](https://travis-ci.com/greguz/rxlax.svg?branch=master)](https://travis-ci.com/greguz/rxlax) [![Coverage Status](https://coveralls.io/repos/github/greguz/rxlax/badge.svg?branch=master)](https://coveralls.io/github/greguz/rxlax?branch=master) [![Dependencies Status](https://david-dm.org/greguz/rxlax.svg)](https://david-dm.org/greguz/rxlax.svg)

Make Rx.js to relax a bit.

This lib is useful to handle the [backpressure](https://nodejs.org/en/docs/guides/backpressuring-in-streams/) problem with Rx.js.
Currently there are _other methods_ to handle this problem,
but I've found that these methods are not always suitable for all cases,
or the resulting code is just too complicated to achieve a simple solution.
This lib try to solve this problematic with just a single operator.

- Node.js & Browser support
- Rx.js 6.x
- Zero dependencies
- TypeScript support

Technically this operator map the source data to observable of resulting data, so you have to use another operator like [mergeAll](https://rxjs-dev.firebaseapp.com/api/operators/mergeAll) to retrieve the resulting data, or in other words convert a higher-order Observable into a first-order Observable.

## Example

```javascript
const { mergeAll, toArray } = require("rxjs/operators");
const { rxlax } = require("rxlax");

function getBigAndFastFiringObservable() {
  // Return a fast-firing observable, like an array or a file read
}

async function slowAsyncProcess(data) {
  await doSomethingCool(data);
  return {
    ts: new Date(),
    id: data.id
  };
}

const results = await getBigAndFastFiringObservable()
  .pipe(rxlax(slowAsyncProcess, { concurrency: 10 }))
  .pipe(mergeAll())
  .pipe(toArray())
  .toPromise();
```

## Mapper

The first argument is a map function,
that takes a stream element as argument and returns an [observable input](https://rxjs-dev.firebaseapp.com/api/index/type-alias/ObservableInput).
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

A custom queue have to implement 3 methods used internally by **rxlax**,
all of them are **async**, so you can use any DB as queue storage.

#### push(entry: T): Promise<any>

Add one element to the end of the queue.

#### shift(): Promise<T | undefined>

Removes the first element from the queue and returns that removed element.

#### clear(): Promise<any>

Clear the queue. This method is always fired just before the end of the overall process.

### Returns all errors

If the option **multiError** is true, and more than one error are collected,
the resulting error will be a custom instance whit an _errors_ property.
