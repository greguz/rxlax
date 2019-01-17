import { Queue } from "./Queue";

export interface Options<T> {
  /**
   * Max concurrent jobs running at the same time, default to 16
   */
  concurrency?: number;
  /**
   * Use a custom queue to buffer the data to be processed, default to memory buffer
   */
  queue?: () => Queue<T>;
  /**
   * Enable custom error when more errors are collected
   */
  multiError?: boolean;
}
