const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'en', 'fr']

function findDuplicateKeys(source) {
  const duplicates = []
  const stack = []
  let i = 0
  let line = 1
  let col = 1

  const isWhitespace = (ch) => /\s/.test(ch)

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
    while (i < source.length && isWhitespace(source[i])) advance()
  }

  const parseValue = () => {
    skipWhitespace()
    if (i >= source.length) return
    const ch = source[i]
    if (ch === '{') {
      advance()
      stack.push(new Set())
      skipWhitespace()
      if (source[i] === '}') {
        advance()
        stack.pop()
        return
      }
      while (true) {
        skipWhitespace()
        if (source[i] !== '"') {
          parseValue()
        } else {
          const key = parseString()
          const currentSet = stack[stack.length - 1]
          if (currentSet.has(key)) {
            duplicates.push({ key, line, col })
          } else {
            currentSet.add(key)
          }
          skipWhitespace()
          if (source[i] === ':') advance()
          parseValue()
        }
        skipWhitespace()
        if (source[i] === ',') {
          advance()
          continue
        }
        if (source[i] === '}') {
          advance()
          stack.pop()
          return
        }
        break
      }
    } else if (ch === '[') {
      advance()
      skipWhitespace()
      if (source[i] === ']') {
        advance()
        return
      }
      while (true) {
        parseValue()
        skipWhitespace()
        if (source[i] === ',') {
          advance()
          continue
        }
        if (source[i] === ']') {
          advance()
          return
        }
        break
      }
    } else if (ch === '"') {
      parseString()
    } else if (ch === 't' || ch === 'f' || ch === 'n') {
      while (i < source.length && !isWhitespace(source[i]) && source[i] !== ',' && source[i] !== '}' && source[i] !== ']') {
        advance()
      }
    } else {
      while (i < source.length && !isWhitespace(source[i]) && source[i] !== ',' && source[i] !== '}' && source[i] !== ']') {
        advance()
      }
    }
  }

  parseValue()
  return duplicates
}

for (const locale of LOCALES) {
  test(`${locale}.json has no duplicate object keys`, () => {
    const filePath = path.resolve(__dirname, `../../i18n/locales/${locale}.json`)
    const source = fs.readFileSync(filePath, 'utf-8')
    const duplicates = findDuplicateKeys(source)
    expect(duplicates).toEqual([])
  })

  test(`${locale}.json is valid JSON`, () => {
    const filePath = path.resolve(__dirname, `../../i18n/locales/${locale}.json`)
    const source = fs.readFileSync(filePath, 'utf-8')
    expect(() => JSON.parse(source)).not.toThrow()
  })
}
