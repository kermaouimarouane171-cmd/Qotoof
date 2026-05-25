import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

import { checkBundleSize, estimateGzippedSize } from '../checkBundleSize.js'

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'qotoof-bundle-'))

const writeJson = (filePath, data) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

const writeBundle = (assetsDir, filename, content) => {
  fs.mkdirSync(assetsDir, { recursive: true })
  fs.writeFileSync(path.join(assetsDir, filename), content)
}

describe('checkBundleSize', () => {
  let tempRoot
  let distAssetsDir
  let baselinePath
  let logSpy
  let errorSpy

  beforeEach(() => {
    tempRoot = makeTempDir()
    distAssetsDir = path.join(tempRoot, 'dist', 'assets')
    baselinePath = path.join(tempRoot, 'scripts', 'bundle-baseline.json')
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    fs.rmSync(tempRoot, { recursive: true, force: true })
  })

  it('passes when current size equals baseline', () => {
    writeBundle(distAssetsDir, 'index-abc.js', 'const value = 1;')
    const current = estimateGzippedSize(path.join(distAssetsDir, 'index-abc.js'))
    writeJson(baselinePath, { generated: '2026-05-24', files: { 'index-abc.js': current }, total_kb: Number((current / 1024).toFixed(1)) })

    const result = checkBundleSize({ distDir: distAssetsDir, baselinePath, colorEnabled: false })

    expect(result.exitCode).toBe(0)
    expect(result.withinLimit).toBe(true)
  })

  it('passes when current size is smaller than baseline', () => {
    writeBundle(distAssetsDir, 'index-abc.js', 'const value = 1;')
    writeJson(baselinePath, { generated: '2026-05-24', files: { 'index-abc.js': 500 }, total_kb: 0.5 })

    const result = checkBundleSize({ distDir: distAssetsDir, baselinePath, colorEnabled: false })

    expect(result.exitCode).toBe(0)
  })

  it('passes when increase is exactly 5%', () => {
    writeBundle(distAssetsDir, 'index-abc.js', 'x'.repeat(1024))
    const current = estimateGzippedSize(path.join(distAssetsDir, 'index-abc.js'))
    const baseline = Math.round(current / 1.05)
    writeJson(baselinePath, { generated: '2026-05-24', files: { 'index-abc.js': baseline }, total_kb: Number((baseline / 1024).toFixed(1)) })

    const result = checkBundleSize({ distDir: distAssetsDir, baselinePath, colorEnabled: false })

    expect(result.exitCode).toBe(0)
  })

  it('fails when increase is 5.1%', () => {
    writeBundle(distAssetsDir, 'index-abc.js', 'x'.repeat(1024))
    const current = estimateGzippedSize(path.join(distAssetsDir, 'index-abc.js'))
    const baseline = Math.max(1, Math.floor(current / 1.051))
    writeJson(baselinePath, { generated: '2026-05-24', files: { 'index-abc.js': baseline }, total_kb: Number((baseline / 1024).toFixed(1)) })

    const result = checkBundleSize({ distDir: distAssetsDir, baselinePath, colorEnabled: false })

    expect(result.exitCode).toBe(1)
    expect(result.withinLimit).toBe(false)
  })

  it('shows correct change percentage in output', () => {
    writeBundle(distAssetsDir, 'index-abc.js', 'const value = 1;')
    writeJson(baselinePath, { generated: '2026-05-24', files: { 'index-abc.js': 100 }, total_kb: 0.1 })

    checkBundleSize({ distDir: distAssetsDir, baselinePath, colorEnabled: false })

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('change %'))
  })

  it('--update flag saves new baseline', () => {
    writeBundle(distAssetsDir, 'index-abc.js', 'const value = 1;')

    const result = checkBundleSize({ distDir: distAssetsDir, baselinePath, update: true, colorEnabled: false })

    const saved = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
    expect(result.exitCode).toBe(0)
    expect(saved.files['index-abc.js']).toBeGreaterThan(0)
    expect(saved.total_kb).toBeGreaterThanOrEqual(0)
  })

  it('handles missing baseline file (first run)', () => {
    writeBundle(distAssetsDir, 'index-abc.js', 'const value = 1;')

    const result = checkBundleSize({ distDir: distAssetsDir, baselinePath, colorEnabled: false })

    expect(result.exitCode).toBe(0)
    expect(fs.existsSync(baselinePath)).toBe(true)
  })

  it('handles missing dist/ directory gracefully', () => {
    const result = checkBundleSize({ distDir: distAssetsDir, baselinePath, colorEnabled: false })

    expect(result.exitCode).toBe(0)
    expect(fs.existsSync(baselinePath)).toBe(true)
  })

  it('reads gzipped size estimate correctly', () => {
    const filePath = path.join(tempRoot, 'bundle.js')
    const content = 'const bundle = "hello world";'
    fs.writeFileSync(filePath, content)

    const expected = gzipSync(Buffer.from(content)).byteLength

    expect(estimateGzippedSize(filePath)).toBe(expected)
  })
})