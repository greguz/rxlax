import { Queue } from "./Queue";

export function defaultQueue<T>(): Queue<T> {
  const store: T[] = [];

  function clear() {
    store.splice(0, store.length);
    return Promise.resolve();
  }

  function push(entry: T) {
    store.push(entry);
    return Promise.resolve();
  }

  function shift() {
    return Promise.resolve(store.shift());
  }

  return {
    clear,
    push,
    shift
  };
}
