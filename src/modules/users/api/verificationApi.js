import { supabase } from '@/services/supabase'

// Verification API
export const verificationApi = {
  // Upload verification document
  uploadDocument: async (userId, documentType, file) => {
    // Upload file to storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/${documentType}_${Date.now()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage
      .from('verification-docs')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('verification-docs')
      .getPublicUrl(fileName)

    // Create database record
    const { data, error } = await supabase
      .from('verification_documents')
      .insert({
        user_id: userId,
        document_type: documentType,
        document_url: publicUrl
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Get user's verification documents
  getUserDocuments: async (userId) => {
    const { data, error } = await supabase
      .from('verification_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Get all pending documents (admin)
  getPendingDocuments: async () => {
    const { data, error } = await supabase
      .from('verification_documents')
      .select(`
        *,
        user:profiles!verification_documents_user_id_fkey(first_name, last_name, email, phone, role)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Review document (admin)
  reviewDocument: async (docId, status, adminNotes, adminId) => {
    const { data, error } = await supabase
      .from('verification_documents')
      .update({
        status,
        admin_notes: adminNotes,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', docId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update user verification status
  updateVerificationStatus: async (userId, isVerified) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        is_verified: isVerified,
        verification_status: isVerified ? 'verified' : 'rejected'
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }
}
