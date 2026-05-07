import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Button } from '../components/ui/button'

interface Comment {
  comment_id: string
  note_id: string
  content: string
  nickname: string
  like_count: string
  ip_location: string
  create_time: number
  created_at: string
}

export function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([])

  const load = () => {
    fetch('/api/comments')
      .then(r => r.json())
      .then(setComments)
      .catch(console.error)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (commentID: string) => {
    await fetch(`/api/comments/${commentID}`, { method: 'DELETE' })
    load()
  }

  const formatTime = (ts: number) => {
    if (!ts) return '-'
    return new Date(ts * 1000).toLocaleDateString()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Comments</h1>
        <span className="text-sm text-muted-foreground">{comments.length} total</span>
      </div>
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Content</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Note ID</TableHead>
              <TableHead>Likes</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Posted</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comments.map((c) => (
              <TableRow key={c.comment_id}>
                <TableCell className="max-w-[300px] truncate text-sm">{c.content || '-'}</TableCell>
                <TableCell className="font-medium">{c.nickname || '-'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.note_id}</TableCell>
                <TableCell>{c.like_count}</TableCell>
                <TableCell>{c.ip_location || '-'}</TableCell>
                <TableCell className="text-xs">{formatTime(c.create_time)}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(c.comment_id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {comments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No comments collected yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
