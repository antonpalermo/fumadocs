// Virtual files -> File Graph -> Plugins -> Result
// Result should contain page tree and basic utilities

import { splitPath } from '@/server';
import type { Meta, Page, Transformer } from './types';
import { parsePath } from './path';

export interface LoadOptions {
  files: VirtualFile[];
  transformers?: Transformer[];
  rootDir?: string;
}

export interface VirtualFile {
  path: string;
  type: 'page' | 'meta';
  data: Record<string, unknown>;
}

export interface Result {
  graph: GraphNode;
  pages: Page[];
  metas: Meta[];
  data: Record<string, unknown>;
}

type GraphNode =
  | { type: 'meta'; meta: Meta }
  | { type: 'page'; page: Page }
  | { type: 'folder'; children: GraphNode[] };

export async function load({
  files,
  transformers = [],
  rootDir = '',
}: LoadOptions): Promise<Result> {
  const parsedFiles = files.map((file) => ({
    file: parsePath(file.path, rootDir),
    type: file.type,
    data: file.data,
  }));

  const pages: Page[] = parsedFiles
    .filter((file) => file.type === 'page')
    .map((file) => ({
      file: file.file,
      ...(file.data as Omit<Page, 'file'>),
    }));

  const metas: Meta[] = parsedFiles
    .filter((file) => file.type === 'meta')
    .map((file) => ({ file: file.file, ...(file.data as Omit<Meta, 'file'>) }));

  const graph = resolveFiles('', pages, metas);
  const ctx: Result = { graph, pages, metas, data: {} };

  for (const transformer of transformers) {
    // eslint-disable-next-line no-await-in-loop -- in sync
    await transformer(ctx);
  }

  return ctx;
}

export function resolveFiles(
  path: string,
  pages: Page[],
  metas: Meta[],
): GraphNode {
  const directories = new Map<string, GraphNode[]>();

  for (const page of pages) {
    const nodes = directories.get(page.file.dirname) ?? [];

    nodes.push({
      type: 'page',
      page,
    });
    directories.set(page.file.dirname, nodes);
  }

  for (const meta of metas) {
    const nodes = directories.get(meta.file.dirname) ?? [];

    nodes.push({
      type: 'meta',
      meta,
    });
    directories.set(meta.file.dirname, nodes);
  }

  type FolderNode = Extract<GraphNode, { type: 'folder' }>;

  const directoryNodes = new Map<string, FolderNode>();

  const sortedKeys = [...directories.keys()].sort(
    (a, b) => a.length - b.length,
  );

  for (const key of sortedKeys) {
    const segments = splitPath(key);
    let parentDir: FolderNode | undefined;

    for (let i = segments.length; i >= 0; i--) {
      const node = directoryNodes.get(segments.slice(0, i).join('/'));

      if (node) {
        parentDir = node;
        break;
      }
    }

    const thisNode: FolderNode = {
      type: 'folder',
      children: directories.get(key) ?? [],
    };

    directoryNodes.set(key, thisNode);
    parentDir?.children.push(thisNode);
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Not null
  return directoryNodes.get(path)!;
}
