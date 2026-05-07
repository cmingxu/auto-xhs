import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

interface Setting {
  id: number
  key: string
  value: string
  updated_at: string
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [editKey, setEditKey] = useState('')
  const [editValue, setEditValue] = useState('')
  const [adding, setAdding] = useState(false)

  const load = () => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(setSettings)
      .catch(console.error)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!editKey.trim()) return
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: editKey.trim(), value: editValue }),
    })
    setAdding(false)
    setEditKey('')
    setEditValue('')
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Button onClick={() => setAdding(!adding)}>
          {adding ? 'Cancel' : 'Add Setting'}
        </Button>
      </div>

      {adding && (
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Key"
            value={editKey}
            onChange={(e) => setEditKey(e.target.value)}
            className="max-w-[200px]"
          />
          <Input
            placeholder="Value"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleSave}>Save</Button>
        </div>
      )}

      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settings.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.key}</TableCell>
                <TableCell className="max-w-[400px] truncate text-sm">{s.value}</TableCell>
                <TableCell className="text-xs">{new Date(s.updated_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {settings.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No settings configured yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
