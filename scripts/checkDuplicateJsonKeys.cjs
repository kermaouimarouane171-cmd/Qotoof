const fs = require('fs')
const path = require('path')

function findDuplicateKeys(filePath) {
  const source = fs.readFileSync(filePath, 'utf-8')
  const duplicates = []
  const stack = []
  let i = 0
  let line = 1
  let col = 1

  const isWhitespace = (ch) => /\s/.test(ch)

  const peek = () => source[i]
  const advance = () => {
    if (source[i] === '\n') {
      line++
      col = 1
    } else {
      col++
    }
    return source[i++]
  }

  const parseString = () => {
    let result = ''
    advance() // consume opening quote
    while (i < source.length) {
      const ch = advance()
      if (ch === '"') return result
      if (ch === '\\') {
        const next = advance()
        const escapes = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }
        if (next in escapes) {
          result += escapes[next]
        } else if (next === 'u') {
          const hex = source.slice(i, i + 4)
          result += String.fromCharCode(parseInt(hex, 16))
          i += 4
          col += 4
        } else {
          result += next
        }
      } else {
        result += ch
      }
    }
    return result
  }

  const skipWhitespace = () => {
    while (i < source.length && isWhitespace(peek())) advance()
  }

  const parseValue = () => {
    skipWhitespace()
    if (i >= source.length) return
    const ch = peek()
    if (ch === '{') {
      advance()
      stack.push(new Set())
      skipWhitespace()
      if (peek() === '}') {
        advance()
        stack.pop()
        return
      }
      while (true) {
        skipWhitespace()
        if (peek() !== '"') {
          // Not a string key, skip
          parseValue()
        } else {
          const key = parseString()
          const keyPath = [...stack.map(set => ''), key].join('.') // simple path
          const currentSet = stack[stack.length - 1]
          if (currentSet.has(key)) {
            duplicates.push({ key, line, col })
          } else {
            currentSet.add(key)
          }
          skipWhitespace()
          if (peek() === ':') advance()
          parseValue()
        }
        skipWhitespace()
        if (peek() === ',') {
          advance()
          continue
        }
        if (peek() === '}') {
          advance()
          stack.pop()
          return
        }
        // Unexpected token, break to avoid infinite loop
        break
      }
    } else if (ch === '[') {
      advance()
      skipWhitespace()
      if (peek() === ']') {
        advance()
        return
      }
      while (true) {
        parseValue()
        skipWhitespace()
        if (peek() === ',') {
          advance()
          continue
        }
        if (peek() === ']') {
          advance()
          return
        }
        break
      }
    } else if (ch === '"') {
      parseString()
    } else if (ch === 't' || ch === 'f' || ch === 'n') {
      // true, false, null
      while (i < source.length && !isWhitespace(peek()) && peek() !== ',' && peek() !== '}' && peek() !== ']') {
        advance()
      }
    } else {
      // number or unquoted
      while (i < source.length && !isWhitespace(peek()) && peek() !== ',' && peek() !== '}' && peek() !== ']') {
        advance()
      }
    }
  }

  try {
    parseValue()
  } catch (err) {
    // Ignore parse errors for duplicate detection purposes
  }

  return duplicates
}

const files = [
  path.resolve('src/i18n/locales/ar.json'),
  path.resolve('src/i18n/locales/en.json'),
  path.resolve('src/i18n/locales/fr.json'),
]

let hasDuplicates = false
for (const file of files) {
  const dups = findDuplicateKeys(file)
  if (dups.length > 0) {
    hasDuplicates = true
    console.log(`\nDuplicate keys in ${file}:`)
    for (const dup of dups) {
      console.log(`  - "${dup.key}" at line ${dup.line}, col ${dup.col}`)
    }
  } else {
    console.log(`\nNo duplicate keys in ${file}`)
  }
}

if (hasDuplicates) {
  process.exit(1)
}
