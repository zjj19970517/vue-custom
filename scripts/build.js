const path = require('path')
const execa = require('execa')
const fs = require('fs-extra')
const chalk = require('chalk')

const { getAllTargets } = require('./utils')

const args = require('minimist')(process.argv.slice(2))
const target = args._
const formats = args.formats || args.f
const devOnly = args.devOnly || args.d
const sourceMap = args.sourcemap || args.s
const watching = args.watch || args.w
const needTsDeclaration = args.needTsDeclaration || args.td
const allTargets = getAllTargets()

const start = async () => {
  // 如果没有指定目标，构建全部
  if (!target.length) {
    await runParallel(allTargets, build)
  } else {
    // 指定了目标后，只构建目标下的 package
    await runParallel([...target], build)
  }
  console.log('[COMPLETED]: all package build success !')
}

start()

/**
 * 并行执行任务
 * @param {*} targets
 * @param {*} iteratorFun
 * @returns
 */
async function runParallel(targets, iteratorFun) {
  const tasks = []
  for (const target of targets) {
    tasks.push(iteratorFun(target))
  }
  return Promise.all(tasks)
}

/**
 * 构建目标 package
 * @param {*} target
 */
async function build(target) {
  const pkgDir = path.resolve(`packages/${target}`)

  // await fs.remove(path.resolve(__dirname, '../node_modules/.rts2_cache'))

  if (!formats) {
    await fs.remove(`${pkgDir}/dist`)
  }

  const env = devOnly ? 'development' : 'production'

  await execa(
    'rollup',
    [
      watching ? '-cw' : '-c',
      '--environment',
      [
        `NODE_ENV:${env}`,
        `TARGET:${target}`,
        needTsDeclaration ? `TYPES:true` : ``,
        formats ? `FORMATS:${formats}` : ``,
        sourceMap ? `SOURCE_MAP:true` : ``
      ]
        .filter(Boolean)
        .join(',')
    ],
    // 子进程的日志信息共享给父进程
    { stdio: 'inherit' }
  )

  if (needTsDeclaration) buildTsDeclaration(target)
}

/**
 * 构建某个 package 的 ts 类型声明文件输出
 * @param {*} target
 */
async function buildTsDeclaration(target) {
  const pkgDir = path.resolve(`packages/${target}`)
  const pkg = require(`${pkgDir}/package.json`)

  console.log(
    chalk.bold(chalk.yellow(`Rolling up type definitions for ${target}...`))
  )

  // build types
  const { Extractor, ExtractorConfig } = require('@microsoft/api-extractor')

  const extractorConfigPath = path.resolve(pkgDir, `api-extractor.json`)
  const extractorConfig =
    ExtractorConfig.loadFileAndPrepare(extractorConfigPath)
  const extractorResult = Extractor.invoke(extractorConfig, {
    localBuild: true,
    showVerboseMessages: true
  })

  if (extractorResult.succeeded) {
    // concat additional d.ts to rolled-up dts
    const typesDir = path.resolve(pkgDir, 'types')
    if (await fs.exists(typesDir)) {
      const dtsPath = path.resolve(pkgDir, pkg.types)
      const existing = await fs.readFile(dtsPath, 'utf-8')
      const typeFiles = await fs.readdir(typesDir)
      const toAdd = await Promise.all(
        typeFiles.map(file => {
          return fs.readFile(path.resolve(typesDir, file), 'utf-8')
        })
      )
      await fs.writeFile(dtsPath, existing + '\n' + toAdd.join('\n'))
    }
    console.log(
      chalk.bold(chalk.green(`API Extractor completed successfully.`))
    )
  } else {
    console.error(
      `API Extractor completed with ${extractorResult.errorCount} errors` +
        ` and ${extractorResult.warningCount} warnings`
    )
    process.exitCode = 1
  }

  await fs.remove(`${pkgDir}/dist/packages`)
}
