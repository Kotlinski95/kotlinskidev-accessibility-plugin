import type { ChunkName, ChunkRecord } from './types';

export const RUNTIME_ABI = 1;

const CHUNK_NAMES: readonly string[] = ['kernel', 'panel', 'content', 'color', 'orientation'] satisfies ChunkName[];

export const isChunkRecord = (value: unknown): value is ChunkRecord =>
  Array.isArray(value) &&
  value.length === 3 &&
  typeof value[0] === 'string' &&
  CHUNK_NAMES.includes(value[0]) &&
  typeof value[1] === 'number' &&
  typeof value[2] === 'function';
