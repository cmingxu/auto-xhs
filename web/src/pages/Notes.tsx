import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Button } from '../components/ui/button'

interface Note {
  note_id: string
  title: string
  content: string
  tags: string
  date: string
  url: string
  created_at: string
}

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])

  const load = () => {
    fetch('/api/notes')
      .then(r => r.json())
      .then(setNotes)
      .catch(console.error)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (noteID: string) => {
    await fetch(`/api/notes/${noteID}`, { method: 'DELETE' })
    load()
  }

  const renderTags = (tags: string) => {
    try {
      const arr = JSON.parse(tags)
      if (Array.isArray(arr)) {
        return arr.map((t: string, i: number) => (
          <span key={i} className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded mr-1 mb-1">
            {t}
          </span>
        ))
      }
    } catch {}
    return null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notes</h1>
        <span className="text-sm text-muted-foreground">{notes.length} total</span>
      </div>
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notes.map((n) => (
              <TableRow key={n.note_id}>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {n.url ? (
                    <a href={n.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      {n.title || '(no title)'}
                    </a>
                  ) : (n.title || '(no title)')}
                </TableCell>
                <TableCell className="max-w-[300px] truncate text-sm">
                  {n.content?.slice(0, 120) || '-'}
                </TableCell>
                <TableCell className="text-xs">{renderTags(n.tags)}</TableCell>
                <TableCell className="text-xs">{n.date || '-'}</TableCell>
                <TableCell className="text-xs">{new Date(n.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(n.note_id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {notes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No notes collected yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
