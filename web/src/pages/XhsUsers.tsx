import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Button } from '../components/ui/button'

interface XhsUser {
  user_id: string
  nickname: string
  desc: string
  follows: string
  fans: string
  interaction: string
  created_at: string
}

export function XhsUsersPage() {
  const [users, setUsers] = useState<XhsUser[]>([])

  const load = () => {
    fetch('/api/xhs-users')
      .then(r => r.json())
      .then(setUsers)
      .catch(console.error)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (userID: string) => {
    await fetch(`/api/xhs-users/${userID}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">XHS Users</h1>
        <span className="text-sm text-muted-foreground">{users.length} total</span>
      </div>
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nickname</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Follows</TableHead>
              <TableHead>Fans</TableHead>
              <TableHead>Interaction</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.user_id}>
                <TableCell className="font-medium">{u.nickname || '-'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.user_id}</TableCell>
                <TableCell>{u.follows}</TableCell>
                <TableCell>{u.fans}</TableCell>
                <TableCell>{u.interaction}</TableCell>
                <TableCell className="text-xs">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(u.user_id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No users collected yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
