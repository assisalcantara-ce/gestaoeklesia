'use client'

import { useState, useRef } from 'react'
import { authenticatedFetch } from '@/lib/api-client'

interface UseCsvImportOptions {
  fetchMinisterios: () => void
}

export function useCsvImport({ fetchMinisterios }: UseCsvImportOptions) {
  const [showImport, setShowImport] = useState(false)
  const [importMinistryId, setImportMinistryId] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importRows, setImportRows] = useState<Record<string, string>[]>([])
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{
    inserted: number
    skipped: number
    total_rows: number
    ministry_name: string
    errors: { row: number; name: string; reason: string }[]
  } | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  const downloadTemplate = async () => {
    const response = await authenticatedFetch('/api/v1/admin/import-members')
    if (!response.ok) return
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo_importacao_membros.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = (file: File) => {
    setImportFile(file)
    setImportResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
      if (lines.length < 2) {
        setImportRows([])
        setImportHeaders([])
        return
      }
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase())
      setImportHeaders(headers)
      const rows: Record<string, string>[] = []
      for (let i = 1; i < lines.length && i <= 200; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const cols: string[] = []
        let current = ''
        let inQ = false
        for (const ch of line) {
          if (ch === '"') {
            inQ = !inQ
          } else if (ch === ',' && !inQ) {
            cols.push(current.trim())
            current = ''
          } else {
            current += ch
          }
        }
        cols.push(current.trim())
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => {
          row[h] = (cols[idx] ?? '').replace(/^"|"$/g, '')
        })
        rows.push(row)
      }
      setImportRows(rows)
    }
    reader.readAsText(file, 'utf-8')
  }

  const doImport = async () => {
    if (!importFile || !importMinistryId) return
    setImportLoading(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      fd.append('ministry_id', importMinistryId)
      const response = await authenticatedFetch('/api/v1/admin/import-members', {
        method: 'POST',
        body: fd,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao importar')
      setImportResult(data)
      fetchMinisterios()
    } catch (err: any) {
      setImportResult({
        inserted: 0,
        skipped: 0,
        total_rows: 0,
        ministry_name: '',
        errors: [{ row: 0, name: '', reason: err.message }],
      })
    } finally {
      setImportLoading(false)
    }
  }

  return {
    showImport,
    setShowImport,
    importMinistryId,
    setImportMinistryId,
    importFile,
    setImportFile,
    importRows,
    setImportRows,
    importHeaders,
    setImportHeaders,
    importLoading,
    importResult,
    setImportResult,
    importFileRef,
    downloadTemplate,
    handleImportFile,
    doImport,
  }
}
