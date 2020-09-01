import typescript from '@rollup/plugin-typescript';
import buble from '@rollup/plugin-buble';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
    },
    {
      file: pkg.unpkg,
      name: 'FluentKit',
      format: 'umd',
      sourcemap: true,
    },
  ],
  plugins: [typescript(), buble({ objectAssign: true }), terser()],
};
