import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

interface UseVisibilitySettingsOptions {
  clinicId?: string
}

interface VisibilitySettings {
  allowPublicTickets: boolean
  requireApprovalForCategories: boolean
  defaultSlaHours: number
}

interface UseVisibilitySettingsReturn {
  settings: VisibilitySettings | undefined
  isLoading: boolean
  canCreatePublicTickets: boolean
  updateSettings: (updates: Partial<VisibilitySettings>) => Promise<void>
  togglePublicTickets: (enabled: boolean) => Promise<void>
  refresh: () => void
}

export function useVisibilitySettings(
  options: UseVisibilitySettingsOptions = {}
): UseVisibilitySettingsReturn {
  const { clinicId } = options

  // Queries
  const settings = useQuery(
    api.clinics?.getVisibilitySettings,
    clinicId ? { clinicId: clinicId as any } : {}
  )

  const canCreatePublicTickets = useQuery(
    api.clinics?.arePublicTicketsAllowed,
    clinicId ? { clinicId: clinicId as any } : {}
  )

  // Mutations
  const updateSettingsMutation = useMutation(api.clinics?.updateVisibilitySettings)
  const togglePublicTicketsMutation = useMutation(api.clinics?.togglePublicTickets)

  const isLoading = settings === undefined

  const updateSettings = async (updates: Partial<VisibilitySettings>) => {
    await updateSettingsMutation({
      clinicId: clinicId as any,
      ...updates,
    })
  }

  const togglePublicTickets = async (enabled: boolean) => {
    await togglePublicTicketsMutation({
      clinicId: clinicId as any,
      enabled,
    })
  }

  const refresh = () => {
    // Convex automatically refreshes queries, but this can be used for manual refresh
    // if needed in the future
  }

  return {
    settings,
    isLoading,
    canCreatePublicTickets: canCreatePublicTickets ?? false,
    updateSettings,
    togglePublicTickets,
    refresh,
  }
}


