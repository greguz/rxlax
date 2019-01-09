import { Queue } from "./Queue";

export function defaultQueue<T>(): Queue<T> {
  const store: T[] = [];

  function shift() {
    return Promise.resolve(store.shift());
  }

  function push(entry: T) {
    store.push(entry);
    return Promise.resolve();
  }

  function clear() {
    store.splice(0, store.length);
    return Promise.resolve();
  }

  return {
    shift,
    push,
    clear
  };
}
