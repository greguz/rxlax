import { Queue } from "./Queue";

export interface Options<T> {
  concurrency?: number;
  queue?: () => Queue<T>;
}
