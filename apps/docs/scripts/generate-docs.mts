import * as OpenAPI from 'fumadocs-openapi';
import * as Typescript from 'fumadocs-typescript';
import * as path from 'node:path';
import { rimrafSync } from 'rimraf';

rimrafSync('./content/docs/ui/unkey', {
  filter(v) {
    return !v.endsWith('index.mdx') && !v.endsWith('meta.json');
  },
});

rimrafSync('./content/docs/ui/museum', {
  filter(v) {
    return !v.endsWith('index.mdx') && !v.endsWith('meta.json');
  },
});

void OpenAPI.generateFiles({
  input: ['./museum.yaml'],
  output: './content/docs/ui',
  per: 'operation',
});

void OpenAPI.generateFiles({
  input: ['./unkey.json'],
  output: './content/docs',
  per: 'operation',
  groupBy: 'tag',
});

const demoRegex = /^---type-table-demo---\r?\n(?<content>.+)\r?\n---end---$/gm;
void Typescript.generateFiles({
  input: ['./content/docs/**/*.model.mdx'],
  transformOutput(_, content) {
    return content.replace(demoRegex, '---type-table---\n$1\n---end---');
  },
  output: (file) =>
    path.resolve(
      path.dirname(file),
      `${path.basename(file).split('.')[0]}.mdx`,
    ),
});
