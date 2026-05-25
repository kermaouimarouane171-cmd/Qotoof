import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const DEFAULT_MAX_INCREASE = 5
const ROOT_DIR = process.cwd()
const DIST_ASSETS_DIR = path.join(ROOT_DIR, 'dist', 'assets')
const BASELINE_PATH = path.join(ROOT_DIR, 'scripts', 'bundle-baseline.json')

const COLORS = {
  reset: '\u001b[0m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  dim: '\u001b[2m',
}

function colorize(text, color, enabled = true) {
  if (!enabled || !COLORS[color]) {
    return text
  }

  return `${COLORS[color]}${text}${COLORS.reset}`
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`
}

function formatPercent(value) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    update: false,
    maxIncrease: DEFAULT_MAX_INCREASE,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--update') {
      options.update = true
      continue
    }

    if (arg === '--max-increase') {
      const raw = argv[index + 1]
      if (raw == null) {
        throw new Error('Missing value for --max-increase')
      }
      options.maxIncrease = Number(raw)
      index += 1
      continue
    }

    if (arg.startsWith('--max-increase=')) {
      options.maxIncrease = Number(arg.split('=')[1])
    }
  }

  if (!Number.isFinite(options.maxIncrease) || options.maxIncrease < 0) {
    throw new Error('Invalid value for --max-increase')
  }

  return options
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function loadBaseline(filePath = BASELINE_PATH) {
  try {
    return readJsonFile(filePath)
  } catch (_error) {
    return null
  }
}

function saveBaseline(summary, filePath = BASELINE_PATH) {
  const files = summary.files || Object.fromEntries((summary.rows || []).map((row) => [row.filename, row.currentBytes]))
  const payload = {
    generated: new Date().toISOString().slice(0, 10),
    files,
    total_kb: Number((summary.totalKb || 0).toFixed(1)),
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`)
  return payload
}

function estimateGzippedSize(filePath) {
  const content = fs.readFileSync(filePath)
  return gzipSync(content).byteLength
}

function collectBundleFiles(distDir = DIST_ASSETS_DIR) {
  if (!fs.existsSync(distDir)) {
    return []
  }

  const stack = [distDir]
  const files = []

  while (stack.length) {
    const currentDir = stack.pop()
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })

    entries.forEach((entry) => {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        stack.push(fullPath)
        return
      }

      if (!entry.name.endsWith('.js')) {
        return
      }

      const currentBytes = estimateGzippedSize(fullPath)
      const relativeName = path.relative(distDir, fullPath).replace(/\\/g, '/')
      files.push({ filename: relativeName, fullPath, currentBytes })
    })
  }

  return files.sort((a, b) => a.filename.localeCompare(b.filename))
}

function summarizeBundle(files, baseline = { files: {}, total_kb: 0 }) {
  const rows = files.map((file) => {
    const baselineBytes = Math.max(0, Number(baseline.files?.[file.filename] || 0))
    const change = baselineBytes === 0
      ? (file.currentBytes === 0 ? 0 : 100)
      : ((file.currentBytes - baselineBytes) / baselineBytes) * 100

    return {
      filename: file.filename,
      currentBytes: file.currentBytes,
      baselineBytes,
      change,
    }
  })

  const currentTotalBytes = rows.reduce((sum, row) => sum + row.currentBytes, 0)
  const baselineTotalBytesFromFiles = Object.values(baseline.files || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
  const baselineTotalBytes = baselineTotalBytesFromFiles > 0
    ? baselineTotalBytesFromFiles
    : Math.max(0, Number(baseline.total_kb || 0) * 1024)
  const totalChange = baselineTotalBytes === 0
    ? (currentTotalBytes === 0 ? 0 : 100)
    : ((currentTotalBytes - baselineTotalBytes) / baselineTotalBytes) * 100

  return {
    rows,
    currentTotalBytes,
    baselineTotalBytes,
    totalChange,
    totalKb: currentTotalBytes / 1024,
  }
}

function hasBaselineData(baseline) {
  return Boolean(baseline && typeof baseline === 'object' && (baseline.generated || baseline.total_kb || Object.keys(baseline.files || {}).length))
}

function getSeverity(change, maxIncrease) {
  if (change <= 0) {
    return 'green'
  }

  if (change <= 3) {
    return 'yellow'
  }

  if (change > maxIncrease) {
    return 'red'
  }

  return 'yellow'
}

function printReport(report, { maxIncrease, colorEnabled = true } = {}) {
  const header = ['filename', 'current size', 'baseline', 'change %']
  const lines = [header.join(' | '), header.map(() => '---').join(' | ')]

  report.rows.forEach((row) => {
    const severity = getSeverity(row.change, maxIncrease)
    const changeLabel = formatPercent(row.change)
    const displayedChange = colorize(changeLabel, severity, colorEnabled)

    lines.push([
      row.filename,
      formatKb(row.currentBytes),
      formatKb(row.baselineBytes),
      displayedChange,
    ].join(' | '))
  })

  const totalKb = report.currentTotalBytes / 1024
  const totalLabel = formatPercent(report.totalChange)
  const withinLimit = report.totalChange <= maxIncrease
  const totalSeverity = report.totalChange > maxIncrease ? 'red' : (report.totalChange > 0 ? 'yellow' : 'green')
  const totalMessage = `Total: ${formatKb(report.currentTotalBytes)} (${totalLabel}) ${withinLimit ? '✓ within limit' : '✗ exceeds limit'}`

  console.log(lines.join('\n'))
  console.log(colorize(totalMessage, totalSeverity, colorEnabled))

  return { totalKb, withinLimit }
}

export function checkBundleSize({
  distDir = DIST_ASSETS_DIR,
  baselinePath = BASELINE_PATH,
  maxIncrease = DEFAULT_MAX_INCREASE,
  update = false,
  colorEnabled = true,
} = {}) {
  const files = collectBundleFiles(distDir)
  const baseline = loadBaseline(baselinePath) || { files: {}, total_kb: 0 }

  if (!files.length) {
    if (update || !hasBaselineData(baseline)) {
      saveBaseline({ files: {}, totalKb: 0 }, baselinePath)
    }

    console.log('No JavaScript bundle files found in dist/assets/.')
    return { exitCode: 0, updated: update || !hasBaselineData(baseline), report: { rows: [], currentTotalBytes: 0, baselineTotalBytes: 0, totalChange: 0, totalKb: 0 }, withinLimit: true, summary: { totalKb: 0, withinLimit: true } }
  }

  if (!hasBaselineData(baseline) && !update) {
    const report = summarizeBundle(files, baseline)
    saveBaseline(report, baselinePath)
    printReport(report, { maxIncrease, colorEnabled })
    console.log(colorize('Baseline missing. Captured current bundle sizes as the new baseline.', 'green', colorEnabled))
    return { exitCode: 0, updated: true, report, withinLimit: true, summary: { totalKb: report.totalKb, withinLimit: true } }
  }

  if (update) {
    const report = summarizeBundle(files, baseline)
    saveBaseline(report, baselinePath)
    printReport(report, { maxIncrease, colorEnabled })
    return { exitCode: 0, updated: true, report, withinLimit: true, summary: { totalKb: report.totalKb, withinLimit: true } }
  }

  const report = summarizeBundle(files, baseline)
  const summary = printReport(report, { maxIncrease, colorEnabled })

  const failed = report.totalChange > maxIncrease
  return {
    exitCode: failed ? 1 : 0,
    updated: false,
    report,
    withinLimit: !failed,
    summary,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(`${path.sep}scripts${path.sep}checkBundleSize.js`)) {
  try {
    const options = parseArgs()
    const result = checkBundleSize(options)
    process.exit(result.exitCode)
  } catch (error) {
    console.error(error?.message || error)
    process.exit(1)
  }
}

export {
  BASELINE_PATH,
  DIST_ASSETS_DIR,
  DEFAULT_MAX_INCREASE,
  collectBundleFiles,
  estimateGzippedSize,
  formatKb,
  formatPercent,
  loadBaseline,
  parseArgs,
  printReport,
  saveBaseline,
  summarizeBundle,
}