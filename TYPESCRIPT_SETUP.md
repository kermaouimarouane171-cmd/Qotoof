# TypeScript Setup Guide - Qotoof Project

## Overview
This project has been configured to support TypeScript alongside JavaScript files. TypeScript provides static type checking and better developer experience.

## Configuration Files

### `tsconfig.json`
Main TypeScript configuration file:
- **target**: ES2020
- **module**: ESNext
- **jsx**: react-jsx (for React 18)
- **strict**: false (gradual type checking)
- **allowJs**: true (allows .js files alongside .ts files)
- **checkJs**: false (doesn't enforce types in .js files)
- **baseUrl**: . (project root)
- **paths**: `@/*` maps to `src/*`

### `babel.config.js`
Babel is configured to transpile TypeScript files:
- Uses `@babel/preset-typescript` for TypeScript support
- Works alongside React and modern JavaScript presets

### `jest.config.js`
Jest is configured to run tests on both `.js` and `.ts/.tsx` files:
- Transforms: `js`, `jsx`, `ts`, `tsx`
- Test patterns include TypeScript extensions

## File Extensions

- **`.ts`**: TypeScript files (for utility functions, services, etc.)
- **`.tsx`**: TypeScript files with JSX (for React components)
- **`.js`**: JavaScript files (still supported)
- **`.jsx`**: JavaScript files with JSX (still supported)

## Getting Started with TypeScript

### Creating New Files

You can now create TypeScript files:

```typescript
// src/services/api.ts
import { supabase } from '@/lib/supabase'

export interface Product {
  id: string
  name: string
  price: number
  description: string
}

export const getProducts = async (): Promise<Product[]> => {
  const { data } = await supabase.from('products').select('*')
  return data || []
}
```

```tsx
// src/components/ProductCard.tsx
import React from 'react'
import { Product } from '@/services/api'

interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  return (
    <div>
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      <button onClick={() => onAddToCart(product)}>Add to Cart</button>
    </div>
  )
}

export default ProductCard
```

### Type Definitions

Custom type definitions are in:
- `src/vite-env.d.ts` - Vite and asset type definitions
- Install additional types via npm: `npm install --save-dev @types/package-name`

## Running TypeScript Checks

### Type Checking Only
```bash
npx tsc --noEmit
```

### Build Project (includes TypeScript compilation)
```bash
npm run build
```

### Run Tests
```bash
npm test
```

## Gradual Migration

You don't need to convert all files at once. TypeScript works alongside JavaScript:

1. **Start with new files**: Write new features in TypeScript
2. **Convert gradually**: Rename `.js`/`.jsx` to `.ts`/`.tsx` when refactoring
3. **Add types incrementally**: Start with basic types, add more as needed

### Example Migration

**Before (JavaScript):**
```jsx
// src/components/Button.jsx
export default function Button({ children, onClick, variant }) {
  return (
    <button className={`btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  )
}
```

**After (TypeScript):**
```tsx
// src/components/Button.tsx
import React from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: Variant
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary' 
}) => {
  return (
    <button className={`btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  )
}

export default Button
```

## Installed Packages

### Core
- `typescript` - TypeScript compiler
- `@babel/preset-typescript` - Babel preset for TypeScript

### Type Definitions
- `@types/react` - React types
- `@types/react-dom` - React DOM types
- `@types/leaflet` - Leaflet map types
- `@types/react-google-recaptcha` - reCAPTCHA types
- `@types/jest` - Jest test types
- `vite-tsconfig-paths` - Vite TypeScript path resolution

## IDE Support

### VS Code
- Install "TypeScript and JavaScript Language Features" extension (built-in)
- TypeScript will automatically provide IntelliSense and error checking

### WebStorm/IntelliJ
- Built-in TypeScript support
- No additional configuration needed

## Troubleshooting

### "Cannot find module" errors
- Make sure the path is correct
- Check `tsconfig.json` paths configuration
- Run `npm install` to ensure all packages are installed

### Type errors in existing JS files
- Existing `.js` files are not type-checked (`checkJs: false`)
- Only new `.ts`/`.tsx` files will be type-checked

### Build fails with TypeScript errors
- Run `npx tsc --noEmit` to see all errors
- Fix type errors or add `@ts-ignore` comments for temporary fixes

## Best Practices

1. **Use interfaces for objects**: Define shapes of props, state, API responses
2. **Use type aliases for unions**: `type Status = 'pending' | 'active' | 'completed'`
3. **Avoid `any`**: Use `unknown` if you really don't know the type
4. **Use generics**: For reusable functions and components
5. **Leverage inference**: TypeScript can infer many types automatically

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [TypeScript Playground](https://www.typescriptlang.org/play)
