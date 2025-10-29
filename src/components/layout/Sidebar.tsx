'use client'

import { cn } from '@/lib/utils'
import { 
  Home, 
  Ticket, 
  Users, 
  Building2, 
  Settings, 
  BarChart3,
  Plus,
  Filter,
  BookOpen,
  Zap,
  Clock,
  UserCog,
  X,
  Tags,
  Bot,
  Bell,
  UserCheck, // Icon for assigned tickets
  Shield, // Icon for admin dashboard
  CheckSquare, // Icon for approvals
  Eye, // Icon for views
  Briefcase, // Icon for societies
  Globe // Icon for domain societies
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/Button'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  userRole?: 'user' | 'agent' | 'admin'
}

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: ('user' | 'agent' | 'admin')[]
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['user', 'agent', 'admin'] },
  { name: 'I miei ticket', href: '/tickets/my', icon: Ticket, roles: ['user', 'agent', 'admin'] },
  { name: 'Ticket clinica', href: '/tickets/clinic', icon: Building2, roles: ['user', 'agent', 'admin'] },
  { name: 'Viste', href: '/views', icon: Eye, roles: ['admin'] }, // 🔒 Solo admin
  { name: 'Assistente AI', href: '/agent', icon: Bot, roles: ['admin'] }, // 🔒 Solo admin
]

const agentNavigation: NavItem[] = [
  { name: 'Ticket Assegnati', href: '/tickets/assigned', icon: UserCheck, roles: ['agent', 'admin'] },
  { name: 'Categorie', href: '/categories', icon: Filter, roles: ['agent', 'admin'] },
  { name: 'Ticket da Gestire', href: '/dashboard/nudges', icon: Bell, roles: ['admin'] }, // 🔒 Solo admin
  { name: 'Trigger', href: '/automation/triggers', icon: Zap, roles: ['agent', 'admin'] },
  { name: 'Macro', href: '/automation/macros', icon: Zap, roles: ['agent', 'admin'] },
  { name: 'SLA Monitor', href: '/sla', icon: Clock, roles: ['agent', 'admin'] },
]

const adminNavigation: NavItem[] = [
  { name: 'Dashboard Admin', href: '/admin', icon: Shield, roles: ['admin'] },
  { name: 'Approvazioni', href: '/admin/approvals', icon: CheckSquare, roles: ['admin'] },
  { name: 'Gestione Utenti', href: '/users', icon: Users, roles: ['admin'] },
  { name: 'Gestione Viste', href: '/admin/views', icon: Eye, roles: ['admin'] },
  { name: 'Società', href: '/admin/societies', icon: Briefcase, roles: ['admin'] },
  { name: 'Domini Società', href: '/admin/domain-societies', icon: Globe, roles: ['admin'] },
  { name: 'Config. Ermes AI', href: '/admin/agent-config', icon: Bot, roles: ['admin'] },
  { name: 'Ruoli e Permessi', href: '/roles', icon: UserCog, roles: ['admin'] },
]

const quickActions: NavItem[] = [
  { name: 'Knowledge Base', href: '/kb', icon: BookOpen, roles: ['admin'] }, // 🔒 Solo admin
  // { name: 'Filtri salvati', href: '/filters', icon: Filter, roles: ['user', 'agent', 'admin'] }, // TODO: Da implementare
  { name: 'Ruoli e Permessi', href: '/roles', icon: UserCog, roles: ['agent', 'admin'] },
  // { name: 'Impostazioni', href: '/settings', icon: Settings, roles: ['user', 'agent', 'admin'] }, // TODO: Da implementare
]

export function Sidebar({ isOpen, onClose, userRole = 'user' }: SidebarProps) {
  const pathname = usePathname()
  
  const filterByRole = (items: NavItem[]) => {
    return items.filter(item => item.roles.includes(userRole))
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Ticket className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">
                HealthDesk
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="lg:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {/* Main Navigation */}
            <div className="space-y-1">
              {filterByRole(navigation).map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    )}
                    onClick={() => onClose()}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                )
              })}
            </div>

            {/* Agent Navigation */}
            {filterByRole(agentNavigation).length > 0 && (
              <div className="pt-6">
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Gestione
                </h3>
                <div className="mt-2 space-y-1">
                  {filterByRole(agentNavigation).map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        )}
                        onClick={() => onClose()}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Admin Navigation */}
            {filterByRole(adminNavigation).length > 0 && (
              <div className="pt-6">
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Amministrazione
                </h3>
                <div className="mt-2 space-y-1">
                  {filterByRole(adminNavigation).map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        )}
                        onClick={() => onClose()}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </nav>

          {/* Quick Actions */}
          <div className="border-t p-4">
            <Link href="/tickets/new" className="w-full mb-3 block">
              <Button className="w-full" size="sm" onClick={() => onClose()}>
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Ticket
              </Button>
            </Link>
            
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Accesso rapido
            </h3>
            <div className="space-y-1">
              {filterByRole(quickActions).map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  onClick={() => onClose()}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
