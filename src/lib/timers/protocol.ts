/** Message from the page to `timer.worker.ts`: start timer `id`, or cancel it when `ms < 0`. */
export interface TimerRequest {
  id: number
  ms: number
}

/** Message from the worker: timer `id` has fired. */
export interface TimerResponse {
  id: number
}
