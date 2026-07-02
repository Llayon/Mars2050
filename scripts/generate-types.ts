/**
 * Generate TypeScript types from supabase-schema.sql.
 * Parses CREATE TABLE statements and generates Database interface.
 * Usage: npx tsx scripts/generate-types.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const SCHEMA_PATH = join(__dirname, '..', 'supabase-schema.sql')
const OUTPUT_PATH = join(__dirname, '..', 'src', 'types', 'database.ts')

interface ColumnDef {
  name: string
  type: string
  nullable: boolean
  isPrimary: boolean
  isArray: boolean
  enumValues?: string[]
}

interface TableDef {
  name: string
  columns: ColumnDef[]
}

function parseSql(sql: string): TableDef[] {
  const tables: TableDef[] = []
  const tableRegex = /create\s+table\s+public\.(\w+)\s*\(([\s\S]*?)\);/gi
  let match: RegExpExecArray | null

  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1]
    const columnsBlock = match[2]
    const columns: ColumnDef[] = []

    const lines = columnsBlock.split('\n')
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith('--') || line.startsWith('constraint') || line.startsWith('unique') || line.startsWith('primary key') || line.startsWith('foreign key') || line.startsWith('check') || line.startsWith('create index') || line.startsWith('alter table')) continue

      const parts = line.split(/\s+/)
      if (parts.length < 2) continue

      const name = parts[0]
      if (name.startsWith('--') || name === '') continue

      let type = parts[1].toLowerCase()
      const isArray = type.endsWith('[]')
      if (isArray) type = type.slice(0, -2)

      let enumValues: string[] | undefined
      const checkMatch = line.match(/check\s*\((\w+)\s+in\s+\(([^)]+)\)\)/)
      if (checkMatch) {
        enumValues = checkMatch[2].split(',').map(v => v.trim().replace(/'/g, ''))
      }

      const nullable = line.toLowerCase().includes('default') || (!line.toLowerCase().includes('not null') && !line.toLowerCase().includes('primary key'))
      const isPrimary = line.toLowerCase().includes('primary key')

      columns.push({ name, type, nullable, isPrimary, isArray, enumValues })
    }

    tables.push({ name: tableName, columns })
  }

  return tables
}

function toTsType(sqlType: string): string {
  const map: Record<string, string> = {
    'uuid': 'string',
    'text': 'string',
    'integer': 'number',
    'bigint': 'number',
    'numeric': 'number',
    'boolean': 'boolean',
    'jsonb': 'Record<string, unknown>',
    'timestamp': 'string',
    'timestamp with time zone': 'string',
    'timestamp without time zone': 'string',
    'time with time zone': 'string',
    'time without time zone': 'string',
    'date': 'string',
  }
  return map[sqlType] || 'string'
}

function toCamelCase(name: string): string {
  return name.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function toPascalCase(name: string): string {
  const camel = toCamelCase(name)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

function getEnumName(table: TableDef, column: ColumnDef): string {
  const tableName = toPascalCase(table.name)
  const enumCount = table.columns.filter(col => col.enumValues && col.enumValues.length > 0).length
  return enumCount > 1 ? `${tableName}${toPascalCase(column.name)}Type` : `${tableName}Type`
}

function generate(tables: TableDef[]): string {
  const lines: string[] = [
    '// Auto-generated from supabase-schema.sql',
    '// Run `npx tsx scripts/generate-types.ts` to regenerate',
    '',
    'export interface Database {',
    '  public: {',
    '    Tables: {',
  ]

  for (const table of tables) {
    lines.push(`      ${table.name}: {`)
    lines.push(`        Row: {`)

    for (const col of table.columns) {
      const tsType = col.isArray ? `${toTsType(col.type)}[]` : toTsType(col.type)
      const optional = col.nullable ? '?' : ''
      const typeRef = col.enumValues ? getEnumName(table, col) : tsType
      lines.push(`          ${col.name}${optional}: ${typeRef}`)
    }

    lines.push(`        }`)
    lines.push(`        Insert: {`)
    for (const col of table.columns) {
      if (col.isPrimary || col.name === 'created_at' || col.name === 'updated_at') continue
      const tsType = col.isArray ? `${toTsType(col.type)}[]` : toTsType(col.type)
      const optional = col.nullable ? '?' : ''
      const typeRef = col.enumValues ? getEnumName(table, col) : tsType
      lines.push(`          ${col.name}${optional}: ${typeRef}`)
    }
    lines.push(`        }`)

    lines.push(`        Update: {`)
    for (const col of table.columns) {
      if (col.isPrimary) continue
      const tsType = col.isArray ? `${toTsType(col.type)}[]` : toTsType(col.type)
      const typeRef = col.enumValues ? getEnumName(table, col) : tsType
      lines.push(`          ${col.name}?: ${typeRef}`)
    }
    lines.push(`        }`)
    lines.push(`      }`)
  }

  lines.push('    }')
  lines.push('  }')
  lines.push('}')
  lines.push('')

  // Generate enum types
  const seenEnums = new Set<string>()
  for (const table of tables) {
    for (const col of table.columns) {
      if (col.enumValues && col.enumValues.length > 0) {
        const enumName = getEnumName(table, col)
        if (seenEnums.has(enumName)) continue
        seenEnums.add(enumName)
        lines.push(`export type ${enumName} = ${col.enumValues.map(v => `'${v}'`).join(' | ')}`)
      }
    }
  }

  return lines.join('\n')
}

// Main
const sql = readFileSync(SCHEMA_PATH, 'utf-8')
const tables = parseSql(sql)
const output = generate(tables)
writeFileSync(OUTPUT_PATH, output)
console.log(`✅ Generated types for ${tables.length} tables → ${OUTPUT_PATH}`)
