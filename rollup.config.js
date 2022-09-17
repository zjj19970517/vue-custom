const path = require('path')
import TSPlugin from 'rollup-plugin-typescript2'
import json from '@rollup/plugin-json'

const packagesDir = path.resolve(__dirname, 'packages')
const packageDir = path.resolve(packagesDir, process.env.TARGET)
const pkg = require(path.resolve(packageDir, `package.json`))
const packageBuildOptions = pkg.buildOptions || {}
const name = path.basename(packageDir)

let hasTSChecked = false

const outputConfigs = {
  'esm-bundler': {
    file: path.resolve(packageDir, `dist/${name}.esm-bundler.js`),
    format: `es`
  },
  cjs: {
    file: path.resolve(packageDir, `dist/${name}.cjs.js`),
    format: `cjs`
  },
  global: {
    file: path.resolve(packageDir, `dist/${name}.global.js`),
    format: `iife`
  }
}

const defaultFormats = ['esm-bundler', 'cjs']
const packageFormats = packageBuildOptions.formats || defaultFormats

const packageConfigs = packageFormats.map(format =>
  createConfig(format, outputConfigs[format])
)

function createConfig(format, output) {
  const isGlobalBuild = /global/.test(format)
  const shouldEmitDeclarations = process.env.TYPES != null && !hasTSChecked

  output.exports = 'named'
  output.sourcemap = !!process.env.SOURCE_MAP
  output.externalLiveBindings = false

  if (isGlobalBuild) {
    output.name = packageBuildOptions.name
  }

  const entryFile = `src/index.ts`
  const external = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {})
  ]

  const tsPlugin = TSPlugin({
    check: process.env.NODE_ENV === 'production' && !hasTSChecked,
    tsconfig: path.resolve(__dirname, 'tsconfig.json'),
    cacheRoot: path.resolve(__dirname, 'node_modules/.rts2_cache'),
    tsconfigOverride: {
      compilerOptions: {
        target: 'es2019',
        sourceMap: output.sourcemap,
        declaration: shouldEmitDeclarations,
        declarationMap: shouldEmitDeclarations
      }
    }
  })

  hasTSChecked = true

  const nodePlugins = [
    require('@rollup/plugin-commonjs')({
      sourceMap: false
    }),
    ...(format === 'cjs' ? [] : [require('rollup-plugin-polyfill-node')()]),
    require('@rollup/plugin-node-resolve').nodeResolve()
  ]

  return {
    input: path.resolve(packageDir, entryFile),
    external,
    plugins: [
      json({
        namedExports: false
      }),
      tsPlugin,
      ...nodePlugins
    ],
    output,
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg)
      }
    },
    treeshake: {
      moduleSideEffects: false
    }
  }
}

export default packageConfigs
