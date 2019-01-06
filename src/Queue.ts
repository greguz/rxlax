export interface Queue<T> {
  shift: () => Promise<T | undefined>;
  push: (entry: T) => Promise<void>;
  clear: () => Promise<void>;
}
