import { getServerClient } from '@/domains/resource/resource.server'

interface LeaderboardEntry {
  rank: number
  colonyId: string
  colonyName: string
  playerName: string
  level: number
  experience: number
  totalResources: number
  score: number
}

/**
 * Get leaderboard sorted by score (experience + resources/100).
 * @returns Leaderboard entries with rank, colony name, score
 */
export async function getLeaderboard(): Promise<{ leaderboard: LeaderboardEntry[]; error?: string }> {
  const supabase = getServerClient()

  const { data: colonies, error } = await supabase
    .from('colonies')
    .select('id, name, level, experience, user_id')
    .order('experience', { ascending: false })
    .limit(100)

  if (error || !colonies) {
    return { leaderboard: [], error: error?.message }
  }

  const userIds = colonies
    .map((colony: Record<string, unknown>) => colony.user_id)
    .filter((userId): userId is string => typeof userId === 'string')
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, username').in('id', userIds)
    : { data: [] }
  const profileNames = new Map(
    profiles?.map((profile: Record<string, unknown>) => [
      String(profile.id),
      typeof profile.username === 'string' ? profile.username : 'Unknown'
    ]) ?? []
  )

  const leaderboard = await Promise.all(
    colonies.map(async (colony: Record<string, unknown>) => {
      const { data: resources } = await supabase
        .from('resources')
        .select('amount')
        .eq('colony_id', colony.id as string)

      const totalResources = resources?.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.amount), 0) || 0
      const experience = Number(colony.experience) || 0
      const userId = typeof colony.user_id === 'string' ? colony.user_id : ''

      return {
        colonyId: colony.id as string,
        colonyName: colony.name as string,
        playerName: profileNames.get(userId) || 'Unknown',
        level: Number(colony.level) || 1,
        experience,
        totalResources,
        score: experience + Math.floor(totalResources / 100)
      }
    })
  )

  leaderboard.sort((a, b) => b.score - a.score)

  return {
    leaderboard: leaderboard.map((entry, index) => ({ rank: index + 1, ...entry }))
  }
}
