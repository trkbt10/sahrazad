/**
 * @file Minimal ambient typing for optional '@xenova/transformers'.
 */
declare module '@xenova/transformers' {
  export function pipeline(task: string, model: string, options?: Record<string, unknown>): Promise<
    (text: string, opts?: Record<string, unknown>) => Promise<{ data: number[] | Float32Array }>
  >;
}
