import { Queue } from "./Queue";

export function defaultQueue<T>(): Queue<T> {
  const store: T[] = [];

  return {
    async shift() {
      return store.shift();
    },
    async push(entry: T) {
      store.push(entry);
    },
    async clear() {
      store.splice(0, store.length);
    }
  };
}
