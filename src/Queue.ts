export interface Queue<T> {
  shift: () => Promise<T | undefined>;
  push: (entry: T) => Promise<any>;
  clear: () => Promise<any>;
}
