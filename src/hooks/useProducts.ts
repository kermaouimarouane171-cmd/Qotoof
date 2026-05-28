import { useQuery } from '@tanstack/react-query'
import { fetchAvailableRegions, fetchProductById, fetchProducts } from '@/api/productsApi'

export const productsQueryKey = (filters) => ['products', filters]
export const productQueryKey = (id) => ['product', id]

export const useProducts = (filters) => {
  return useQuery({
    queryKey: productsQueryKey(filters),
    queryFn: () => fetchProducts(filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })
}

export const useAvailableRegions = () => {
  return useQuery({
    queryKey: ['products', 'regions'],
    queryFn: fetchAvailableRegions,
    staleTime: 30 * 60 * 1000,
  })
}

export const useProductById = (id) => {
  return useQuery({
    queryKey: productQueryKey(id),
    queryFn: () => fetchProductById(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  })
}
