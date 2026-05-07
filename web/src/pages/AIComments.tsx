import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Button } from '../components/ui/button'

interface AIComment {
  comment_id: string
  note_title: string
  note_content: string
  comment: string
  note_url: string
  created_at: string
}

export function AICommentsPage() {
  const [comments, setComments] = useState<AIComment[]>([])

  const load = () => {
    fetch('/api/ai-comments')
      .then(r => r.json())
      .then(setComments)
      .catch(console.error)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (commentID: string) => {
    await fetch(`/api/ai-comments/${commentID}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">AI Comments</h1>
        <span className="text-sm text-muted-foreground">{comments.length} total</span>
      </div>
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Note Title</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Note URL</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comments.map((c) => (
              <TableRow key={c.comment_id}>
                <TableCell className="font-medium max-w-[200px] truncate">{c.note_title || '-'}</TableCell>
                <TableCell className="max-w-[300px] truncate text-sm">{c.comment}</TableCell>
                <TableCell className="max-w-[150px] truncate text-xs">
                  {c.note_url ? (
                    <a href={c.note_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      Link
                    </a>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(c.comment_id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {comments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No AI comments generated yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
