import typescript from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/main.ts',        // Entry file
  output: {
    file: 'dist/main.js',      // Output file Screeps uses
    format: 'cjs'              // Screeps uses CommonJS
  },
  plugins: [
    nodeResolve(),
    commonjs(),
    typescript(),
    terser()
  ]
};
