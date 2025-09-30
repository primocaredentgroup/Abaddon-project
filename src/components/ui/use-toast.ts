import { useToast as useToastInternal } from './Toast'

export const useToast = () => {
  const { addToast } = useToastInternal()
  
  return {
    toast: ({ title, description, variant }: { 
      title: string
      description?: string
      variant?: 'default' | 'destructive' 
    }) => {
      const type = variant === 'destructive' ? 'error' : 'success'
      addToast({
        type,
        title,
        message: description,
      })
    }
  }
}

export const toast = (options: { 
  title: string
  description?: string
  variant?: 'default' | 'destructive' 
}) => {
  // This is a fallback for components that might import toast directly
  console.warn('Direct toast import is deprecated, use useToast hook instead')
}
