import { useEffect, useState } from 'react'
import { BarChart3, Bot, FileText, MessageSquare, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

interface DashboardStats {
  xhs_user_count: number
  note_count: number
  comment_count: number
  ai_comment_count: number
  setting_count: number
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(setStats)
      .catch(console.error)
  }, [])

  if (!stats) {
    return <div className="text-muted-foreground">Loading...</div>
  }

  const cards = [
    { label: 'XHS Users', count: stats.xhs_user_count, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Notes', count: stats.note_count, icon: FileText, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Comments', count: stats.comment_count, icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'AI Comments', count: stats.ai_comment_count, icon: Bot, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Settings', count: stats.setting_count, icon: BarChart3, color: 'text-gray-600', bg: 'bg-gray-50' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{card.count}</span>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
