export default function transformViteEnvForJest({ types: t }) {
  const processEnv = () => t.memberExpression(t.identifier('process'), t.identifier('env'))

  const buildEnvMember = (key) => {
    if (t.isValidIdentifier(key)) {
      return t.memberExpression(processEnv(), t.identifier(key))
    }

    return t.memberExpression(processEnv(), t.stringLiteral(key), true)
  }

  const isImportMeta = (node) => (
    t.isMetaProperty(node)
    && node.meta.name === 'import'
    && node.property.name === 'meta'
  )

  const isImportMetaEnv = (node) => (
    t.isMemberExpression(node)
    && !node.computed
    && isImportMeta(node.object)
    && t.isIdentifier(node.property, { name: 'env' })
  )

  const getImportMetaEnvKey = (node) => {
    if (!t.isMemberExpression(node) || !isImportMetaEnv(node.object)) {
      return null
    }

    if (!node.computed && t.isIdentifier(node.property)) {
      return node.property.name
    }

    if (node.computed && t.isStringLiteral(node.property)) {
      return node.property.value
    }

    return null
  }

  const buildReplacement = (key) => {
    switch (key) {
      case 'DEV':
        return t.binaryExpression('!==', buildEnvMember('NODE_ENV'), t.stringLiteral('production'))
      case 'PROD':
        return t.binaryExpression('===', buildEnvMember('NODE_ENV'), t.stringLiteral('production'))
      case 'MODE':
        return t.logicalExpression('||', buildEnvMember('NODE_ENV'), t.stringLiteral('test'))
      case 'SSR':
        return t.booleanLiteral(false)
      case 'BASE_URL':
        return t.stringLiteral('/')
      default:
        return buildEnvMember(key)
    }
  }

  return {
    name: 'transform-vite-env-for-jest',
    visitor: {
      MemberExpression(path) {
        const key = getImportMetaEnvKey(path.node)

        if (key) {
          path.replaceWith(buildReplacement(key))
          return
        }

        if (
          isImportMetaEnv(path.node)
          && !(path.parentPath.isMemberExpression() && path.parentPath.node.object === path.node)
        ) {
          path.replaceWith(processEnv())
        }
      }
    }
  }
}