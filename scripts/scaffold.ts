/**
 * Scaffold generator — creates a new domain with all required files.
 * Usage: npx tsx scripts/scaffold.ts <domain-name>
 * Example: npx tsx scripts/scaffold.ts research
 *
 * Creates:
 *   src/domains/{name}/
 *     {name}.types.ts
 *     {name}.schemas.ts
 *     {name}.config.ts
 *     {name}.service.ts
 *     index.ts
 *   src/app/api/{name}/route.ts
 *   src/hooks/use{Name}.ts
 *   src/components/game/{Name}Panel.tsx
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')

function pascal(name: string): string {
  return name.replace(/(^\w|-\w)/g, c => c.replace('-', '').toUpperCase())
}

function main() {
  const name = process.argv[2]?.toLowerCase()
  if (!name) {
    console.error('Usage: npx tsx scripts/scaffold.ts <domain-name>')
    console.error('Example: npx tsx scripts/scaffold.ts research')
    process.exit(1)
  }

  const Name = pascal(name)
  const dirs = [
    join(SRC, 'domains', name),
    join(SRC, 'app', 'api', name),
  ]

  for (const dir of dirs) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }

  const files: Record<string, string> = {
    // types
    [`domains/${name}/${name}.types.ts`]: (
      `export interface ${Name}Row {\n` +
      `  id: string\n` +
      `  colony_id: string\n` +
      `  name: string\n` +
      `  created_at: string\n` +
      `  updated_at: string\n` +
      `}\n\n` +
      `export interface ${Name}CreateDTO {\n` +
      `  colonyId: string\n` +
      `  name: string\n` +
      `}\n`
    ),

    // schemas
    [`domains/${name}/${name}.schemas.ts`]: (
      `import { z } from 'zod'\n\n` +
      `export const ${name}CreateSchema = z.object({\n` +
      `  colonyId: z.string().uuid(),\n` +
      `  name: z.string().min(1).max(50),\n` +
      `})\n\n` +
      `export type ${Name}CreateInput = z.infer<typeof ${name}CreateSchema>\n`
    ),

    // config
    [`domains/${name}/${name}.config.ts`]: (
      `export const ${Name.toUpperCase()}_CONFIG = {\n` +
      `  // Game balance constants for ${name}\n` +
      `} as const\n`
    ),

    // service
    [`domains/${name}/${name}.service.ts`]: (
      `import { getServerClient } from '@/domains/resource/resource.server'\n` +
      `import type { ${Name}Row, ${Name}CreateDTO } from './${name}.types'\n\n` +
      `/**\n` +
      ` * Get all ${name} records for a colony.\n` +
      ` * @param colonyId - Colony ID\n` +
      ` * @returns Array of ${name} rows\n` +
      ` */\n` +
      `export async function get${Name}s(colonyId: string): Promise<${Name}Row[]> {\n` +
      `  const supabase = getServerClient()\n\n` +
      `  const { data, error } = await supabase\n` +
      `    .from('${name}s')\n` +
      `    .select('*')\n` +
      `    .eq('colony_id', colonyId)\n\n` +
      `  if (error) {\n` +
      `    console.error('get${Name}s error:', error)\n` +
      `    return []\n` +
      `  }\n\n` +
      `  return data || []\n` +
      `}\n\n` +
      `/**\n` +
      ` * Create a new ${name} record.\n` +
      ` * @param dto - Creation data\n` +
      ` * @returns Created ${name} row or null\n` +
      ` */\n` +
      `export async function create${Name}(dto: ${Name}CreateDTO): Promise<${Name}Row | null> {\n` +
      `  const supabase = getServerClient()\n\n` +
      `  const { data, error } = await supabase\n` +
      `    .from('${name}s')\n` +
      `    .insert({ colony_id: dto.colonyId, name: dto.name })\n` +
      `    .select()\n` +
      `    .single()\n\n` +
      `  if (error) {\n` +
      `    console.error('create${Name} error:', error)\n` +
      `    return null\n` +
      `  }\n\n` +
      `  return data\n` +
      `}\n`
    ),

    // barrel
    [`domains/${name}/index.ts`]: (
      `export type * from './${name}.types'\n` +
      `export * from './${name}.schemas'\n` +
      `export * from './${name}.config'\n` +
      `export * from './${name}.service'\n`
    ),

    // API route
    [`app/api/${name}/route.ts`]: (
      `import { NextResponse } from 'next/server'\n` +
      `import { ${name}CreateSchema } from '@/domains/${name}/${name}.schemas'\n` +
      `import { get${Name}s, create${Name} } from '@/domains/${name}/${name}.service'\n` +
      `import { apiError, apiInternalError, apiValidationError } from '@/lib/api-error'\n\n` +
      `export async function GET(request: Request) {\n` +
      `  try {\n` +
      `    const colonyId = new URL(request.url).searchParams.get('colonyId')\n` +
      `    if (!colonyId) return apiError('BAD_REQUEST', 'colonyId is required')\n\n` +
      `    const items = await get${Name}s(colonyId)\n` +
      `    return NextResponse.json({ ${name}s: items })\n` +
      `  } catch (err) {\n` +
      `    return apiInternalError(err)\n` +
      `  }\n` +
      `}\n\n` +
      `export async function POST(request: Request) {\n` +
      `  try {\n` +
      `    const parsed = ${name}CreateSchema.safeParse(await request.json())\n` +
      `    if (!parsed.success) return apiValidationError(parsed.error.flatten())\n\n` +
      `    const item = await create${Name}(parsed.data)\n` +
      `    if (!item) return apiError('INTERNAL_ERROR', 'Failed to create ${name}')\n\n` +
      `    return NextResponse.json({ ${name}: item }, { status: 201 })\n` +
      `  } catch (err) {\n` +
      `    return apiInternalError(err)\n` +
      `  }\n` +
      `}\n`
    ),

    // hook
    [`hooks/use${Name}.ts`]: (
      `'use client'\n\n` +
      `import { useState, useEffect, useCallback } from 'react'\n` +
      `import { supabase } from '@/lib/supabase'\n` +
      `import type { ${Name}Row } from '@/domains/${name}/${name}.types'\n\n` +
      `export function use${Name}(colonyId: string | null) {\n` +
      `  const [items, setItems] = useState<${Name}Row[]>([])\n` +
      `  const [loading, setLoading] = useState(true)\n` +
      `  const [error, setError] = useState<string | null>(null)\n\n` +
      `  const fetchItems = useCallback(async () => {\n` +
      `    if (!colonyId) return\n` +
      `    setLoading(true)\n\n` +
      `    try {\n` +
      `      const { data, error: fetchError } = await supabase\n` +
      `        .from('${name}s')\n` +
      `        .select('*')\n` +
      `        .eq('colony_id', colonyId)\n\n` +
      `      if (fetchError) throw fetchError\n` +
      `      if (data) setItems(data)\n` +
      `      setError(null)\n` +
      `    } catch (err) {\n` +
      `      setError(String(err))\n` +
      `    } finally {\n` +
      `      setLoading(false)\n` +
      `    }\n` +
      `  }, [colonyId])\n\n` +
      `  useEffect(() => { fetchItems() }, [fetchItems])\n\n` +
      `  return { items, loading, error, refetch: fetchItems }\n` +
      `}\n`
    ),

    // component
    [`components/game/${Name}Panel.tsx`]: (
      `'use client'\n\n` +
      `import type { ${Name}Row } from '@/domains/${name}/${name}.types'\n\n` +
      `interface ${Name}PanelProps {\n` +
      `  items: ${Name}Row[]\n` +
      `  loading: boolean\n` +
      `  error: string | null\n` +
      `}\n\n` +
      `export function ${Name}Panel({ items, loading, error }: ${Name}PanelProps) {\n` +
      `  if (loading) return <div className="p-4 text-gray-400">Загрузка...</div>\n` +
      `  if (error) return <div className="p-4 text-red-400">Ошибка: {error}</div>\n\n` +
      `  return (\n` +
      `    <div className="p-4">\n` +
      `      <h2 className="text-lg font-semibold mb-2">${Name}</h2>\n` +
      `      {items.length === 0 ? (\n` +
      `        <p className="text-gray-500">Нет данных</p>\n` +
      `      ) : (\n` +
      `        <ul className="space-y-1">\n` +
      `          {items.map((item) => (\n` +
      `            <li key={item.id} className="text-sm">{item.name}</li>\n` +
      `          ))}\n` +
      `        </ul>\n` +
      `      )}\n` +
      `    </div>\n` +
      `  )\n` +
      `}\n`
    ),
  }

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(SRC, filePath)
    if (existsSync(fullPath)) {
      console.log(`  SKIP ${filePath} — already exists`)
      continue
    }
    writeFileSync(fullPath, content)
    console.log(`  OK  ${filePath}`)
  }

  console.log()
  console.log(`Domain "${name}" created!`)
  console.log(`  1. Add table to supabase-schema.sql (${name})`)
  console.log(`  2. Run npx tsx scripts/generate-types.ts`)
  console.log(`  3. Wire ${Name}Panel into src/app/(game)/page.tsx`)
}

main()
