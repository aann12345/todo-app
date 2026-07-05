export type WorkspaceKind = 'personal' | 'family' | 'work'

export interface Profile {
  id: string
  display_name: string
  color: string
}

export interface Workspace {
  id: string
  name: string
  kind: WorkspaceKind
  created_by: string
}

export interface Member {
  user_id: string
  role: 'owner' | 'member'
  profile: Profile
}

export interface List {
  id: string
  workspace_id: string
  name: string
  emoji: string | null
  position: number
}

export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly'
  interval: number
  /** дни недели 0=вс … 6=сб, только для freq=weekly */
  byweekday?: number[]
}

export interface Task {
  id: string
  list_id: string
  workspace_id: string
  title: string
  notes: string
  due_date: string | null
  priority: 1 | 2 | 3 | 4
  assignee_id: string | null
  recurrence: Recurrence | null
  completed_at: string | null
  created_by: string
  position: number
  created_at: string
  assignee?: Profile | null
}

export interface Invite {
  id: string
  workspace_id: string
  code: string
  expires_at: string
}
