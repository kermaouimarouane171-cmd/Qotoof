#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const parseEnvFile = (filePath) => {
  const raw = readFileSync(filePath, 'utf-8')
  const map = {}

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const idx = trimmed.indexOf('=')
    if (idx === -1) continue

    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    map[key] = value
  }

  return map
}

const env = parseEnvFile(resolve(process.cwd(), '.env.production'))
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const imagePool = [
  'https://cdn.pixabay.com/photo/2015/04/09/15/07/vegetables-715538.jpg',
  'https://cdn.pixabay.com/photo/2016/07/22/09/59/vegetables-1534676.jpg',
  'https://cdn.pixabay.com/photo/2015/02/19/08/06/vegetables-642078.jpg',
  'https://cdn.pixabay.com/photo/2014/04/05/11/35/salad-314281.jpg',
  'https://cdn.pixabay.com/photo/2015/05/31/12/51/vegetables-790122.jpg',
  'https://cdn.pixabay.com/photo/2016/01/07/14/48/vegetables-1125156.jpg',
  'https://cdn.pixabay.com/photo/2016/11/22/19/11/vegetables-1850092.jpg',
  'https://cdn.pixabay.com/photo/2017/03/22/23/15/strawberries-2167541.jpg',
  'https://cdn.pixabay.com/photo/2017/03/23/19/57/fruits-2169305.jpg',
  'https://cdn.pixabay.com/photo/2016/11/21/16/00/oranges-1846081.jpg',
  'https://cdn.pixabay.com/photo/2018/04/10/18/54/fruit-3307069.jpg',
  'https://cdn.pixabay.com/photo/2018/05/14/17/50/papaya-3401265.jpg',
  'https://cdn.pixabay.com/photo/2019/07/10/17/42/banana-4330436.jpg',
  'https://cdn.pixabay.com/photo/2017/09/24/10/30/watermelon-2776619.jpg',
  'https://cdn.pixabay.com/photo/2017/10/25/15/47/tomatoes-2881799.jpg',
  'https://cdn.pixabay.com/photo/2018/01/14/16/55/potatoes-3082321.jpg',
  'https://cdn.pixabay.com/photo/2015/09/30/16/13/pepper-963033.jpg',
  'https://cdn.pixabay.com/photo/2016/04/02/14/12/flower-1303229.jpg',
  'https://cdn.pixabay.com/photo/2017/08/01/11/48/garlic-2564072.jpg',
  'https://cdn.pixabay.com/photo/2016/03/05/22/31/asparagus-1238251.jpg',
]

const countRole = async (role) => {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { head: true, count: 'exact' })
    .eq('role', role)
    .eq('verification_status', 'verified')
    .eq('is_active', true)

  if (error) throw new Error(`count ${role} failed: ${error.message}`)
  return count || 0
}

const ensureUsersForRole = async (role, minCount) => {
  const nowCount = await countRole(role)
  if (nowCount >= minCount) return nowCount

  const needed = minCount - nowCount
  for (let i = 0; i < needed; i++) {
    const seedIndex = nowCount + i + 1
    const email = `launch.${role}.${seedIndex}@qotoof.local`
    const password = role === 'vendor' ? 'LaunchVendor123!' : 'LaunchDriver123!'

    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role },
    })

    let userId = created.data?.user?.id
    if (!userId && created.error) {
      const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (list.error) throw new Error(`listUsers failed: ${list.error.message}`)
      const user = (list.data?.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase())
      if (!user) throw new Error(`cannot resolve user for ${email}: ${created.error.message}`)
      userId = user.id
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email,
        role,
        verification_status: 'verified',
        is_active: true,
        full_name: `${role} ${seedIndex}`,
      }, { onConflict: 'id' })

    if (profileError) throw new Error(`upsert profile failed for ${email}: ${profileError.message}`)
  }

  return countRole(role)
}

const countValidProductsByImageTable = async () => {
  const { data, error } = await supabase
    .from('product_images')
    .select('product_id,url,is_primary')
    .eq('is_primary', true)

  if (error) throw new Error(`count product_images failed: ${error.message}`)

  const unique = new Set(
    (data || [])
      .filter((img) => img.url && !String(img.url).includes('unsplash.com'))
      .map((img) => img.product_id),
  )

  return unique.size
}

const patchPrimaryUnsplashImages = async () => {
  const { data, error } = await supabase
    .from('product_images')
    .select('id,url')
    .eq('is_primary', true)

  if (error) throw new Error(`load product_images failed: ${error.message}`)

  let changed = 0
  let i = 0
  for (const row of data || []) {
    if (!String(row.url || '').includes('unsplash.com')) continue

    const url = imagePool[i % imagePool.length]
    i += 1

    const { error: updateError } = await supabase
      .from('product_images')
      .update({ url })
      .eq('id', row.id)

    if (updateError) throw new Error(`update product image failed: ${updateError.message}`)
    changed += 1
  }

  return changed
}

const createProductsWithPrimaryImages = async (targetTotal) => {
  const { data: vendors, error: vendorsError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'vendor')
    .eq('verification_status', 'verified')
    .eq('is_active', true)
    .limit(50)

  if (vendorsError) throw new Error(`load vendors failed: ${vendorsError.message}`)
  if (!vendors || vendors.length === 0) throw new Error('no verified active vendors found')

  const { data: templateRows, error: templateError } = await supabase
    .from('products')
    .select('*')
    .limit(1)

  if (templateError) throw new Error(`load products template failed: ${templateError.message}`)
  const template = templateRows?.[0] || {}

  let valid = await countValidProductsByImageTable()
  let cursor = 0

  while (valid < targetTotal) {
    const vendor = vendors[cursor % vendors.length]
    const payload = {
      vendor_id: vendor.id,
      name: `Launch Product ${cursor + 1}`,
      description: 'Launch readiness seeded product',
      category: template.category || 'vegetables',
      price_per_unit: template.price_per_unit ?? 10,
      unit_type: template.unit_type || 'kg',
      min_order_quantity: template.min_order_quantity ?? 1,
      available_quantity: template.available_quantity ?? 200,
      stock_quantity: template.stock_quantity ?? 200,
      is_available: true,
      is_active: true,
    }

    if (!Object.prototype.hasOwnProperty.call(template, 'stock_quantity')) {
      delete payload.stock_quantity
    }

    const { data: productRows, error: productError } = await supabase
      .from('products')
      .insert(payload)
      .select('id')
      .limit(1)

    if (productError) throw new Error(`insert product failed: ${productError.message}`)

    const productId = productRows?.[0]?.id
    if (!productId) throw new Error('insert product returned no id')

    const imageUrl = imagePool[cursor % imagePool.length]
    const { error: imageError } = await supabase
      .from('product_images')
      .insert({
        product_id: productId,
        url: imageUrl,
        is_primary: true,
        sort_order: 1,
      })

    if (imageError) throw new Error(`insert product image failed: ${imageError.message}`)

    cursor += 1
    valid = await countValidProductsByImageTable()
  }

  return valid
}

const main = async () => {
  console.log('Launch dataset fixer started')

  const vendors = await ensureUsersForRole('vendor', 10)
  const drivers = await ensureUsersForRole('driver', 10)

  const patched = await patchPrimaryUnsplashImages()
  let validProducts = await countValidProductsByImageTable()

  if (validProducts < 19) {
    validProducts = await createProductsWithPrimaryImages(19)
  }

  console.log('Done')
  console.log(`Vendors verified+active: ${vendors}`)
  console.log(`Drivers verified+active: ${drivers}`)
  console.log(`Patched unsplash primary images: ${patched}`)
  console.log(`Valid products with non-unsplash primary image: ${validProducts}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
