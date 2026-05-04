import transformViteEnvForJest from './babel-plugin-transform-vite-env-for-jest.js'

export default function babelConfig(api) {
  const isTest = api.env('test')

  return {
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' } }],
      ['@babel/preset-react', { runtime: 'automatic' }],
      ['@babel/preset-typescript', { isTSX: true, allExtensions: true }]
    ],
    plugins: isTest ? [transformViteEnvForJest] : []
  }
}
