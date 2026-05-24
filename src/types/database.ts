/* eslint-disable @typescript-eslint/consistent-type-definitions */
// Auto-generated from SQL migrations. Update by re-running generator when schema changes.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type TableDef<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
}

export type Database = {
  public: {
    Tables: {
      active_sessions: TableDef<{
        created_at: string | null
        device_fingerprint: string
        device_info: Json | null
        device_name: string | null
        expires_at: string | null
        id: string
        ip_address: string | null
        is_active: boolean | null
        is_current: boolean | null
        is_revoked: boolean | null
        last_active: string | null
        location: string | null
        location_data: Json | null
        session_id: string
        session_token: string
        user_agent: string | null
        user_id: string
      }, {
        created_at?: string | null
        device_fingerprint: string
        device_info?: Json | null
        device_name?: string | null
        expires_at?: string | null
        id?: string | null
        ip_address?: string | null
        is_active?: boolean | null
        is_current?: boolean | null
        is_revoked?: boolean | null
        last_active?: string | null
        location?: string | null
        location_data?: Json | null
        session_id: string
        session_token: string
        user_agent?: string | null
        user_id: string
      }, {
        created_at?: string | null
        device_fingerprint?: string | null
        device_info?: Json | null
        device_name?: string | null
        expires_at?: string | null
        id?: string | null
        ip_address?: string | null
        is_active?: boolean | null
        is_current?: boolean | null
        is_revoked?: boolean | null
        last_active?: string | null
        location?: string | null
        location_data?: Json | null
        session_id?: string | null
        session_token?: string | null
        user_agent?: string | null
        user_id?: string | null
      }>
      addresses: TableDef<{
        address: string
        city: string
        country: string | null
        created_at: string | null
        id: string
        is_default: boolean | null
        label: string
        latitude: number | null
        longitude: number | null
        updated_at: string | null
        user_id: string
      }, {
        address: string
        city: string
        country?: string | null
        created_at?: string | null
        id?: string | null
        is_default?: boolean | null
        label: string
        latitude?: number | null
        longitude?: number | null
        updated_at?: string | null
        user_id: string
      }, {
        address?: string | null
        city?: string | null
        country?: string | null
        created_at?: string | null
        id?: string | null
        is_default?: boolean | null
        label?: string | null
        latitude?: number | null
        longitude?: number | null
        updated_at?: string | null
        user_id?: string | null
      }>
      audit_logs: TableDef<{
        action: string
        changes: Json | null
        created_at: string | null
        details: Json | null
        device_fingerprint: string | null
        entity_id: string | null
        entity_type: string
        id: string
        ip_address: string | null
        metadata: Json | null
        new_data: Json | null
        new_values: Json | null
        old_data: Json | null
        old_values: Json | null
        resource_id: string | null
        resource_type: string
        session_id: string | null
        severity: string | null
        signature: string
        timestamp: string | null
        user_agent: string | null
        user_id: string
      }, {
        action: string
        changes?: Json | null
        created_at?: string | null
        details?: Json | null
        device_fingerprint?: string | null
        entity_id?: string | null
        entity_type: string
        id?: string | null
        ip_address?: string | null
        metadata?: Json | null
        new_data?: Json | null
        new_values?: Json | null
        old_data?: Json | null
        old_values?: Json | null
        resource_id?: string | null
        resource_type: string
        session_id?: string | null
        severity?: string | null
        signature: string
        timestamp?: string | null
        user_agent?: string | null
        user_id: string
      }, {
        action?: string | null
        changes?: Json | null
        created_at?: string | null
        details?: Json | null
        device_fingerprint?: string | null
        entity_id?: string | null
        entity_type?: string | null
        id?: string | null
        ip_address?: string | null
        metadata?: Json | null
        new_data?: Json | null
        new_values?: Json | null
        old_data?: Json | null
        old_values?: Json | null
        resource_id?: string | null
        resource_type?: string | null
        session_id?: string | null
        severity?: string | null
        signature?: string | null
        timestamp?: string | null
        user_agent?: string | null
        user_id?: string | null
      }>
      bank_accounts: TableDef<{
        account_holder: string
        account_holder_name: string
        account_number: string
        bank_name: string
        created_at: string | null
        iban: string | null
        id: string
        is_verified: boolean | null
        rib: string
        updated_at: string | null
        user_id: string | null
        vendor_id: string
      }, {
        account_holder: string
        account_holder_name: string
        account_number: string
        bank_name: string
        created_at?: string | null
        iban?: string | null
        id?: string | null
        is_verified?: boolean | null
        rib: string
        updated_at?: string | null
        user_id?: string | null
        vendor_id: string
      }, {
        account_holder?: string | null
        account_holder_name?: string | null
        account_number?: string | null
        bank_name?: string | null
        created_at?: string | null
        iban?: string | null
        id?: string | null
        is_verified?: boolean | null
        rib?: string | null
        updated_at?: string | null
        user_id?: string | null
        vendor_id?: string | null
      }>
      blocked_ips: TableDef<{
        block_type: string
        blocked_at: string | null
        blocked_by: string | null
        created_at: string | null
        expires_at: string | null
        id: string
        ip_address: string
        is_active: boolean | null
        reason: string
        updated_at: string | null
      }, {
        block_type?: string | null
        blocked_at?: string | null
        blocked_by?: string | null
        created_at?: string | null
        expires_at?: string | null
        id?: string | null
        ip_address: string
        is_active?: boolean | null
        reason: string
        updated_at?: string | null
      }, {
        block_type?: string | null
        blocked_at?: string | null
        blocked_by?: string | null
        created_at?: string | null
        expires_at?: string | null
        id?: string | null
        ip_address?: string | null
        is_active?: boolean | null
        reason?: string | null
        updated_at?: string | null
      }>
      cancellation_log: TableDef<{
        buyer_id: string | null
        cancellation_reason: string | null
        cancelled_at: string
        cancelled_by: string | null
        created_at: string
        id: string
        metadata: Json
        order_id: string
        requested_at: string | null
        updated_at: string
        vendor_id: string | null
      }, {
        buyer_id?: string | null
        cancellation_reason?: string | null
        cancelled_at?: string | null
        cancelled_by?: string | null
        created_at?: string | null
        id?: string | null
        metadata?: Json | null
        order_id: string
        requested_at?: string | null
        updated_at?: string | null
        vendor_id?: string | null
      }, {
        buyer_id?: string | null
        cancellation_reason?: string | null
        cancelled_at?: string | null
        cancelled_by?: string | null
        created_at?: string | null
        id?: string | null
        metadata?: Json | null
        order_id?: string | null
        requested_at?: string | null
        updated_at?: string | null
        vendor_id?: string | null
      }>
      checkout_requests: TableDef<{
        buyer_id: string
        completed_at: string | null
        created_at: string
        error_message: string | null
        id: string
        idempotency_key: string
        last_seen_at: string
        order_ids: string[]
        payload_snapshot: Json
        request_hash: string | null
        response_payload: Json | null
        status: string
        updated_at: string
      }, {
        buyer_id: string
        completed_at?: string | null
        created_at?: string | null
        error_message?: string | null
        id?: string | null
        idempotency_key: string
        last_seen_at?: string | null
        order_ids?: string[] | null
        payload_snapshot?: Json | null
        request_hash?: string | null
        response_payload?: Json | null
        status?: string | null
        updated_at?: string | null
      }, {
        buyer_id?: string | null
        completed_at?: string | null
        created_at?: string | null
        error_message?: string | null
        id?: string | null
        idempotency_key?: string | null
        last_seen_at?: string | null
        order_ids?: string[] | null
        payload_snapshot?: Json | null
        request_hash?: string | null
        response_payload?: Json | null
        status?: string | null
        updated_at?: string | null
      }>
      city_distances: TableDef<{
        created_at: string | null
        distance_km: number
        estimated_hours: number | null
        from_city: string
        highway: boolean | null
        id: string
        to_city: string
      }, {
        created_at?: string | null
        distance_km: number
        estimated_hours?: number | null
        from_city: string
        highway?: boolean | null
        id?: string | null
        to_city: string
      }, {
        created_at?: string | null
        distance_km?: number | null
        estimated_hours?: number | null
        from_city?: string | null
        highway?: boolean | null
        id?: string | null
        to_city?: string | null
      }>
      commission_notifications: TableDef<{
        id: string
        monthly_sale_id: string | null
        read_at: string | null
        sent_at: string | null
        type: string
        vendor_id: string | null
      }, {
        id?: string | null
        monthly_sale_id?: string | null
        read_at?: string | null
        sent_at?: string | null
        type: string
        vendor_id?: string | null
      }, {
        id?: string | null
        monthly_sale_id?: string | null
        read_at?: string | null
        sent_at?: string | null
        type?: string | null
        vendor_id?: string | null
      }>
      comparison_lists: TableDef<{
        created_at: string | null
        id: string
        product_id: string
        user_id: string
      }, {
        created_at?: string | null
        id?: string | null
        product_id: string
        user_id: string
      }, {
        created_at?: string | null
        id?: string | null
        product_id?: string | null
        user_id?: string | null
      }>
      confirmed_transactions: TableDef<{
        buyer_id: string | null
        commission_amount: number | null
        confirmed_at: string | null
        id: string
        month: number
        monthly_sale_id: string | null
        order_id: string | null
        sale_amount: number
        vendor_id: string | null
        year: number
      }, {
        buyer_id?: string | null
        commission_amount?: number | null
        confirmed_at?: string | null
        id?: string | null
        month: number
        monthly_sale_id?: string | null
        order_id?: string | null
        sale_amount: number
        vendor_id?: string | null
        year: number
      }, {
        buyer_id?: string | null
        commission_amount?: number | null
        confirmed_at?: string | null
        id?: string | null
        month?: number | null
        monthly_sale_id?: string | null
        order_id?: string | null
        sale_amount?: number | null
        vendor_id?: string | null
        year?: number | null
      }>
      contact_messages: TableDef<{
        created_at: string | null
        email: string
        id: string
        message: string
        name: string
        status: string | null
        subject: string
        user_id: string | null
      }, {
        created_at?: string | null
        email: string
        id?: string | null
        message: string
        name: string
        status?: string | null
        subject: string
        user_id?: string | null
      }, {
        created_at?: string | null
        email?: string | null
        id?: string | null
        message?: string | null
        name?: string | null
        status?: string | null
        subject?: string | null
        user_id?: string | null
      }>
      conversation_participants: TableDef<{
        conversation_id: string
        id: string
        is_admin: boolean | null
        joined_at: string | null
        last_read_at: string | null
        user_id: string
      }, {
        conversation_id: string
        id?: string | null
        is_admin?: boolean | null
        joined_at?: string | null
        last_read_at?: string | null
        user_id: string
      }, {
        conversation_id?: string | null
        id?: string | null
        is_admin?: boolean | null
        joined_at?: string | null
        last_read_at?: string | null
        user_id?: string | null
      }>
      conversations: TableDef<{
        created_at: string | null
        created_by: string
        id: string
        is_active: boolean | null
        last_message: string | null
        last_message_at: string | null
        title: string | null
        type: string
        updated_at: string | null
      }, {
        created_at?: string | null
        created_by: string
        id?: string | null
        is_active?: boolean | null
        last_message?: string | null
        last_message_at?: string | null
        title?: string | null
        type?: string | null
        updated_at?: string | null
      }, {
        created_at?: string | null
        created_by?: string | null
        id?: string | null
        is_active?: boolean | null
        last_message?: string | null
        last_message_at?: string | null
        title?: string | null
        type?: string | null
        updated_at?: string | null
      }>
      coupon_redemptions: TableDef<{
        coupon_id: string
        created_at: string | null
        discount_amount: number
        discount_percentage: Json | null
        id: string
        metadata: Json
        order_id: string | null
        redeemed_at: string | null
        user_id: string
        vendor_id: string | null
      }, {
        coupon_id: string
        created_at?: string | null
        discount_amount: number
        discount_percentage?: Json | null
        id?: string | null
        metadata?: Json | null
        order_id?: string | null
        redeemed_at?: string | null
        user_id: string
        vendor_id?: string | null
      }, {
        coupon_id?: string | null
        created_at?: string | null
        discount_amount?: number | null
        discount_percentage?: Json | null
        id?: string | null
        metadata?: Json | null
        order_id?: string | null
        redeemed_at?: string | null
        user_id?: string | null
        vendor_id?: string | null
      }>
      coupons: TableDef<{
        applies_to: string
        code: string
        created_at: string | null
        description: string | null
        discount_type: string
        discount_value: number
        expires_at: string | null
        id: string
        is_active: boolean | null
        max_uses: number | null
        max_uses_per_user: number | null
        metadata: Json
        min_order_amount: number | null
        minimum_quantity: Json | null
        starts_at: string | null
        title: string | null
        updated_at: string | null
        used_count: number | null
        valid_from: string | null
        valid_until: string | null
        vendor_id: string | null
      }, {
        applies_to?: string | null
        code: string
        created_at?: string | null
        description?: string | null
        discount_type?: string | null
        discount_value: number
        expires_at?: string | null
        id?: string | null
        is_active?: boolean | null
        max_uses?: number | null
        max_uses_per_user?: number | null
        metadata?: Json | null
        min_order_amount?: number | null
        minimum_quantity?: Json | null
        starts_at?: string | null
        title?: string | null
        updated_at?: string | null
        used_count?: number | null
        valid_from?: string | null
        valid_until?: string | null
        vendor_id?: string | null
      }, {
        applies_to?: string | null
        code?: string | null
        created_at?: string | null
        description?: string | null
        discount_type?: string | null
        discount_value?: number | null
        expires_at?: string | null
        id?: string | null
        is_active?: boolean | null
        max_uses?: number | null
        max_uses_per_user?: number | null
        metadata?: Json | null
        min_order_amount?: number | null
        minimum_quantity?: Json | null
        starts_at?: string | null
        title?: string | null
        updated_at?: string | null
        used_count?: number | null
        valid_from?: string | null
        valid_until?: string | null
        vendor_id?: string | null
      }>
      deliveries: TableDef<{
        accepted_at: string | null
        actual_delivery_time: string | null
        assigned_at: string | null
        broadcast_ended_at: string | null
        broadcast_started_at: string | null
        broadcast_status: string | null
        buyer_id: string | null
        buyer_name_received: string | null
        buyer_signature_url: string | null
        cargo_size: string | null
        condition_summary: Json | null
        created_at: string | null
        current_latitude: number | null
        current_longitude: number | null
        deleted_at: string | null
        delivered_at: string | null
        delivery_address: string | null
        delivery_condition: string | null
        delivery_distance_km: Json | null
        delivery_latitude: number | null
        delivery_longitude: number | null
        delivery_number: string
        delivery_photo_url: string | null
        delivery_proof_url: string | null
        driver_id: string | null
        driver_notes: string | null
        estimated_delivery_time: string | null
        id: string
        is_fragile: boolean | null
        is_late: boolean | null
        last_broadcast_at: string | null
        last_location_update: string | null
        late_reason: string | null
        legal_dropoff_verified_at: string | null
        legal_pickup_verified_at: string | null
        order_id: string
        picked_up_at: string | null
        pickup_address: string | null
        pickup_condition: string | null
        pickup_latitude: number | null
        pickup_longitude: number | null
        pickup_photo_url: string | null
        preferred_driver_id: string | null
        route_snapshot: Json | null
        signature_url: string | null
        special_instructions: string | null
        status: 'unassigned' | 'assigned' | 'accepted' | 'picked_up' | 'on_the_way' | 'delivered' | 'failed' | null
        temperature_sensitive: boolean | null
        tracking_compliance: boolean | null
        tracking_ended_at: string | null
        tracking_started_at: string | null
        updated_at: string | null
        vendor_id: string | null
      }, {
        accepted_at?: string | null
        actual_delivery_time?: string | null
        assigned_at?: string | null
        broadcast_ended_at?: string | null
        broadcast_started_at?: string | null
        broadcast_status?: string | null
        buyer_id?: string | null
        buyer_name_received?: string | null
        buyer_signature_url?: string | null
        cargo_size?: string | null
        condition_summary?: Json | null
        created_at?: string | null
        current_latitude?: number | null
        current_longitude?: number | null
        deleted_at?: string | null
        delivered_at?: string | null
        delivery_address?: string | null
        delivery_condition?: string | null
        delivery_distance_km?: Json | null
        delivery_latitude?: number | null
        delivery_longitude?: number | null
        delivery_number: string
        delivery_photo_url?: string | null
        delivery_proof_url?: string | null
        driver_id?: string | null
        driver_notes?: string | null
        estimated_delivery_time?: string | null
        id?: string | null
        is_fragile?: boolean | null
        is_late?: boolean | null
        last_broadcast_at?: string | null
        last_location_update?: string | null
        late_reason?: string | null
        legal_dropoff_verified_at?: string | null
        legal_pickup_verified_at?: string | null
        order_id: string
        picked_up_at?: string | null
        pickup_address?: string | null
        pickup_condition?: string | null
        pickup_latitude?: number | null
        pickup_longitude?: number | null
        pickup_photo_url?: string | null
        preferred_driver_id?: string | null
        route_snapshot?: Json | null
        signature_url?: string | null
        special_instructions?: string | null
        status?: 'unassigned' | 'assigned' | 'accepted' | 'picked_up' | 'on_the_way' | 'delivered' | 'failed' | null
        temperature_sensitive?: boolean | null
        tracking_compliance?: boolean | null
        tracking_ended_at?: string | null
        tracking_started_at?: string | null
        updated_at?: string | null
        vendor_id?: string | null
      }, {
        accepted_at?: string | null
        actual_delivery_time?: string | null
        assigned_at?: string | null
        broadcast_ended_at?: string | null
        broadcast_started_at?: string | null
        broadcast_status?: string | null
        buyer_id?: string | null
        buyer_name_received?: string | null
        buyer_signature_url?: string | null
        cargo_size?: string | null
        condition_summary?: Json | null
        created_at?: string | null
        current_latitude?: number | null
        current_longitude?: number | null
        deleted_at?: string | null
        delivered_at?: string | null
        delivery_address?: string | null
        delivery_condition?: string | null
        delivery_distance_km?: Json | null
        delivery_latitude?: number | null
        delivery_longitude?: number | null
        delivery_number?: string | null
        delivery_photo_url?: string | null
        delivery_proof_url?: string | null
        driver_id?: string | null
        driver_notes?: string | null
        estimated_delivery_time?: string | null
        id?: string | null
        is_fragile?: boolean | null
        is_late?: boolean | null
        last_broadcast_at?: string | null
        last_location_update?: string | null
        late_reason?: string | null
        legal_dropoff_verified_at?: string | null
        legal_pickup_verified_at?: string | null
        order_id?: string | null
        picked_up_at?: string | null
        pickup_address?: string | null
        pickup_condition?: string | null
        pickup_latitude?: number | null
        pickup_longitude?: number | null
        pickup_photo_url?: string | null
        preferred_driver_id?: string | null
        route_snapshot?: Json | null
        signature_url?: string | null
        special_instructions?: string | null
        status?: 'unassigned' | 'assigned' | 'accepted' | 'picked_up' | 'on_the_way' | 'delivered' | 'failed' | null
        temperature_sensitive?: boolean | null
        tracking_compliance?: boolean | null
        tracking_ended_at?: string | null
        tracking_started_at?: string | null
        updated_at?: string | null
        vendor_id?: string | null
      }>
      delivery_checklist: TableDef<{
        buyer_confirmed_receipt: boolean | null
        buyer_reported_issues: boolean | null
        completed_at: string | null
        completed_by: string | null
        created_at: string | null
        delivery_id: string
        delivery_issues: string | null
        id: string
        issues_description: string | null
        items_verified: boolean | null
        no_visible_damage: boolean | null
        packaging_intact: boolean | null
        photo_proof_url: string | null
        pickup_notes: string | null
        quantity_verified: boolean | null
        signature_url: string | null
        temperature_ok: boolean | null
        updated_at: string | null
      }, {
        buyer_confirmed_receipt?: boolean | null
        buyer_reported_issues?: boolean | null
        completed_at?: string | null
        completed_by?: string | null
        created_at?: string | null
        delivery_id: string
        delivery_issues?: string | null
        id?: string | null
        issues_description?: string | null
        items_verified?: boolean | null
        no_visible_damage?: boolean | null
        packaging_intact?: boolean | null
        photo_proof_url?: string | null
        pickup_notes?: string | null
        quantity_verified?: boolean | null
        signature_url?: string | null
        temperature_ok?: boolean | null
        updated_at?: string | null
      }, {
        buyer_confirmed_receipt?: boolean | null
        buyer_reported_issues?: boolean | null
        completed_at?: string | null
        completed_by?: string | null
        created_at?: string | null
        delivery_id?: string | null
        delivery_issues?: string | null
        id?: string | null
        issues_description?: string | null
        items_verified?: boolean | null
        no_visible_damage?: boolean | null
        packaging_intact?: boolean | null
        photo_proof_url?: string | null
        pickup_notes?: string | null
        quantity_verified?: boolean | null
        signature_url?: string | null
        temperature_ok?: boolean | null
        updated_at?: string | null
      }>
      delivery_requests: TableDef<{
        accepted_at: string | null
        assigned_driver_id: string | null
        base_fee: Json | null
        buyer_id: string | null
        cancellation_reason: string | null
        cancelled_at: string | null
        completed_at: string | null
        created_at: string | null
        delivery_address: string
        delivery_city: string
        delivery_lat: Json
        delivery_latitude: number | null
        delivery_lng: Json
        delivery_longitude: number | null
        delivery_region_id: string | null
        distance_fee: Json | null
        distance_km: Json | null
        driver_distance_from_pickup_km: Json | null
        driver_region_id: string | null
        estimated_distance_km: number | null
        estimated_hours: Json | null
        estimated_price: number | null
        id: string
        no_driver_available: boolean | null
        notified_drivers: string[] | null
        order_id: string
        pickup_address: string
        pickup_city: string
        pickup_lat: Json
        pickup_latitude: number | null
        pickup_lng: Json
        pickup_longitude: number | null
        pickup_region_id: string | null
        requested_at: string | null
        status: string | null
        total_fee: Json | null
        updated_at: string | null
        vendor_id: string
      }, {
        accepted_at?: string | null
        assigned_driver_id?: string | null
        base_fee?: Json | null
        buyer_id?: string | null
        cancellation_reason?: string | null
        cancelled_at?: string | null
        completed_at?: string | null
        created_at?: string | null
        delivery_address: string
        delivery_city: string
        delivery_lat: Json
        delivery_latitude?: number | null
        delivery_lng: Json
        delivery_longitude?: number | null
        delivery_region_id?: string | null
        distance_fee?: Json | null
        distance_km?: Json | null
        driver_distance_from_pickup_km?: Json | null
        driver_region_id?: string | null
        estimated_distance_km?: number | null
        estimated_hours?: Json | null
        estimated_price?: number | null
        id?: string | null
        no_driver_available?: boolean | null
        notified_drivers?: string[] | null
        order_id: string
        pickup_address: string
        pickup_city: string
        pickup_lat: Json
        pickup_latitude?: number | null
        pickup_lng: Json
        pickup_longitude?: number | null
        pickup_region_id?: string | null
        requested_at?: string | null
        status?: string | null
        total_fee?: Json | null
        updated_at?: string | null
        vendor_id: string
      }, {
        accepted_at?: string | null
        assigned_driver_id?: string | null
        base_fee?: Json | null
        buyer_id?: string | null
        cancellation_reason?: string | null
        cancelled_at?: string | null
        completed_at?: string | null
        created_at?: string | null
        delivery_address?: string | null
        delivery_city?: string | null
        delivery_lat?: Json | null
        delivery_latitude?: number | null
        delivery_lng?: Json | null
        delivery_longitude?: number | null
        delivery_region_id?: string | null
        distance_fee?: Json | null
        distance_km?: Json | null
        driver_distance_from_pickup_km?: Json | null
        driver_region_id?: string | null
        estimated_distance_km?: number | null
        estimated_hours?: Json | null
        estimated_price?: number | null
        id?: string | null
        no_driver_available?: boolean | null
        notified_drivers?: string[] | null
        order_id?: string | null
        pickup_address?: string | null
        pickup_city?: string | null
        pickup_lat?: Json | null
        pickup_latitude?: number | null
        pickup_lng?: Json | null
        pickup_longitude?: number | null
        pickup_region_id?: string | null
        requested_at?: string | null
        status?: string | null
        total_fee?: Json | null
        updated_at?: string | null
        vendor_id?: string | null
      }>
      delivery_tracking: TableDef<{
        accuracy: number | null
        accuracy_meters: number | null
        actual_delivery_time: string | null
        battery_level: number | null
        created_at: string | null
        current_latitude: number | null
        current_longitude: number | null
        customer_notes: string | null
        delivery_address: string | null
        delivery_id: string
        delivery_latitude: number | null
        delivery_longitude: number | null
        delivery_price: number | null
        delivery_time: string | null
        distance_km: number | null
        driver_id: string
        driver_notes: string | null
        estimated_delivery_time: string | null
        estimated_distance_km: number | null
        heading: number | null
        id: string
        last_location_update: string | null
        latitude: number
        longitude: number
        order_id: string | null
        pickup_address: string | null
        pickup_latitude: number | null
        pickup_longitude: number | null
        pickup_time: string | null
        price_breakdown: Json | null
        recorded_at: string | null
        speed: number | null
        speed_kmh: number | null
        status: string
        timestamp: string | null
        tracking_method: string | null
        updated_at: string | null
      }, {
        accuracy?: number | null
        accuracy_meters?: number | null
        actual_delivery_time?: string | null
        battery_level?: number | null
        created_at?: string | null
        current_latitude?: number | null
        current_longitude?: number | null
        customer_notes?: string | null
        delivery_address?: string | null
        delivery_id: string
        delivery_latitude?: number | null
        delivery_longitude?: number | null
        delivery_price?: number | null
        delivery_time?: string | null
        distance_km?: number | null
        driver_id: string
        driver_notes?: string | null
        estimated_delivery_time?: string | null
        estimated_distance_km?: number | null
        heading?: number | null
        id?: string | null
        last_location_update?: string | null
        latitude: number
        longitude: number
        order_id?: string | null
        pickup_address?: string | null
        pickup_latitude?: number | null
        pickup_longitude?: number | null
        pickup_time?: string | null
        price_breakdown?: Json | null
        recorded_at?: string | null
        speed?: number | null
        speed_kmh?: number | null
        status?: string | null
        timestamp?: string | null
        tracking_method?: string | null
        updated_at?: string | null
      }, {
        accuracy?: number | null
        accuracy_meters?: number | null
        actual_delivery_time?: string | null
        battery_level?: number | null
        created_at?: string | null
        current_latitude?: number | null
        current_longitude?: number | null
        customer_notes?: string | null
        delivery_address?: string | null
        delivery_id?: string | null
        delivery_latitude?: number | null
        delivery_longitude?: number | null
        delivery_price?: number | null
        delivery_time?: string | null
        distance_km?: number | null
        driver_id?: string | null
        driver_notes?: string | null
        estimated_delivery_time?: string | null
        estimated_distance_km?: number | null
        heading?: number | null
        id?: string | null
        last_location_update?: string | null
        latitude?: number | null
        longitude?: number | null
        order_id?: string | null
        pickup_address?: string | null
        pickup_latitude?: number | null
        pickup_longitude?: number | null
        pickup_time?: string | null
        price_breakdown?: Json | null
        recorded_at?: string | null
        speed?: number | null
        speed_kmh?: number | null
        status?: string | null
        timestamp?: string | null
        tracking_method?: string | null
        updated_at?: string | null
      }>
      delivery_zones: TableDef<{
        base_price: number
        city: string
        created_at: string | null
        estimated_delivery_max: number
        estimated_delivery_min: number
        id: string
        is_active: boolean | null
        max_distance_km: number
        polygon_coordinates: Json | null
        price_per_km: number
        updated_at: string | null
        zone_code: string
        zone_name: string
      }, {
        base_price?: number | null
        city: string
        created_at?: string | null
        estimated_delivery_max?: number | null
        estimated_delivery_min?: number | null
        id?: string | null
        is_active?: boolean | null
        max_distance_km?: number | null
        polygon_coordinates?: Json | null
        price_per_km?: number | null
        updated_at?: string | null
        zone_code: string
        zone_name: string
      }, {
        base_price?: number | null
        city?: string | null
        created_at?: string | null
        estimated_delivery_max?: number | null
        estimated_delivery_min?: number | null
        id?: string | null
        is_active?: boolean | null
        max_distance_km?: number | null
        polygon_coordinates?: Json | null
        price_per_km?: number | null
        updated_at?: string | null
        zone_code?: string | null
        zone_name?: string | null
      }>
      digital_signatures: TableDef<{
        algorithm: string | null
        created_at: string | null
        data_hash: string
        document_id: string | null
        document_type: string | null
        entity_id: string
        entity_type: string
        id: string
        is_valid: boolean | null
        metadata: Json | null
        signature: string
        signature_hash: string
        signature_metadata: Json | null
        signed_at: string | null
        signer_id: string | null
        user_id: string
      }, {
        algorithm?: string | null
        created_at?: string | null
        data_hash: string
        document_id?: string | null
        document_type?: string | null
        entity_id: string
        entity_type: string
        id?: string | null
        is_valid?: boolean | null
        metadata?: Json | null
        signature: string
        signature_hash: string
        signature_metadata?: Json | null
        signed_at?: string | null
        signer_id?: string | null
        user_id: string
      }, {
        algorithm?: string | null
        created_at?: string | null
        data_hash?: string | null
        document_id?: string | null
        document_type?: string | null
        entity_id?: string | null
        entity_type?: string | null
        id?: string | null
        is_valid?: boolean | null
        metadata?: Json | null
        signature?: string | null
        signature_hash?: string | null
        signature_metadata?: Json | null
        signed_at?: string | null
        signer_id?: string | null
        user_id?: string | null
      }>
      domain_events_outbox: TableDef<{
        attempts: number
        created_at: string
        error: string | null
        error_message: string | null
        event_type: string
        id: string
        max_attempts: number
        payload: Json
        processed_at: string | null
        retry_count: number | null
        source_function: string | null
      }, {
        attempts?: number | null
        created_at?: string | null
        error?: string | null
        error_message?: string | null
        event_type: string
        id?: string | null
        max_attempts?: number | null
        payload: Json
        processed_at?: string | null
        retry_count?: number | null
        source_function?: string | null
      }, {
        attempts?: number | null
        created_at?: string | null
        error?: string | null
        error_message?: string | null
        event_type?: string | null
        id?: string | null
        max_attempts?: number | null
        payload?: Json | null
        processed_at?: string | null
        retry_count?: number | null
        source_function?: string | null
      }>
      driver_availability_log: TableDef<{
        changed_at: string | null
        created_at: string | null
        driver_id: string
        id: string
        is_available: boolean
        location_lat: number | null
        location_lng: number | null
        updated_at: string | null
      }, {
        changed_at?: string | null
        created_at?: string | null
        driver_id: string
        id?: string | null
        is_available?: boolean | null
        location_lat?: number | null
        location_lng?: number | null
        updated_at?: string | null
      }, {
        changed_at?: string | null
        created_at?: string | null
        driver_id?: string | null
        id?: string | null
        is_available?: boolean | null
        location_lat?: number | null
        location_lng?: number | null
        updated_at?: string | null
      }>
      driver_availability_requests: TableDef<{
        driver_id: string
        id: string
        requested_at: string | null
        status: string | null
        updated_at: string | null
      }, {
        driver_id: string
        id?: string | null
        requested_at?: string | null
        status?: string | null
        updated_at?: string | null
      }, {
        driver_id?: string | null
        id?: string | null
        requested_at?: string | null
        status?: string | null
        updated_at?: string | null
      }>
      driver_broadcast_events: TableDef<{
        accuracy_meters: number | null
        buyer_id: string | null
        created_at: string
        delivery_id: string | null
        driver_id: string
        event_type: string
        id: string
        latitude: number | null
        longitude: number | null
        order_id: string | null
        payload: Json | null
        speed_kmh: number | null
        vendor_id: string | null
      }, {
        accuracy_meters?: number | null
        buyer_id?: string | null
        created_at?: string | null
        delivery_id?: string | null
        driver_id: string
        event_type?: string | null
        id?: string | null
        latitude?: number | null
        longitude?: number | null
        order_id?: string | null
        payload?: Json | null
        speed_kmh?: number | null
        vendor_id?: string | null
      }, {
        accuracy_meters?: number | null
        buyer_id?: string | null
        created_at?: string | null
        delivery_id?: string | null
        driver_id?: string | null
        event_type?: string | null
        id?: string | null
        latitude?: number | null
        longitude?: number | null
        order_id?: string | null
        payload?: Json | null
        speed_kmh?: number | null
        vendor_id?: string | null
      }>
      driver_earnings: TableDef<{
        amount: number
        commission_amount: number | null
        commission_rate: number | null
        created_at: string | null
        delivery_id: string
        driver_id: string
        id: string
        net_amount: number
        paid_at: string | null
      }, {
        amount: number
        commission_amount?: number | null
        commission_rate?: number | null
        created_at?: string | null
        delivery_id: string
        driver_id: string
        id?: string | null
        net_amount: number
        paid_at?: string | null
      }, {
        amount?: number | null
        commission_amount?: number | null
        commission_rate?: number | null
        created_at?: string | null
        delivery_id?: string | null
        driver_id?: string | null
        id?: string | null
        net_amount?: number | null
        paid_at?: string | null
      }>
      driver_location_history: TableDef<{
        accuracy_meters: number | null
        created_at: string | null
        delivery_id: string | null
        driver_id: string | null
        heading: number | null
        id: string
        latitude: number
        longitude: number
        order_id: string | null
        recorded_at: string | null
        speed_kmh: number | null
      }, {
        accuracy_meters?: number | null
        created_at?: string | null
        delivery_id?: string | null
        driver_id?: string | null
        heading?: number | null
        id?: string | null
        latitude: number
        longitude: number
        order_id?: string | null
        recorded_at?: string | null
        speed_kmh?: number | null
      }, {
        accuracy_meters?: number | null
        created_at?: string | null
        delivery_id?: string | null
        driver_id?: string | null
        heading?: number | null
        id?: string | null
        latitude?: number | null
        longitude?: number | null
        order_id?: string | null
        recorded_at?: string | null
        speed_kmh?: number | null
      }>
      driver_locations: TableDef<{
        accuracy: number | null
        accuracy_meters: number | null
        address: string | null
        broadcast_started_at: string | null
        broadcast_status: string | null
        buyer_id: string | null
        city: string | null
        created_at: string | null
        delivery_id: string | null
        driver_id: string
        heading: number | null
        id: string
        is_available: boolean | null
        is_online: boolean | null
        last_active_at: string | null
        last_broadcast_at: string | null
        last_updated: string | null
        latitude: number
        longitude: number
        max_distance_km: number | null
        metadata: Json | null
        order_id: string | null
        recorded_at: string | null
        region_id: string | null
        service_radius_km: Json | null
        speed: number | null
        speed_kmh: number | null
        updated_at: string | null
        vendor_id: string | null
      }, {
        accuracy?: number | null
        accuracy_meters?: number | null
        address?: string | null
        broadcast_started_at?: string | null
        broadcast_status?: string | null
        buyer_id?: string | null
        city?: string | null
        created_at?: string | null
        delivery_id?: string | null
        driver_id: string
        heading?: number | null
        id?: string | null
        is_available?: boolean | null
        is_online?: boolean | null
        last_active_at?: string | null
        last_broadcast_at?: string | null
        last_updated?: string | null
        latitude: number
        longitude: number
        max_distance_km?: number | null
        metadata?: Json | null
        order_id?: string | null
        recorded_at?: string | null
        region_id?: string | null
        service_radius_km?: Json | null
        speed?: number | null
        speed_kmh?: number | null
        updated_at?: string | null
        vendor_id?: string | null
      }, {
        accuracy?: number | null
        accuracy_meters?: number | null
        address?: string | null
        broadcast_started_at?: string | null
        broadcast_status?: string | null
        buyer_id?: string | null
        city?: string | null
        created_at?: string | null
        delivery_id?: string | null
        driver_id?: string | null
        heading?: number | null
        id?: string | null
        is_available?: boolean | null
        is_online?: boolean | null
        last_active_at?: string | null
        last_broadcast_at?: string | null
        last_updated?: string | null
        latitude?: number | null
        longitude?: number | null
        max_distance_km?: number | null
        metadata?: Json | null
        order_id?: string | null
        recorded_at?: string | null
        region_id?: string | null
        service_radius_km?: Json | null
        speed?: number | null
        speed_kmh?: number | null
        updated_at?: string | null
        vendor_id?: string | null
      }>
      driver_performance: TableDef<{
        avg_delivery_time_minutes: number | null
        created_at: string | null
        customer_complaints: number | null
        customer_compliments: number | null
        damaged_items_count: number | null
        driver_id: string
        failed_deliveries: number | null
        id: string
        late_deliveries: number | null
        on_time_deliveries: number | null
        on_time_percentage: number | null
        period_end: string | null
        period_start: string | null
        photo_compliance_rate: number | null
        total_deliveries: number | null
        tracking_compliance_rate: number | null
        updated_at: string | null
      }, {
        avg_delivery_time_minutes?: number | null
        created_at?: string | null
        customer_complaints?: number | null
        customer_compliments?: number | null
        damaged_items_count?: number | null
        driver_id: string
        failed_deliveries?: number | null
        id?: string | null
        late_deliveries?: number | null
        on_time_deliveries?: number | null
        on_time_percentage?: number | null
        period_end?: string | null
        period_start?: string | null
        photo_compliance_rate?: number | null
        total_deliveries?: number | null
        tracking_compliance_rate?: number | null
        updated_at?: string | null
      }, {
        avg_delivery_time_minutes?: number | null
        created_at?: string | null
        customer_complaints?: number | null
        customer_compliments?: number | null
        damaged_items_count?: number | null
        driver_id?: string | null
        failed_deliveries?: number | null
        id?: string | null
        late_deliveries?: number | null
        on_time_deliveries?: number | null
        on_time_percentage?: number | null
        period_end?: string | null
        period_start?: string | null
        photo_compliance_rate?: number | null
        total_deliveries?: number | null
        tracking_compliance_rate?: number | null
        updated_at?: string | null
      }>
      driver_pricing: TableDef<{
        base_price: number
        created_at: string | null
        driver_id: string
        evening_end: string | null
        evening_multiplier: number | null
        evening_start: string | null
        id: string
        is_custom: boolean | null
        is_custom_pricing: boolean | null
        max_distance_km: number | null
        max_price: number
        min_price: number
        price_per_km: number
        rush_hour_end: string | null
        rush_hour_multiplier: number | null
        rush_hour_start: string | null
        updated_at: string | null
      }, {
        base_price?: number | null
        created_at?: string | null
        driver_id: string
        evening_end?: string | null
        evening_multiplier?: number | null
        evening_start?: string | null
        id?: string | null
        is_custom?: boolean | null
        is_custom_pricing?: boolean | null
        max_distance_km?: number | null
        max_price?: number | null
        min_price?: number | null
        price_per_km?: number | null
        rush_hour_end?: string | null
        rush_hour_multiplier?: number | null
        rush_hour_start?: string | null
        updated_at?: string | null
      }, {
        base_price?: number | null
        created_at?: string | null
        driver_id?: string | null
        evening_end?: string | null
        evening_multiplier?: number | null
        evening_start?: string | null
        id?: string | null
        is_custom?: boolean | null
        is_custom_pricing?: boolean | null
        max_distance_km?: number | null
        max_price?: number | null
        min_price?: number | null
        price_per_km?: number | null
        rush_hour_end?: string | null
        rush_hour_multiplier?: number | null
        rush_hour_start?: string | null
        updated_at?: string | null
      }>
      driver_reviews: TableDef<{
        comment: string | null
        created_at: string | null
        delivery_id: string | null
        driver_id: string
        id: string
        rating: number
        reviewer_id: string
      }, {
        comment?: string | null
        created_at?: string | null
        delivery_id?: string | null
        driver_id: string
        id?: string | null
        rating: number
        reviewer_id: string
      }, {
        comment?: string | null
        created_at?: string | null
        delivery_id?: string | null
        driver_id?: string | null
        id?: string | null
        rating?: number | null
        reviewer_id?: string | null
      }>
      driver_verification_documents: TableDef<{
        admin_notes: string | null
        created_at: string | null
        document_number: string | null
        document_type: string
        document_url: string
        driver_id: string
        expiry_date: string | null
        id: string
        issue_date: string | null
        reviewed_at: string | null
        reviewed_by: string | null
        status: string | null
        updated_at: string | null
      }, {
        admin_notes?: string | null
        created_at?: string | null
        document_number?: string | null
        document_type: string
        document_url: string
        driver_id: string
        expiry_date?: string | null
        id?: string | null
        issue_date?: string | null
        reviewed_at?: string | null
        reviewed_by?: string | null
        status?: string | null
        updated_at?: string | null
      }, {
        admin_notes?: string | null
        created_at?: string | null
        document_number?: string | null
        document_type?: string | null
        document_url?: string | null
        driver_id?: string | null
        expiry_date?: string | null
        id?: string | null
        issue_date?: string | null
        reviewed_at?: string | null
        reviewed_by?: string | null
        status?: string | null
        updated_at?: string | null
      }>
      drivers: TableDef<{
        cancelled_deliveries: number | null
        completed_deliveries: number | null
        created_at: string | null
        id: string
        license_number: string
        phone: string
        rating: number | null
        status: string | null
        total_deliveries: number | null
        total_earnings: number | null
        updated_at: string | null
        user_id: string
        vehicle_info: string | null
      }, {
        cancelled_deliveries?: number | null
        completed_deliveries?: number | null
        created_at?: string | null
        id?: string | null
        license_number: string
        phone: string
        rating?: number | null
        status?: string | null
        total_deliveries?: number | null
        total_earnings?: number | null
        updated_at?: string | null
        user_id: string
        vehicle_info?: string | null
      }, {
        cancelled_deliveries?: number | null
        completed_deliveries?: number | null
        created_at?: string | null
        id?: string | null
        license_number?: string | null
        phone?: string | null
        rating?: number | null
        status?: string | null
        total_deliveries?: number | null
        total_earnings?: number | null
        updated_at?: string | null
        user_id?: string | null
        vehicle_info?: string | null
      }>
      favorites: TableDef<{
        created_at: string | null
        deleted_at: string | null
        id: string
        product_id: string | null
        user_id: string
        vendor_id: string | null
      }, {
        created_at?: string | null
        deleted_at?: string | null
        id?: string | null
        product_id?: string | null
        user_id: string
        vendor_id?: string | null
      }, {
        created_at?: string | null
        deleted_at?: string | null
        id?: string | null
        product_id?: string | null
        user_id?: string | null
        vendor_id?: string | null
      }>
      financial_audit_log: TableDef<{
        action: string
        amount: number | null
        created_at: string | null
        details: Json | null
        entity_id: string
        entity_type: string
        id: string
        ip_address: string | null
        new_status: string | null
        performed_by: string
        performed_by_role: string | null
        previous_status: string | null
        reason: string | null
        user_agent: string | null
        user_id: string | null
      }, {
        action: string
        amount?: number | null
        created_at?: string | null
        details?: Json | null
        entity_id: string
        entity_type: string
        id?: string | null
        ip_address?: string | null
        new_status?: string | null
        performed_by: string
        performed_by_role?: string | null
        previous_status?: string | null
        reason?: string | null
        user_agent?: string | null
        user_id?: string | null
      }, {
        action?: string | null
        amount?: number | null
        created_at?: string | null
        details?: Json | null
        entity_id?: string | null
        entity_type?: string | null
        id?: string | null
        ip_address?: string | null
        new_status?: string | null
        performed_by?: string | null
        performed_by_role?: string | null
        previous_status?: string | null
        reason?: string | null
        user_agent?: string | null
        user_id?: string | null
      }>
      fraud_reports: TableDef<{
        admin_notes: string | null
        awareness_notified_at: string | null
        created_at: string | null
        delivery_id: string | null
        description: string
        evidence_paths: string[] | null
        id: string
        legal_recommendation: string | null
        order_id: string | null
        priority: string | null
        report_type: string
        reported_user_id: string | null
        reported_user_role: string | null
        reporter_id: string
        reporter_role: string
        resolution: string | null
        resolved_at: string | null
        reviewed_at: string | null
        reviewed_by: string | null
        status: string | null
        updated_at: string | null
      }, {
        admin_notes?: string | null
        awareness_notified_at?: string | null
        created_at?: string | null
        delivery_id?: string | null
        description: string
        evidence_paths?: string[] | null
        id?: string | null
        legal_recommendation?: string | null
        order_id?: string | null
        priority?: string | null
        report_type: string
        reported_user_id?: string | null
        reported_user_role?: string | null
        reporter_id: string
        reporter_role: string
        resolution?: string | null
        resolved_at?: string | null
        reviewed_at?: string | null
        reviewed_by?: string | null
        status?: string | null
        updated_at?: string | null
      }, {
        admin_notes?: string | null
        awareness_notified_at?: string | null
        created_at?: string | null
        delivery_id?: string | null
        description?: string | null
        evidence_paths?: string[] | null
        id?: string | null
        legal_recommendation?: string | null
        order_id?: string | null
        priority?: string | null
        report_type?: string | null
        reported_user_id?: string | null
        reported_user_role?: string | null
        reporter_id?: string | null
        reporter_role?: string | null
        resolution?: string | null
        resolved_at?: string | null
        reviewed_at?: string | null
        reviewed_by?: string | null
        status?: string | null
        updated_at?: string | null
      }>
      invoices: TableDef<{
        amount: number
        buyer_id: string
        created_at: string
        currency: string
        discount_total: number
        fees_total: number
        grand_total: number
        id: string
        invoice_number: string
        issued_at: string
        metadata: Json
        order_id: string
        paid_at: string | null
        pdf_path: string | null
        period_end: string | null
        period_start: string | null
        shipping_total: number
        status: string
        stripe_invoice_id: string | null
        subscription_plan: string
        subtotal: number
        updated_at: string
        vendor_id: string
      }, {
        amount: number
        buyer_id: string
        created_at?: string | null
        currency?: string | null
        discount_total?: number | null
        fees_total?: number | null
        grand_total?: number | null
        id?: string | null
        invoice_number: string
        issued_at?: string | null
        metadata?: Json | null
        order_id: string
        paid_at?: string | null
        pdf_path?: string | null
        period_end?: string | null
        period_start?: string | null
        shipping_total?: number | null
        status?: string | null
        stripe_invoice_id?: string | null
        subscription_plan: string
        subtotal?: number | null
        updated_at?: string | null
        vendor_id: string
      }, {
        amount?: number | null
        buyer_id?: string | null
        created_at?: string | null
        currency?: string | null
        discount_total?: number | null
        fees_total?: number | null
        grand_total?: number | null
        id?: string | null
        invoice_number?: string | null
        issued_at?: string | null
        metadata?: Json | null
        order_id?: string | null
        paid_at?: string | null
        pdf_path?: string | null
        period_end?: string | null
        period_start?: string | null
        shipping_total?: number | null
        status?: string | null
        stripe_invoice_id?: string | null
        subscription_plan?: string | null
        subtotal?: number | null
        updated_at?: string | null
        vendor_id?: string | null
      }>
      loyalty_points: TableDef<{
        created_at: string | null
        id: string
        last_earned_at: string | null
        level: string | null
        lifetime_points: number
        points: number | null
        referral_bonus_earned: number
        tier: string
        updated_at: string | null
        user_id: string
      }, {
        created_at?: string | null
        id?: string | null
        last_earned_at?: string | null
        level?: string | null
        lifetime_points?: number | null
        points?: number | null
        referral_bonus_earned?: number | null
        tier?: string | null
        updated_at?: string | null
        user_id: string
      }, {
        created_at?: string | null
        id?: string | null
        last_earned_at?: string | null
        level?: string | null
        lifetime_points?: number | null
        points?: number | null
        referral_bonus_earned?: number | null
        tier?: string | null
        updated_at?: string | null
        user_id?: string | null
      }>
      loyalty_rewards: TableDef<{
        coupon_code: string | null
        created_at: string
        description: string | null
        id: string
        is_active: boolean
        points_cost: number
        reward_type: string
        reward_value: number | null
        title: string
        updated_at: string
      }, {
        coupon_code?: string | null
        created_at?: string | null
        description?: string | null
        id?: string | null
        is_active?: boolean | null
        points_cost: number
        reward_type: string
        reward_value?: number | null
        title: string
        updated_at?: string | null
      }, {
        coupon_code?: string | null
        created_at?: string | null
        description?: string | null
        id?: string | null
        is_active?: boolean | null
        points_cost?: number | null
        reward_type?: string | null
        reward_value?: number | null
        title?: string | null
        updated_at?: string | null
      }>
      loyalty_transactions: TableDef<{
        balance_after: number
        created_at: string | null
        id: string
        metadata: Json
        order_id: string | null
        points_change: number
        reason: string | null
        user_id: string
      }, {
        balance_after?: number | null
        created_at?: string | null
        id?: string | null
        metadata?: Json | null
        order_id?: string | null
        points_change: number
        reason?: string | null
        user_id: string
      }, {
        balance_after?: number | null
        created_at?: string | null
        id?: string | null
        metadata?: Json | null
        order_id?: string | null
        points_change?: number | null
        reason?: string | null
        user_id?: string | null
      }>
      messages: TableDef<{
        attachment_url: string | null
        content: string | null
        conversation_id: string
        created_at: string | null
        deleted_at: string | null
        delivery_id: string | null
        id: string
        is_read: boolean | null
        message: string
        message_type: string | null
        order_id: string | null
        read_at: string | null
        receiver_id: string
        sender_id: string
        updated_at: string | null
      }, {
        attachment_url?: string | null
        content?: string | null
        conversation_id: string
        created_at?: string | null
        deleted_at?: string | null
        delivery_id?: string | null
        id?: string | null
        is_read?: boolean | null
        message: string
        message_type?: string | null
        order_id?: string | null
        read_at?: string | null
        receiver_id: string
        sender_id: string
        updated_at?: string | null
      }, {
        attachment_url?: string | null
        content?: string | null
        conversation_id?: string | null
        created_at?: string | null
        deleted_at?: string | null
        delivery_id?: string | null
        id?: string | null
        is_read?: boolean | null
        message?: string | null
        message_type?: string | null
        order_id?: string | null
        read_at?: string | null
        receiver_id?: string | null
        sender_id?: string | null
        updated_at?: string | null
      }>
      mfa_settings: TableDef<{
        attempted_verifications: number | null
        backup_codes: string[] | null
        backup_codes_generated_at: string | null
        created_at: string | null
        email_otp_enabled: boolean | null
        email_verified: boolean | null
        enabled_at: string | null
        failed_attempts: number | null
        id: string
        is_enabled: boolean | null
        last_email_otp_sent_at: string | null
        last_totp_verified_at: string | null
        last_used_at: string | null
        last_verified_at: string | null
        locked_until: string | null
        method: string | null
        phone_number: string | null
        phone_verified: boolean | null
        totp_backup_codes: string[] | null
        totp_backup_codes_hashed: boolean | null
        totp_enabled: boolean | null
        totp_secret: string | null
        updated_at: string | null
        user_id: string
      }, {
        attempted_verifications?: number | null
        backup_codes?: string[] | null
        backup_codes_generated_at?: string | null
        created_at?: string | null
        email_otp_enabled?: boolean | null
        email_verified?: boolean | null
        enabled_at?: string | null
        failed_attempts?: number | null
        id?: string | null
        is_enabled?: boolean | null
        last_email_otp_sent_at?: string | null
        last_totp_verified_at?: string | null
        last_used_at?: string | null
        last_verified_at?: string | null
        locked_until?: string | null
        method?: string | null
        phone_number?: string | null
        phone_verified?: boolean | null
        totp_backup_codes?: string[] | null
        totp_backup_codes_hashed?: boolean | null
        totp_enabled?: boolean | null
        totp_secret?: string | null
        updated_at?: string | null
        user_id: string
      }, {
        attempted_verifications?: number | null
        backup_codes?: string[] | null
        backup_codes_generated_at?: string | null
        created_at?: string | null
        email_otp_enabled?: boolean | null
        email_verified?: boolean | null
        enabled_at?: string | null
        failed_attempts?: number | null
        id?: string | null
        is_enabled?: boolean | null
        last_email_otp_sent_at?: string | null
        last_totp_verified_at?: string | null
        last_used_at?: string | null
        last_verified_at?: string | null
        locked_until?: string | null
        method?: string | null
        phone_number?: string | null
        phone_verified?: boolean | null
        totp_backup_codes?: string[] | null
        totp_backup_codes_hashed?: boolean | null
        totp_enabled?: boolean | null
        totp_secret?: string | null
        updated_at?: string | null
        user_id?: string | null
      }>
      mfa_settings_backup_plaintext: TableDef<{
        backed_up_at: string | null
        id: string
        plaintext_codes: string[]
        processed: boolean | null
        user_id: string
      }, {
        backed_up_at?: string | null
        id?: string | null
        plaintext_codes: string[]
        processed?: boolean | null
        user_id: string
      }, {
        backed_up_at?: string | null
        id?: string | null
        plaintext_codes?: string[] | null
        processed?: boolean | null
        user_id?: string | null
      }>
      moroccan_banks: TableDef<{
        code: string | null
        color: string | null
        created_at: string | null
        id: Json
        is_active: boolean | null
        logo_url: string | null
        name: string
      }, {
        code?: string | null
        color?: string | null
        created_at?: string | null
        id: Json
        is_active?: boolean | null
        logo_url?: string | null
        name: string
      }, {
        code?: string | null
        color?: string | null
        created_at?: string | null
        id?: Json | null
        is_active?: boolean | null
        logo_url?: string | null
        name?: string | null
      }>
      notification_preferences: TableDef<{
        created_at: string
        delivery_updates: boolean
        email_enabled: boolean
        id: string
        in_app_enabled: boolean
        inventory_alerts: boolean
        loyalty_updates: boolean
        order_updates: boolean
        payment_updates: boolean
        promotional_updates: boolean
        quiet_hours_end: string | null
        quiet_hours_start: string | null
        review_updates: boolean
        sms_enabled: boolean
        system_updates: boolean
        updated_at: string
        user_id: string
      }, {
        created_at?: string | null
        delivery_updates?: boolean | null
        email_enabled?: boolean | null
        id?: string | null
        in_app_enabled?: boolean | null
        inventory_alerts?: boolean | null
        loyalty_updates?: boolean | null
        order_updates?: boolean | null
        payment_updates?: boolean | null
        promotional_updates?: boolean | null
        quiet_hours_end?: string | null
        quiet_hours_start?: string | null
        review_updates?: boolean | null
        sms_enabled?: boolean | null
        system_updates?: boolean | null
        updated_at?: string | null
        user_id: string
      }, {
        created_at?: string | null
        delivery_updates?: boolean | null
        email_enabled?: boolean | null
        id?: string | null
        in_app_enabled?: boolean | null
        inventory_alerts?: boolean | null
        loyalty_updates?: boolean | null
        order_updates?: boolean | null
        payment_updates?: boolean | null
        promotional_updates?: boolean | null
        quiet_hours_end?: string | null
        quiet_hours_start?: string | null
        review_updates?: boolean | null
        sms_enabled?: boolean | null
        system_updates?: boolean | null
        updated_at?: string | null
        user_id?: string | null
      }>
      notifications: TableDef<{
        action_label: string | null
        action_url: string | null
        category: string
        channel: string
        created_at: string | null
        data: Json | null
        deleted_at: string | null
        id: string
        is_read: boolean | null
        message: string
        priority: string
        read_at: string | null
        title: string
        type: string
        user_id: string
      }, {
        action_label?: string | null
        action_url?: string | null
        category?: string | null
        channel?: string | null
        created_at?: string | null
        data?: Json | null
        deleted_at?: string | null
        id?: string | null
        is_read?: boolean | null
        message: string
        priority?: string | null
        read_at?: string | null
        title: string
        type?: string | null
        user_id: string
      }, {
        action_label?: string | null
        action_url?: string | null
        category?: string | null
        channel?: string | null
        created_at?: string | null
        data?: Json | null
        deleted_at?: string | null
        id?: string | null
        is_read?: boolean | null
        message?: string | null
        priority?: string | null
        read_at?: string | null
        title?: string | null
        type?: string | null
        user_id?: string | null
      }>
      offline_sync_queue: TableDef<{
        action: string
        created_at: string | null
        entity_id: string | null
        entity_type: string
        error_message: string | null
        id: string
        max_retries: number | null
        payload: Json
        resource_id: string | null
        resource_type: string
        retry_count: number | null
        status: string | null
        synced_at: string | null
        user_id: string
      }, {
        action: string
        created_at?: string | null
        entity_id?: string | null
        entity_type: string
        error_message?: string | null
        id?: string | null
        max_retries?: number | null
        payload: Json
        resource_id?: string | null
        resource_type: string
        retry_count?: number | null
        status?: string | null
        synced_at?: string | null
        user_id: string
      }, {
        action?: string | null
        created_at?: string | null
        entity_id?: string | null
        entity_type?: string | null
        error_message?: string | null
        id?: string | null
        max_retries?: number | null
        payload?: Json | null
        resource_id?: string | null
        resource_type?: string | null
        retry_count?: number | null
        status?: string | null
        synced_at?: string | null
        user_id?: string | null
      }>
      order_items: TableDef<{
        created_at: string | null
        deleted_at: string | null
        id: string
        order_id: string
        product_id: string
        quantity: number
        total: number
        unit_price: number
      }, {
        created_at?: string | null
        deleted_at?: string | null
        id?: string | null
        order_id: string
        product_id: string
        quantity: number
        total: number
        unit_price: number
      }, {
        created_at?: string | null
        deleted_at?: string | null
        id?: string | null
        order_id?: string | null
        product_id?: string | null
        quantity?: number | null
        total?: number | null
        unit_price?: number | null
      }>
      order_timeline: TableDef<{
        created_at: string | null
        description: string | null
        event_description: string | null
        event_type: string
        id: string
        metadata: Json | null
        order_id: string
        performed_by: string | null
        status: string
        updated_by: string | null
      }, {
        created_at?: string | null
        description?: string | null
        event_description?: string | null
        event_type: string
        id?: string | null
        metadata?: Json | null
        order_id: string
        performed_by?: string | null
        status: string
        updated_by?: string | null
      }, {
        created_at?: string | null
        description?: string | null
        event_description?: string | null
        event_type?: string | null
        id?: string | null
        metadata?: Json | null
        order_id?: string | null
        performed_by?: string | null
        status?: string | null
        updated_by?: string | null
      }>
      orders: TableDef<{
        accepted_at: string | null
        actual_sale_amount: Json | null
        applied_coupon_id: string | null
        bulk_discount_total: Json | null
        buyer_cancellation_reason: string | null
        buyer_commission: Json | null
        buyer_id: string
        buyer_notes: string | null
        buyer_total: Json | null
        cancellation_policy_snapshot: Json
        cancellation_reason: string | null
        cancellation_requested_at: string | null
        cancellation_requested_by: string | null
        cancelled_at: string | null
        cancelled_by: string | null
        cargo_size: string | null
        commission: Json | null
        commission_rate: Json | null
        coupon_discount_total: Json | null
        created_at: string | null
        deleted_at: string | null
        delivered_at: string | null
        delivery_base_fee: Json | null
        delivery_distance_fee: Json | null
        delivery_distance_km: Json | null
        delivery_fee_breakdown: Json | null
        delivery_fee_total: Json | null
        delivery_option: string | null
        delivery_schedule_snapshot: Json
        delivery_time_multiplier: Json | null
        discount_total: Json | null
        driver_accepted_at: string | null
        driver_amount: Json | null
        driver_assigned_at: string | null
        driver_commission: Json | null
        driver_delivery_paid_at: string | null
        driver_delivery_payment_method: string | null
        driver_delivery_payment_notes: string | null
        driver_delivery_payment_status: string | null
        driver_id: string | null
        driver_preferences_snapshot: Json | null
        estimated_delivery_time: string | null
        first_payment_amount: Json | null
        first_payment_paid_at: string | null
        first_payment_receipt_url: string | null
        first_payment_status: string | null
        fulfillment_deadline_hours: number | null
        fulfillment_met_deadline: boolean | null
        id: string
        invoice_generated_at: string | null
        invoice_metadata: Json
        invoice_number: string | null
        invoice_status: string
        legal_capture_completed: boolean | null
        legal_capture_required: boolean | null
        loyalty_discount_total: Json | null
        loyalty_points_earned: number
        loyalty_points_redeemed: number
        minimum_order_amount_snapshot: Json | null
        minimum_order_shortfall: Json | null
        order_number: string
        payment_dispute_opened_at: string | null
        payment_dispute_reason: string | null
        payment_disputed: boolean | null
        payment_received_amount: Json | null
        payment_received_at: string | null
        payment_received_by: string | null
        payment_status: string | null
        payment_type: string | null
        payment_verified_by_vendor: boolean | null
        platform_commission_rate_snapshot: Json | null
        preferred_driver_assigned_at: string | null
        preferred_driver_id: string | null
        preferred_driver_source: string | null
        preferred_driver_status: string | null
        product_tva_exempt: boolean | null
        referral_discount_total: Json | null
        requested_delivery_date: string | null
        requested_delivery_slot_id: string | null
        requested_delivery_slot_label: string | null
        return_requested: boolean | null
        second_payment_amount: Json | null
        second_payment_due_at: string | null
        second_payment_paid_at: string | null
        second_payment_receipt_url: string | null
        second_payment_status: string | null
        shipping_address: string
        shipping_city: string
        shipping_cost: number | null
        shipping_country: string | null
        shipping_latitude: number | null
        shipping_longitude: number | null
        status: 'pending' | 'vendor_accepted' | 'vendor_rejected' | 'driver_assigned' | 'driver_accepted' | 'driver_picked_up' | 'on_the_way' | 'delivered' | 'cancelled' | null
        store_id: string | null
        subtotal: number
        tax: number | null
        total: number
        updated_at: string | null
        vendor_amount: Json | null
        vendor_cancellation_reason: string | null
        vendor_compliance_flag: string | null
        vendor_confirmed_at: string | null
        vendor_id: string
        vendor_latitude: number | null
        vendor_longitude: number | null
        vendor_notes: string | null
        vendor_prepared_at: string | null
        vendor_product_total: Json | null
        vendor_response_at: string | null
        vendor_store_type: string | null
        vendor_wait_response: boolean | null
        waiting_period_days: number | null
      }, {
        accepted_at?: string | null
        actual_sale_amount?: Json | null
        applied_coupon_id?: string | null
        bulk_discount_total?: Json | null
        buyer_cancellation_reason?: string | null
        buyer_commission?: Json | null
        buyer_id: string
        buyer_notes?: string | null
        buyer_total?: Json | null
        cancellation_policy_snapshot?: Json | null
        cancellation_reason?: string | null
        cancellation_requested_at?: string | null
        cancellation_requested_by?: string | null
        cancelled_at?: string | null
        cancelled_by?: string | null
        cargo_size?: string | null
        commission?: Json | null
        commission_rate?: Json | null
        coupon_discount_total?: Json | null
        created_at?: string | null
        deleted_at?: string | null
        delivered_at?: string | null
        delivery_base_fee?: Json | null
        delivery_distance_fee?: Json | null
        delivery_distance_km?: Json | null
        delivery_fee_breakdown?: Json | null
        delivery_fee_total?: Json | null
        delivery_option?: string | null
        delivery_schedule_snapshot?: Json | null
        delivery_time_multiplier?: Json | null
        discount_total?: Json | null
        driver_accepted_at?: string | null
        driver_amount?: Json | null
        driver_assigned_at?: string | null
        driver_commission?: Json | null
        driver_delivery_paid_at?: string | null
        driver_delivery_payment_method?: string | null
        driver_delivery_payment_notes?: string | null
        driver_delivery_payment_status?: string | null
        driver_id?: string | null
        driver_preferences_snapshot?: Json | null
        estimated_delivery_time?: string | null
        first_payment_amount?: Json | null
        first_payment_paid_at?: string | null
        first_payment_receipt_url?: string | null
        first_payment_status?: string | null
        fulfillment_deadline_hours?: number | null
        fulfillment_met_deadline?: boolean | null
        id?: string | null
        invoice_generated_at?: string | null
        invoice_metadata?: Json | null
        invoice_number?: string | null
        invoice_status?: string | null
        legal_capture_completed?: boolean | null
        legal_capture_required?: boolean | null
        loyalty_discount_total?: Json | null
        loyalty_points_earned?: number | null
        loyalty_points_redeemed?: number | null
        minimum_order_amount_snapshot?: Json | null
        minimum_order_shortfall?: Json | null
        order_number: string
        payment_dispute_opened_at?: string | null
        payment_dispute_reason?: string | null
        payment_disputed?: boolean | null
        payment_received_amount?: Json | null
        payment_received_at?: string | null
        payment_received_by?: string | null
        payment_status?: string | null
        payment_type?: string | null
        payment_verified_by_vendor?: boolean | null
        platform_commission_rate_snapshot?: Json | null
        preferred_driver_assigned_at?: string | null
        preferred_driver_id?: string | null
        preferred_driver_source?: string | null
        preferred_driver_status?: string | null
        product_tva_exempt?: boolean | null
        referral_discount_total?: Json | null
        requested_delivery_date?: string | null
        requested_delivery_slot_id?: string | null
        requested_delivery_slot_label?: string | null
        return_requested?: boolean | null
        second_payment_amount?: Json | null
        second_payment_due_at?: string | null
        second_payment_paid_at?: string | null
        second_payment_receipt_url?: string | null
        second_payment_status?: string | null
        shipping_address: string
        shipping_city: string
        shipping_cost?: number | null
        shipping_country?: string | null
        shipping_latitude?: number | null
        shipping_longitude?: number | null
        status?: 'pending' | 'vendor_accepted' | 'vendor_rejected' | 'driver_assigned' | 'driver_accepted' | 'driver_picked_up' | 'on_the_way' | 'delivered' | 'cancelled' | null
        store_id?: string | null
        subtotal: number
        tax?: number | null
        total: number
        updated_at?: string | null
        vendor_amount?: Json | null
        vendor_cancellation_reason?: string | null
        vendor_compliance_flag?: string | null
        vendor_confirmed_at?: string | null
        vendor_id: string
        vendor_latitude?: number | null
        vendor_longitude?: number | null
        vendor_notes?: string | null
        vendor_prepared_at?: string | null
        vendor_product_total?: Json | null
        vendor_response_at?: string | null
        vendor_store_type?: string | null
        vendor_wait_response?: boolean | null
        waiting_period_days?: number | null
      }, {
        accepted_at?: string | null
        actual_sale_amount?: Json | null
        applied_coupon_id?: string | null
        bulk_discount_total?: Json | null
        buyer_cancellation_reason?: string | null
        buyer_commission?: Json | null
        buyer_id?: string | null
        buyer_notes?: string | null
        buyer_total?: Json | null
        cancellation_policy_snapshot?: Json | null
        cancellation_reason?: string | null
        cancellation_requested_at?: string | null
        cancellation_requested_by?: string | null
        cancelled_at?: string | null
        cancelled_by?: string | null
        cargo_size?: string | null
        commission?: Json | null
        commission_rate?: Json | null
        coupon_discount_total?: Json | null
        created_at?: string | null
        deleted_at?: string | null
        delivered_at?: string | null
        delivery_base_fee?: Json | null
        delivery_distance_fee?: Json | null
        delivery_distance_km?: Json | null
        delivery_fee_breakdown?: Json | null
        delivery_fee_total?: Json | null
        delivery_option?: string | null
        delivery_schedule_snapshot?: Json | null
        delivery_time_multiplier?: Json | null
        discount_total?: Json | null
        driver_accepted_at?: string | null
        driver_amount?: Json | null
        driver_assigned_at?: string | null
        driver_commission?: Json | null
        driver_delivery_paid_at?: string | null
        driver_delivery_payment_method?: string | null
        driver_delivery_payment_notes?: string | null
        driver_delivery_payment_status?: string | null
        driver_id?: string | null
        driver_preferences_snapshot?: Json | null
        estimated_delivery_time?: string | null
        first_payment_amount?: Json | null
        first_payment_paid_at?: string | null
        first_payment_receipt_url?: string | null
        first_payment_status?: string | null
        fulfillment_deadline_hours?: number | null
        fulfillment_met_deadline?: boolean | null
        id?: string | null
        invoice_generated_at?: string | null
        invoice_metadata?: Json | null
        invoice_number?: string | null
        invoice_status?: string | null
        legal_capture_completed?: boolean | null
        legal_capture_required?: boolean | null
        loyalty_discount_total?: Json | null
        loyalty_points_earned?: number | null
        loyalty_points_redeemed?: number | null
        minimum_order_amount_snapshot?: Json | null
        minimum_order_shortfall?: Json | null
        order_number?: string | null
        payment_dispute_opened_at?: string | null
        payment_dispute_reason?: string | null
        payment_disputed?: boolean | null
        payment_received_amount?: Json | null
        payment_received_at?: string | null
        payment_received_by?: string | null
        payment_status?: string | null
        payment_type?: string | null
        payment_verified_by_vendor?: boolean | null
        platform_commission_rate_snapshot?: Json | null
        preferred_driver_assigned_at?: string | null
        preferred_driver_id?: string | null
        preferred_driver_source?: string | null
        preferred_driver_status?: string | null
        product_tva_exempt?: boolean | null
        referral_discount_total?: Json | null
        requested_delivery_date?: string | null
        requested_delivery_slot_id?: string | null
        requested_delivery_slot_label?: string | null
        return_requested?: boolean | null
        second_payment_amount?: Json | null
        second_payment_due_at?: string | null
        second_payment_paid_at?: string | null
        second_payment_receipt_url?: string | null
        second_payment_status?: string | null
        shipping_address?: string | null
        shipping_city?: string | null
        shipping_cost?: number | null
        shipping_country?: string | null
        shipping_latitude?: number | null
        shipping_longitude?: number | null
        status?: 'pending' | 'vendor_accepted' | 'vendor_rejected' | 'driver_assigned' | 'driver_accepted' | 'driver_picked_up' | 'on_the_way' | 'delivered' | 'cancelled' | null
        store_id?: string | null
        subtotal?: number | null
        tax?: number | null
        total?: number | null
        updated_at?: string | null
        vendor_amount?: Json | null
        vendor_cancellation_reason?: string | null
        vendor_compliance_flag?: string | null
        vendor_confirmed_at?: string | null
        vendor_id?: string | null
        vendor_latitude?: number | null
        vendor_longitude?: number | null
        vendor_notes?: string | null
        vendor_prepared_at?: string | null
        vendor_product_total?: Json | null
        vendor_response_at?: string | null
        vendor_store_type?: string | null
        vendor_wait_response?: boolean | null
        waiting_period_days?: number | null
      }>
      otp_codes: TableDef<{
        attempts: number | null
        code: string
        created_at: string | null
        expires_at: string
        id: string
        ip_address: string | null
        locked_until: string | null
        max_attempts: number | null
        purpose: string
        used: boolean | null
        used_at: string | null
        user_id: string | null
      }, {
        attempts?: number | null
        code: string
        created_at?: string | null
        expires_at: string
        id?: string | null
        ip_address?: string | null
        locked_until?: string | null
        max_attempts?: number | null
        purpose: string
        used?: boolean | null
        used_at?: string | null
        user_id?: string | null
      }, {
        attempts?: number | null
        code?: string | null
        created_at?: string | null
        expires_at?: string | null
        id?: string | null
        ip_address?: string | null
        locked_until?: string | null
        max_attempts?: number | null
        purpose?: string | null
        used?: boolean | null
        used_at?: string | null
        user_id?: string | null
      }>
      partnership_requests: TableDef<{
        created_at: string
        id: string
        message: string | null
        requester_id: string
        requester_role: string
        responded_at: string | null
        status: string
        target_id: string
        target_role: string
        updated_at: string
      }, {
        created_at?: string | null
        id?: string | null
        message?: string | null
        requester_id: string
        requester_role: string
        responded_at?: string | null
        status?: string | null
        target_id: string
        target_role: string
        updated_at?: string | null
      }, {
        created_at?: string | null
        id?: string | null
        message?: string | null
        requester_id?: string | null
        requester_role?: string | null
        responded_at?: string | null
        status?: string | null
        target_id?: string | null
        target_role?: string | null
        updated_at?: string | null
      }>
      payment_disputes: TableDef<{
        admin_notes: string | null
        buyer_data_released: boolean | null
        buyer_id: string | null
        created_at: string | null
        description: string
        dispute_type: string
        evidence_urls: string[] | null
        id: string
        legal_action_flag: boolean | null
        order_id: string | null
        resolution: string | null
        resolved_at: string | null
        resolved_by: string | null
        status: string | null
        vendor_id: string | null
      }, {
        admin_notes?: string | null
        buyer_data_released?: boolean | null
        buyer_id?: string | null
        created_at?: string | null
        description: string
        dispute_type: string
        evidence_urls?: string[] | null
        id?: string | null
        legal_action_flag?: boolean | null
        order_id?: string | null
        resolution?: string | null
        resolved_at?: string | null
        resolved_by?: string | null
        status?: string | null
        vendor_id?: string | null
      }, {
        admin_notes?: string | null
        buyer_data_released?: boolean | null
        buyer_id?: string | null
        created_at?: string | null
        description?: string | null
        dispute_type?: string | null
        evidence_urls?: string[] | null
        id?: string | null
        legal_action_flag?: boolean | null
        order_id?: string | null
        resolution?: string | null
        resolved_at?: string | null
        resolved_by?: string | null
        status?: string | null
        vendor_id?: string | null
      }>
      payment_terms_acceptance: TableDef<{
        accepted_at: string | null
        id: string
        ip_address: string | null
        order_id: string | null
        payment_type: string
        terms_version: string | null
        user_id: string | null
        warning_shown: boolean | null
      }, {
        accepted_at?: string | null
        id?: string | null
        ip_address?: string | null
        order_id?: string | null
        payment_type: string
        terms_version?: string | null
        user_id?: string | null
        warning_shown?: boolean | null
      }, {
        accepted_at?: string | null
        id?: string | null
        ip_address?: string | null
        order_id?: string | null
        payment_type?: string | null
        terms_version?: string | null
        user_id?: string | null
        warning_shown?: boolean | null
      }>
      payments: TableDef<{
        admin_notes: string | null
        amount: number
        auth_code: string | null
        bank_name: string | null
        commission: number | null
        commission_rate: number | null
        confirmed_at: string | null
        created_at: string | null
        currency: string | null
        customer_email: string | null
        customer_name: string | null
        customer_phone: string | null
        failure_reason: string | null
        gateway_response: Json | null
        gateway_transaction_id: string | null
        id: string
        method: 'cod' | 'bank_transfer' | 'card'
        order_id: string
        paid_at: string | null
        payment_gateway: string | null
        payment_intent_id: string | null
        payment_method: string
        payment_number: string
        payment_proof_url: string | null
        payment_reference: string | null
        reference_number: string | null
        refund_amount: Json | null
        refund_reason: string | null
        refunded_at: string | null
        status: Json
        transaction_id: string | null
        updated_at: string | null
        user_id: string | null
        vendor_amount: number | null
      }, {
        admin_notes?: string | null
        amount: number
        auth_code?: string | null
        bank_name?: string | null
        commission?: number | null
        commission_rate?: number | null
        confirmed_at?: string | null
        created_at?: string | null
        currency?: string | null
        customer_email?: string | null
        customer_name?: string | null
        customer_phone?: string | null
        failure_reason?: string | null
        gateway_response?: Json | null
        gateway_transaction_id?: string | null
        id?: string | null
        method?: 'cod' | 'bank_transfer' | 'card' | null
        order_id: string
        paid_at?: string | null
        payment_gateway?: string | null
        payment_intent_id?: string | null
        payment_method: string
        payment_number: string
        payment_proof_url?: string | null
        payment_reference?: string | null
        reference_number?: string | null
        refund_amount?: Json | null
        refund_reason?: string | null
        refunded_at?: string | null
        status?: Json | null
        transaction_id?: string | null
        updated_at?: string | null
        user_id?: string | null
        vendor_amount?: number | null
      }, {
        admin_notes?: string | null
        amount?: number | null
        auth_code?: string | null
        bank_name?: string | null
        commission?: number | null
        commission_rate?: number | null
        confirmed_at?: string | null
        created_at?: string | null
        currency?: string | null
        customer_email?: string | null
        customer_name?: string | null
        customer_phone?: string | null
        failure_reason?: string | null
        gateway_response?: Json | null
        gateway_transaction_id?: string | null
        id?: string | null
        method?: 'cod' | 'bank_transfer' | 'card' | null
        order_id?: string | null
        paid_at?: string | null
        payment_gateway?: string | null
        payment_intent_id?: string | null
        payment_method?: string | null
        payment_number?: string | null
        payment_proof_url?: string | null
        payment_reference?: string | null
        reference_number?: string | null
        refund_amount?: Json | null
        refund_reason?: string | null
        refunded_at?: string | null
        status?: Json | null
        transaction_id?: string | null
        updated_at?: string | null
        user_id?: string | null
        vendor_amount?: number | null
      }>
      payouts: TableDef<{
        amount: number
        bank_account_id: string | null
        completed_at: string | null
        created_at: string | null
        created_by: string | null
        currency: string
        failed_reason: string | null
        first_approved_at: string | null
        first_approved_by: string | null
        gateway_response: Json | null
        id: string
        notes: string | null
        orders_count: number | null
        orders_ids: string[] | null
        payout_method: string
        period_end: string | null
        period_start: string | null
        processed_at: string | null
        processed_by: string | null
        reference_number: string | null
        rejected_at: string | null
        rejected_by: string | null
        rejection_reason: string | null
        requires_second_approval: boolean | null
        second_approved_at: string | null
        second_approved_by: string | null
        status: string
        transaction_id: string | null
        updated_at: string | null
        vendor_id: string
      }, {
        amount: number
        bank_account_id?: string | null
        completed_at?: string | null
        created_at?: string | null
        created_by?: string | null
        currency?: string | null
        failed_reason?: string | null
        first_approved_at?: string | null
        first_approved_by?: string | null
        gateway_response?: Json | null
        id?: string | null
        notes?: string | null
        orders_count?: number | null
        orders_ids?: string[] | null
        payout_method?: string | null
        period_end?: string | null
        period_start?: string | null
        processed_at?: string | null
        processed_by?: string | null
        reference_number?: string | null
        rejected_at?: string | null
        rejected_by?: string | null
        rejection_reason?: string | null
        requires_second_approval?: boolean | null
        second_approved_at?: string | null
        second_approved_by?: string | null
        status?: string | null
        transaction_id?: string | null
        updated_at?: string | null
        vendor_id: string
      }, {
        amount?: number | null
        bank_account_id?: string | null
        completed_at?: string | null
        created_at?: string | null
        created_by?: string | null
        currency?: string | null
        failed_reason?: string | null
        first_approved_at?: string | null
        first_approved_by?: string | null
        gateway_response?: Json | null
        id?: string | null
        notes?: string | null
        orders_count?: number | null
        orders_ids?: string[] | null
        payout_method?: string | null
        period_end?: string | null
        period_start?: string | null
        processed_at?: string | null
        processed_by?: string | null
        reference_number?: string | null
        rejected_at?: string | null
        rejected_by?: string | null
        rejection_reason?: string | null
        requires_second_approval?: boolean | null
        second_approved_at?: string | null
        second_approved_by?: string | null
        status?: string | null
        transaction_id?: string | null
        updated_at?: string | null
        vendor_id?: string | null
      }>
      phone_otp: TableDef<{
        attempts: number | null
        created_at: string | null
        expires_at: string
        id: string
        otp_code: string
        phone: string
        purpose: string
        used: boolean | null
        used_at: string | null
        user_id: string | null
      }, {
        attempts?: number | null
        created_at?: string | null
        expires_at: string
        id?: string | null
        otp_code: string
        phone: string
        purpose: string
        used?: boolean | null
        used_at?: string | null
        user_id?: string | null
      }, {
        attempts?: number | null
        created_at?: string | null
        expires_at?: string | null
        id?: string | null
        otp_code?: string | null
        phone?: string | null
        purpose?: string | null
        used?: boolean | null
        used_at?: string | null
        user_id?: string | null
      }>
      platform_commissions: TableDef<{
        buyer_commission: number | null
        buyer_commission_rate: number | null
        buyer_id: string | null
        created_at: string | null
        driver_amount: number | null
        driver_commission: number | null
        driver_commission_rate: number | null
        driver_id: string | null
        id: string
        order_id: string
        subtotal: number
        total_platform_revenue: number | null
        vendor_amount: number | null
        vendor_commission: number | null
        vendor_commission_rate: number | null
        vendor_id: string | null
      }, {
        buyer_commission?: number | null
        buyer_commission_rate?: number | null
        buyer_id?: string | null
        created_at?: string | null
        driver_amount?: number | null
        driver_commission?: number | null
        driver_commission_rate?: number | null
        driver_id?: string | null
        id?: string | null
        order_id: string
        subtotal: number
        total_platform_revenue?: number | null
        vendor_amount?: number | null
        vendor_commission?: number | null
        vendor_commission_rate?: number | null
        vendor_id?: string | null
      }, {
        buyer_commission?: number | null
        buyer_commission_rate?: number | null
        buyer_id?: string | null
        created_at?: string | null
        driver_amount?: number | null
        driver_commission?: number | null
        driver_commission_rate?: number | null
        driver_id?: string | null
        id?: string | null
        order_id?: string | null
        subtotal?: number | null
        total_platform_revenue?: number | null
        vendor_amount?: number | null
        vendor_commission?: number | null
        vendor_commission_rate?: number | null
        vendor_id?: string | null
      }>
      platform_settings: TableDef<{
        id: string
        setting_key: string
        setting_value: Json | null
        updated_at: string | null
        updated_by: string | null
      }, {
        id?: string | null
        setting_key: string
        setting_value?: Json | null
        updated_at?: string | null
        updated_by?: string | null
      }, {
        id?: string | null
        setting_key?: string | null
        setting_value?: Json | null
        updated_at?: string | null
        updated_by?: string | null
      }>
      product_condition_photos: TableDef<{
        actor_role: string
        buyer_id: string | null
        capture_stage: string
        captured_address: string | null
        captured_at: string | null
        captured_by: string
        created_at: string | null
        delivery_id: string | null
        driver_id: string | null
        gps_latitude: number
        gps_longitude: number
        id: string
        metadata: Json | null
        notes: string | null
        order_id: string
        storage_path: string
        vendor_id: string | null
        watermark_text: string | null
      }, {
        actor_role: string
        buyer_id?: string | null
        capture_stage: string
        captured_address?: string | null
        captured_at?: string | null
        captured_by: string
        created_at?: string | null
        delivery_id?: string | null
        driver_id?: string | null
        gps_latitude: number
        gps_longitude: number
        id?: string | null
        metadata?: Json | null
        notes?: string | null
        order_id: string
        storage_path: string
        vendor_id?: string | null
        watermark_text?: string | null
      }, {
        actor_role?: string | null
        buyer_id?: string | null
        capture_stage?: string | null
        captured_address?: string | null
        captured_at?: string | null
        captured_by?: string | null
        created_at?: string | null
        delivery_id?: string | null
        driver_id?: string | null
        gps_latitude?: number | null
        gps_longitude?: number | null
        id?: string | null
        metadata?: Json | null
        notes?: string | null
        order_id?: string | null
        storage_path?: string | null
        vendor_id?: string | null
        watermark_text?: string | null
      }>
      product_images: TableDef<{
        created_at: string | null
        id: string
        is_primary: boolean | null
        product_id: string
        sort_order: number | null
        url: string
      }, {
        created_at?: string | null
        id?: string | null
        is_primary?: boolean | null
        product_id: string
        sort_order?: number | null
        url: string
      }, {
        created_at?: string | null
        id?: string | null
        is_primary?: boolean | null
        product_id?: string | null
        sort_order?: number | null
        url?: string | null
      }>
      product_reviews: TableDef<{
        buyer_id: string
        comment: string | null
        created_at: string | null
        id: string
        order_id: string | null
        product_id: string
        rating: number
      }, {
        buyer_id: string
        comment?: string | null
        created_at?: string | null
        id?: string | null
        order_id?: string | null
        product_id: string
        rating: number
      }, {
        buyer_id?: string | null
        comment?: string | null
        created_at?: string | null
        id?: string | null
        order_id?: string | null
        product_id?: string | null
        rating?: number | null
      }>
      product_waitlists: TableDef<{
        created_at: string
        id: string
        note: string | null
        notified_at: string | null
        notify_in_app: boolean
        notify_sms: boolean
        product_id: string
        requested_quantity: number
        status: string
        user_id: string
      }, {
        created_at?: string | null
        id?: string | null
        note?: string | null
        notified_at?: string | null
        notify_in_app?: boolean | null
        notify_sms?: boolean | null
        product_id: string
        requested_quantity?: number | null
        status?: string | null
        user_id: string
      }, {
        created_at?: string | null
        id?: string | null
        note?: string | null
        notified_at?: string | null
        notify_in_app?: boolean | null
        notify_sms?: boolean | null
        product_id?: string | null
        requested_quantity?: number | null
        status?: string | null
        user_id?: string | null
      }>
      products: TableDef<{
        approval_status: string
        approved_at: string | null
        approved_by: string | null
        available_quantity: number
        average_rating: Json | null
        category: 'plants' | 'vegetables' | 'fruits' | 'herbs' | 'seeds'
        compliance_notes: string | null
        created_at: string | null
        deleted_at: string | null
        description: string | null
        description_quality_score: Json | null
        id: string
        image_url: string | null
        images_count: number | null
        is_active: boolean | null
        is_available: boolean | null
        last_restocked_at: string | null
        last_stock_alert_at: string | null
        last_stock_update_at: string | null
        latitude: number | null
        longitude: number | null
        min_order_quantity: number | null
        name: string
        price_fairness_flag: boolean | null
        price_per_unit: number
        rejection_reason: string | null
        requires_vehicle_type: Json | null
        reviews_count: number | null
        search_document: Json | null
        stock_accuracy_rate: Json | null
        stock_alert_threshold: Json | null
        stock_quantity: Json | null
        store_id: string | null
        subcategory: string | null
        total_sold: Json | null
        unit_type: string
        updated_at: string | null
        vendor_id: string
        waitlist_count: number | null
        waitlist_enabled: boolean | null
      }, {
        approval_status?: string | null
        approved_at?: string | null
        approved_by?: string | null
        available_quantity: number
        average_rating?: Json | null
        category: 'plants' | 'vegetables' | 'fruits' | 'herbs' | 'seeds'
        compliance_notes?: string | null
        created_at?: string | null
        deleted_at?: string | null
        description?: string | null
        description_quality_score?: Json | null
        id?: string | null
        image_url?: string | null
        images_count?: number | null
        is_active?: boolean | null
        is_available?: boolean | null
        last_restocked_at?: string | null
        last_stock_alert_at?: string | null
        last_stock_update_at?: string | null
        latitude?: number | null
        longitude?: number | null
        min_order_quantity?: number | null
        name: string
        price_fairness_flag?: boolean | null
        price_per_unit: number
        rejection_reason?: string | null
        requires_vehicle_type?: Json | null
        reviews_count?: number | null
        search_document?: Json | null
        stock_accuracy_rate?: Json | null
        stock_alert_threshold?: Json | null
        stock_quantity?: Json | null
        store_id?: string | null
        subcategory?: string | null
        total_sold?: Json | null
        unit_type?: string | null
        updated_at?: string | null
        vendor_id: string
        waitlist_count?: number | null
        waitlist_enabled?: boolean | null
      }, {
        approval_status?: string | null
        approved_at?: string | null
        approved_by?: string | null
        available_quantity?: number | null
        average_rating?: Json | null
        category?: 'plants' | 'vegetables' | 'fruits' | 'herbs' | 'seeds' | null
        compliance_notes?: string | null
        created_at?: string | null
        deleted_at?: string | null
        description?: string | null
        description_quality_score?: Json | null
        id?: string | null
        image_url?: string | null
        images_count?: number | null
        is_active?: boolean | null
        is_available?: boolean | null
        last_restocked_at?: string | null
        last_stock_alert_at?: string | null
        last_stock_update_at?: string | null
        latitude?: number | null
        longitude?: number | null
        min_order_quantity?: number | null
        name?: string | null
        price_fairness_flag?: boolean | null
        price_per_unit?: number | null
        rejection_reason?: string | null
        requires_vehicle_type?: Json | null
        reviews_count?: number | null
        search_document?: Json | null
        stock_accuracy_rate?: Json | null
        stock_alert_threshold?: Json | null
        stock_quantity?: Json | null
        store_id?: string | null
        subcategory?: string | null
        total_sold?: Json | null
        unit_type?: string | null
        updated_at?: string | null
        vendor_id?: string | null
        waitlist_count?: number | null
        waitlist_enabled?: boolean | null
      }>
      profiles: TableDef<{
        accepted_cargo_sizes: string[] | null
        active_products_count: number | null
        address: string | null
        agreement_accepted: boolean | null
        agreement_accepted_at: string | null
        agreement_version: string | null
        avatar_url: string | null
        business_hours: Json | null
        center_lat: number | null
        center_lng: number | null
        cin: string | null
        cin_number: string | null
        cin_verified: boolean | null
        cin_verified_at: string | null
        cin_verified_by: string | null
        city: string | null
        cod_eligible: boolean | null
        cod_restricted_until: string | null
        completed_orders_count: number | null
        country: string | null
        created_at: string | null
        current_active_deliveries: number | null
        data_sharing: boolean | null
        deleted_at: string | null
        delivery_option: string | null
        delivery_option_updated_at: string | null
        driver_delivery_payment_cash: boolean | null
        driver_delivery_payment_notes: string | null
        driver_delivery_payment_transfer: boolean | null
        driver_delivery_preferences_updated_at: string | null
        driver_rating: number | null
        driver_search_done: boolean | null
        email: string
        email_notifications: boolean | null
        failed_login_count: number | null
        failed_payments_count: number | null
        first_name: string
        grace_period_ends: string | null
        has_own_driver: boolean | null
        has_preferred_vendor: boolean | null
        id: string
        insurance_expiry_date: string | null
        insurance_verified: boolean | null
        is_active: boolean | null
        is_approved: boolean | null
        is_available_for_delivery: boolean | null
        is_suspended: boolean | null
        is_verified: boolean | null
        last_name: string
        last_seen_at: string | null
        last_violation_at: string | null
        latitude: number | null
        license_expiry_date: string | null
        license_number: string | null
        license_verified: boolean | null
        locked_until: string | null
        longitude: number | null
        low_stock_threshold: Json | null
        marketing_emails: boolean | null
        max_concurrent_deliveries: number | null
        max_delivery_distance_km: Json | null
        min_delivery_distance_km: Json | null
        min_order_amount: Json | null
        notify_customer_messages: boolean | null
        notify_low_stock: boolean | null
        notify_new_deliveries: boolean | null
        notify_order_updates: boolean | null
        onboarding_completed: boolean | null
        onboarding_step: number | null
        order_updates: boolean | null
        partnership_notes: string | null
        partnership_status: string | null
        partnership_updated_at: string | null
        paused_active_products: string[] | null
        payment_policy_cod: boolean | null
        payment_policy_full: boolean | null
        payment_policy_split: boolean | null
        payment_policy_updated_at: string | null
        phone: string | null
        phone_verified: boolean | null
        phone_verified_at: string | null
        preferred_driver_id: string | null
        preferred_driver_linked_at: string | null
        preferred_vendor_id: string | null
        preferred_vendor_linked_at: string | null
        rating: Json | null
        referral_code: string | null
        referral_completed_at: string | null
        referred_by: string | null
        role: 'admin' | 'vendor' | 'buyer' | 'driver'
        service_regions: string[] | null
        show_live_driver_map: boolean | null
        store_address: string | null
        store_description: string | null
        store_image_url: string | null
        store_name: string | null
        store_paused: boolean | null
        store_paused_at: string | null
        store_paused_reason: string | null
        store_resume_at: string | null
        store_type: string | null
        store_type_updated_at: string | null
        stripe_customer_id: string | null
        stripe_subscription_id: string | null
        subscription_end: string | null
        subscription_plan: string | null
        subscription_start: string | null
        subscription_status: string | null
        suspension_end: string | null
        suspension_reason: string | null
        suspension_start: string | null
        total_deliveries: number | null
        trust_score: number | null
        updated_at: string | null
        vehicle_make: string | null
        vehicle_photo: string | null
        vehicle_plate: string | null
        vehicle_type: Json | null
        vehicle_year: number | null
        vendor_avg_response_hours: Json | null
        vendor_compliance_score: Json | null
        vendor_fulfillment_rate: Json | null
        vendor_guidelines_accepted: boolean | null
        vendor_guidelines_accepted_at: string | null
        vendor_last_violation_at: string | null
        vendor_on_time_delivery_rate: Json | null
        vendor_search_done: boolean | null
        vendor_status: 'pending' | 'approved' | 'rejected' | null
        vendor_suspension_count: number | null
        vendor_warning_count: number | null
        verification_documents: Json | null
        verification_status: string | null
        violation_count: number | null
      }, {
        accepted_cargo_sizes?: string[] | null
        active_products_count?: number | null
        address?: string | null
        agreement_accepted?: boolean | null
        agreement_accepted_at?: string | null
        agreement_version?: string | null
        avatar_url?: string | null
        business_hours?: Json | null
        center_lat?: number | null
        center_lng?: number | null
        cin?: string | null
        cin_number?: string | null
        cin_verified?: boolean | null
        cin_verified_at?: string | null
        cin_verified_by?: string | null
        city?: string | null
        cod_eligible?: boolean | null
        cod_restricted_until?: string | null
        completed_orders_count?: number | null
        country?: string | null
        created_at?: string | null
        current_active_deliveries?: number | null
        data_sharing?: boolean | null
        deleted_at?: string | null
        delivery_option?: string | null
        delivery_option_updated_at?: string | null
        driver_delivery_payment_cash?: boolean | null
        driver_delivery_payment_notes?: string | null
        driver_delivery_payment_transfer?: boolean | null
        driver_delivery_preferences_updated_at?: string | null
        driver_rating?: number | null
        driver_search_done?: boolean | null
        email: string
        email_notifications?: boolean | null
        failed_login_count?: number | null
        failed_payments_count?: number | null
        first_name: string
        grace_period_ends?: string | null
        has_own_driver?: boolean | null
        has_preferred_vendor?: boolean | null
        id: string
        insurance_expiry_date?: string | null
        insurance_verified?: boolean | null
        is_active?: boolean | null
        is_approved?: boolean | null
        is_available_for_delivery?: boolean | null
        is_suspended?: boolean | null
        is_verified?: boolean | null
        last_name: string
        last_seen_at?: string | null
        last_violation_at?: string | null
        latitude?: number | null
        license_expiry_date?: string | null
        license_number?: string | null
        license_verified?: boolean | null
        locked_until?: string | null
        longitude?: number | null
        low_stock_threshold?: Json | null
        marketing_emails?: boolean | null
        max_concurrent_deliveries?: number | null
        max_delivery_distance_km?: Json | null
        min_delivery_distance_km?: Json | null
        min_order_amount?: Json | null
        notify_customer_messages?: boolean | null
        notify_low_stock?: boolean | null
        notify_new_deliveries?: boolean | null
        notify_order_updates?: boolean | null
        onboarding_completed?: boolean | null
        onboarding_step?: number | null
        order_updates?: boolean | null
        partnership_notes?: string | null
        partnership_status?: string | null
        partnership_updated_at?: string | null
        paused_active_products?: string[] | null
        payment_policy_cod?: boolean | null
        payment_policy_full?: boolean | null
        payment_policy_split?: boolean | null
        payment_policy_updated_at?: string | null
        phone?: string | null
        phone_verified?: boolean | null
        phone_verified_at?: string | null
        preferred_driver_id?: string | null
        preferred_driver_linked_at?: string | null
        preferred_vendor_id?: string | null
        preferred_vendor_linked_at?: string | null
        rating?: Json | null
        referral_code?: string | null
        referral_completed_at?: string | null
        referred_by?: string | null
        role?: 'admin' | 'vendor' | 'buyer' | 'driver' | null
        service_regions?: string[] | null
        show_live_driver_map?: boolean | null
        store_address?: string | null
        store_description?: string | null
        store_image_url?: string | null
        store_name?: string | null
        store_paused?: boolean | null
        store_paused_at?: string | null
        store_paused_reason?: string | null
        store_resume_at?: string | null
        store_type?: string | null
        store_type_updated_at?: string | null
        stripe_customer_id?: string | null
        stripe_subscription_id?: string | null
        subscription_end?: string | null
        subscription_plan?: string | null
        subscription_start?: string | null
        subscription_status?: string | null
        suspension_end?: string | null
        suspension_reason?: string | null
        suspension_start?: string | null
        total_deliveries?: number | null
        trust_score?: number | null
        updated_at?: string | null
        vehicle_make?: string | null
        vehicle_photo?: string | null
        vehicle_plate?: string | null
        vehicle_type?: Json | null
        vehicle_year?: number | null
        vendor_avg_response_hours?: Json | null
        vendor_compliance_score?: Json | null
        vendor_fulfillment_rate?: Json | null
        vendor_guidelines_accepted?: boolean | null
        vendor_guidelines_accepted_at?: string | null
        vendor_last_violation_at?: string | null
        vendor_on_time_delivery_rate?: Json | null
        vendor_search_done?: boolean | null
        vendor_status?: 'pending' | 'approved' | 'rejected' | null
        vendor_suspension_count?: number | null
        vendor_warning_count?: number | null
        verification_documents?: Json | null
        verification_status?: string | null
        violation_count?: number | null
      }, {
        accepted_cargo_sizes?: string[] | null
        active_products_count?: number | null
        address?: string | null
        agreement_accepted?: boolean | null
        agreement_accepted_at?: string | null
        agreement_version?: string | null
        avatar_url?: string | null
        business_hours?: Json | null
        center_lat?: number | null
        center_lng?: number | null
        cin?: string | null
        cin_number?: string | null
        cin_verified?: boolean | null
        cin_verified_at?: string | null
        cin_verified_by?: string | null
        city?: string | null
        cod_eligible?: boolean | null
        cod_restricted_until?: string | null
        completed_orders_count?: number | null
        country?: string | null
        created_at?: string | null
        current_active_deliveries?: number | null
        data_sharing?: boolean | null
        deleted_at?: string | null
        delivery_option?: string | null
        delivery_option_updated_at?: string | null
        driver_delivery_payment_cash?: boolean | null
        driver_delivery_payment_notes?: string | null
        driver_delivery_payment_transfer?: boolean | null
        driver_delivery_preferences_updated_at?: string | null
        driver_rating?: number | null
        driver_search_done?: boolean | null
        email?: string | null
        email_notifications?: boolean | null
        failed_login_count?: number | null
        failed_payments_count?: number | null
        first_name?: string | null
        grace_period_ends?: string | null
        has_own_driver?: boolean | null
        has_preferred_vendor?: boolean | null
        id?: string | null
        insurance_expiry_date?: string | null
        insurance_verified?: boolean | null
        is_active?: boolean | null
        is_approved?: boolean | null
        is_available_for_delivery?: boolean | null
        is_suspended?: boolean | null
        is_verified?: boolean | null
        last_name?: string | null
        last_seen_at?: string | null
        last_violation_at?: string | null
        latitude?: number | null
        license_expiry_date?: string | null
        license_number?: string | null
        license_verified?: boolean | null
        locked_until?: string | null
        longitude?: number | null
        low_stock_threshold?: Json | null
        marketing_emails?: boolean | null
        max_concurrent_deliveries?: number | null
        max_delivery_distance_km?: Json | null
        min_delivery_distance_km?: Json | null
        min_order_amount?: Json | null
        notify_customer_messages?: boolean | null
        notify_low_stock?: boolean | null
        notify_new_deliveries?: boolean | null
        notify_order_updates?: boolean | null
        onboarding_completed?: boolean | null
        onboarding_step?: number | null
        order_updates?: boolean | null
        partnership_notes?: string | null
        partnership_status?: string | null
        partnership_updated_at?: string | null
        paused_active_products?: string[] | null
        payment_policy_cod?: boolean | null
        payment_policy_full?: boolean | null
        payment_policy_split?: boolean | null
        payment_policy_updated_at?: string | null
        phone?: string | null
        phone_verified?: boolean | null
        phone_verified_at?: string | null
        preferred_driver_id?: string | null
        preferred_driver_linked_at?: string | null
        preferred_vendor_id?: string | null
        preferred_vendor_linked_at?: string | null
        rating?: Json | null
        referral_code?: string | null
        referral_completed_at?: string | null
        referred_by?: string | null
        role?: 'admin' | 'vendor' | 'buyer' | 'driver' | null
        service_regions?: string[] | null
        show_live_driver_map?: boolean | null
        store_address?: string | null
        store_description?: string | null
        store_image_url?: string | null
        store_name?: string | null
        store_paused?: boolean | null
        store_paused_at?: string | null
        store_paused_reason?: string | null
        store_resume_at?: string | null
        store_type?: string | null
        store_type_updated_at?: string | null
        stripe_customer_id?: string | null
        stripe_subscription_id?: string | null
        subscription_end?: string | null
        subscription_plan?: string | null
        subscription_start?: string | null
        subscription_status?: string | null
        suspension_end?: string | null
        suspension_reason?: string | null
        suspension_start?: string | null
        total_deliveries?: number | null
        trust_score?: number | null
        updated_at?: string | null
        vehicle_make?: string | null
        vehicle_photo?: string | null
        vehicle_plate?: string | null
        vehicle_type?: Json | null
        vehicle_year?: number | null
        vendor_avg_response_hours?: Json | null
        vendor_compliance_score?: Json | null
        vendor_fulfillment_rate?: Json | null
        vendor_guidelines_accepted?: boolean | null
        vendor_guidelines_accepted_at?: string | null
        vendor_last_violation_at?: string | null
        vendor_on_time_delivery_rate?: Json | null
        vendor_search_done?: boolean | null
        vendor_status?: 'pending' | 'approved' | 'rejected' | null
        vendor_suspension_count?: number | null
        vendor_warning_count?: number | null
        verification_documents?: Json | null
        verification_status?: string | null
        violation_count?: number | null
      }>
      rate_limits: TableDef<{
        action: string
        blocked_until: string | null
        count: number | null
        created_at: string | null
        id: string
        identifier: string
        reset_at: string
        window_end: string | null
        window_start: string | null
      }, {
        action: string
        blocked_until?: string | null
        count?: number | null
        created_at?: string | null
        id?: string | null
        identifier: string
        reset_at: string
        window_end?: string | null
        window_start?: string | null
      }, {
        action?: string | null
        blocked_until?: string | null
        count?: number | null
        created_at?: string | null
        id?: string | null
        identifier?: string | null
        reset_at?: string | null
        window_end?: string | null
        window_start?: string | null
      }>
      referrals: TableDef<{
        created_at: string
        first_order_completed_at: string | null
        first_order_id: string | null
        id: string
        referral_code: string
        referred_user_id: string | null
        referrer_id: string
        reward_points: number
        reward_status: string
        updated_at: string
      }, {
        created_at?: string | null
        first_order_completed_at?: string | null
        first_order_id?: string | null
        id?: string | null
        referral_code: string
        referred_user_id?: string | null
        referrer_id: string
        reward_points?: number | null
        reward_status?: string | null
        updated_at?: string | null
      }, {
        created_at?: string | null
        first_order_completed_at?: string | null
        first_order_id?: string | null
        id?: string | null
        referral_code?: string | null
        referred_user_id?: string | null
        referrer_id?: string | null
        reward_points?: number | null
        reward_status?: string | null
        updated_at?: string | null
      }>
      refund_policies: TableDef<{
        allows_refund: boolean | null
        created_at: string | null
        id: string
        no_refund_reason: string | null
        refund_conditions: string | null
        refund_window_hours: number | null
        updated_at: string | null
        vendor_id: string | null
        who_pays_return: string | null
      }, {
        allows_refund?: boolean | null
        created_at?: string | null
        id?: string | null
        no_refund_reason?: string | null
        refund_conditions?: string | null
        refund_window_hours?: number | null
        updated_at?: string | null
        vendor_id?: string | null
        who_pays_return?: string | null
      }, {
        allows_refund?: boolean | null
        created_at?: string | null
        id?: string | null
        no_refund_reason?: string | null
        refund_conditions?: string | null
        refund_window_hours?: number | null
        updated_at?: string | null
        vendor_id?: string | null
        who_pays_return?: string | null
      }>
      regions: TableDef<{
        center_lat: number
        center_lng: number
        cities: string[]
        created_at: string | null
        id: string
        name_ar: string
        name_en: string | null
        name_fr: string
        neighboring_regions: string[] | null
        radius_km: number | null
        updated_at: string | null
      }, {
        center_lat: number
        center_lng: number
        cities: string[]
        created_at?: string | null
        id?: string | null
        name_ar: string
        name_en?: string | null
        name_fr: string
        neighboring_regions?: string[] | null
        radius_km?: number | null
        updated_at?: string | null
      }, {
        center_lat?: number | null
        center_lng?: number | null
        cities?: string[] | null
        created_at?: string | null
        id?: string | null
        name_ar?: string | null
        name_en?: string | null
        name_fr?: string | null
        neighboring_regions?: string[] | null
        radius_km?: number | null
        updated_at?: string | null
      }>
      request_rate_limits: TableDef<{
        attempt_count: number
        blocked_until: string | null
        created_at: string
        identifier_hash: string
        scope: string
        updated_at: string
        window_started_at: string
      }, {
        attempt_count?: number | null
        blocked_until?: string | null
        created_at?: string | null
        identifier_hash: string
        scope: string
        updated_at?: string | null
        window_started_at?: string | null
      }, {
        attempt_count?: number | null
        blocked_until?: string | null
        created_at?: string | null
        identifier_hash?: string | null
        scope?: string | null
        updated_at?: string | null
        window_started_at?: string | null
      }>
      return_requests: TableDef<{
        admin_id: string | null
        admin_response: string | null
        buyer_id: string
        created_at: string | null
        description: string | null
        id: string
        image_urls: Json | null
        items: Json | null
        order_id: string
        reason: string
        refund_amount: Json | null
        status: string
        updated_at: string | null
        user_id: string
        vendor_id: string
      }, {
        admin_id?: string | null
        admin_response?: string | null
        buyer_id: string
        created_at?: string | null
        description?: string | null
        id?: string | null
        image_urls?: Json | null
        items?: Json | null
        order_id: string
        reason: string
        refund_amount?: Json | null
        status?: string | null
        updated_at?: string | null
        user_id: string
        vendor_id: string
      }, {
        admin_id?: string | null
        admin_response?: string | null
        buyer_id?: string | null
        created_at?: string | null
        description?: string | null
        id?: string | null
        image_urls?: Json | null
        items?: Json | null
        order_id?: string | null
        reason?: string | null
        refund_amount?: Json | null
        status?: string | null
        updated_at?: string | null
        user_id?: string | null
        vendor_id?: string | null
      }>
      returns: TableDef<{
        buyer_id: string
        created_at: string | null
        id: string
        order_id: string
        reason: string
        refund_amount: number | null
        status: string | null
        updated_at: string | null
        vendor_id: string
      }, {
        buyer_id: string
        created_at?: string | null
        id?: string | null
        order_id: string
        reason: string
        refund_amount?: number | null
        status?: string | null
        updated_at?: string | null
        vendor_id: string
      }, {
        buyer_id?: string | null
        created_at?: string | null
        id?: string | null
        order_id?: string | null
        reason?: string | null
        refund_amount?: number | null
        status?: string | null
        updated_at?: string | null
        vendor_id?: string | null
      }>
      reviews: TableDef<{
        admin_notes: string | null
        approved_at: string | null
        approved_by: string | null
        buyer_id: string
        comment: string | null
        created_at: string | null
        deleted_at: string | null
        flagged_at: string | null
        id: string
        is_flagged: boolean
        order_id: string | null
        product_id: string | null
        rating: number
        updated_at: string
        user_id: string | null
        vendor_id: string
        vendor_reply: string | null
        vendor_reply_at: string | null
      }, {
        admin_notes?: string | null
        approved_at?: string | null
        approved_by?: string | null
        buyer_id: string
        comment?: string | null
        created_at?: string | null
        deleted_at?: string | null
        flagged_at?: string | null
        id?: string | null
        is_flagged?: boolean | null
        order_id?: string | null
        product_id?: string | null
        rating: number
        updated_at?: string | null
        user_id?: string | null
        vendor_id: string
        vendor_reply?: string | null
        vendor_reply_at?: string | null
      }, {
        admin_notes?: string | null
        approved_at?: string | null
        approved_by?: string | null
        buyer_id?: string | null
        comment?: string | null
        created_at?: string | null
        deleted_at?: string | null
        flagged_at?: string | null
        id?: string | null
        is_flagged?: boolean | null
        order_id?: string | null
        product_id?: string | null
        rating?: number | null
        updated_at?: string | null
        user_id?: string | null
        vendor_id?: string | null
        vendor_reply?: string | null
        vendor_reply_at?: string | null
      }>
      rfq_offers: TableDef<{
        created_at: string | null
        id: string
        message: string | null
        price_per_unit: number
        rfq_id: string
        vendor_id: string
      }, {
        created_at?: string | null
        id?: string | null
        message?: string | null
        price_per_unit: number
        rfq_id: string
        vendor_id: string
      }, {
        created_at?: string | null
        id?: string | null
        message?: string | null
        price_per_unit?: number | null
        rfq_id?: string | null
        vendor_id?: string | null
      }>
      rfqs: TableDef<{
        budget_max: number | null
        buyer_id: string
        category: string
        city: string | null
        created_at: string | null
        deadline: string | null
        description: string | null
        id: string
        quantity: number
        title: string
        unit: string
        updated_at: string | null
        winning_offer_id: string | null
      }, {
        budget_max?: number | null
        buyer_id: string
        category: string
        city?: string | null
        created_at?: string | null
        deadline?: string | null
        description?: string | null
        id?: string | null
        quantity: number
        title: string
        unit?: string | null
        updated_at?: string | null
        winning_offer_id?: string | null
      }, {
        budget_max?: number | null
        buyer_id?: string | null
        category?: string | null
        city?: string | null
        created_at?: string | null
        deadline?: string | null
        description?: string | null
        id?: string | null
        quantity?: number | null
        title?: string | null
        unit?: string | null
        updated_at?: string | null
        winning_offer_id?: string | null
      }>
      security_alerts: TableDef<{
        alert_type: string
        created_at: string | null
        description: string | null
        id: string
        ip_address: string | null
        is_resolved: boolean | null
        message: string
        metadata: Json | null
        request_method: string | null
        request_path: string | null
        resolution_notes: string | null
        resolved: boolean | null
        resolved_at: string | null
        resolved_by: string | null
        severity: string
        source_ip: string | null
        title: string
        user_agent: string | null
        user_id: string | null
      }, {
        alert_type: string
        created_at?: string | null
        description?: string | null
        id?: string | null
        ip_address?: string | null
        is_resolved?: boolean | null
        message: string
        metadata?: Json | null
        request_method?: string | null
        request_path?: string | null
        resolution_notes?: string | null
        resolved?: boolean | null
        resolved_at?: string | null
        resolved_by?: string | null
        severity?: string | null
        source_ip?: string | null
        title: string
        user_agent?: string | null
        user_id?: string | null
      }, {
        alert_type?: string | null
        created_at?: string | null
        description?: string | null
        id?: string | null
        ip_address?: string | null
        is_resolved?: boolean | null
        message?: string | null
        metadata?: Json | null
        request_method?: string | null
        request_path?: string | null
        resolution_notes?: string | null
        resolved?: boolean | null
        resolved_at?: string | null
        resolved_by?: string | null
        severity?: string | null
        source_ip?: string | null
        title?: string | null
        user_agent?: string | null
        user_id?: string | null
      }>
      settings_audit_log: TableDef<{
        changed_by: string | null
        created_at: string | null
        id: string
        new_value: Json | null
        old_value: Json | null
        setting_key: string
      }, {
        changed_by?: string | null
        created_at?: string | null
        id?: string | null
        new_value?: Json | null
        old_value?: Json | null
        setting_key: string
      }, {
        changed_by?: string | null
        created_at?: string | null
        id?: string | null
        new_value?: Json | null
        old_value?: Json | null
        setting_key?: string | null
      }>
      shopping_list_items: TableDef<{
        created_at: string | null
        id: string
        product_id: string | null
        quantity: number | null
        shopping_list_id: string
      }, {
        created_at?: string | null
        id?: string | null
        product_id?: string | null
        quantity?: number | null
        shopping_list_id: string
      }, {
        created_at?: string | null
        id?: string | null
        product_id?: string | null
        quantity?: number | null
        shopping_list_id?: string | null
      }>
      shopping_lists: TableDef<{
        created_at: string | null
        description: string | null
        id: string
        is_active: boolean | null
        name: string
        updated_at: string | null
        user_id: string
      }, {
        created_at?: string | null
        description?: string | null
        id?: string | null
        is_active?: boolean | null
        name: string
        updated_at?: string | null
        user_id: string
      }, {
        created_at?: string | null
        description?: string | null
        id?: string | null
        is_active?: boolean | null
        name?: string | null
        updated_at?: string | null
        user_id?: string | null
      }>
      stock_history: TableDef<{
        change_reason: string | null
        changed_by: string | null
        created_at: string | null
        id: string
        new_quantity: number
        old_quantity: number
        order_id: string | null
        product_id: string
        quantity_delta: number
        reason: string | null
        vendor_id: string
      }, {
        change_reason?: string | null
        changed_by?: string | null
        created_at?: string | null
        id?: string | null
        new_quantity: number
        old_quantity?: number | null
        order_id?: string | null
        product_id: string
        quantity_delta: number
        reason?: string | null
        vendor_id: string
      }, {
        change_reason?: string | null
        changed_by?: string | null
        created_at?: string | null
        id?: string | null
        new_quantity?: number | null
        old_quantity?: number | null
        order_id?: string | null
        product_id?: string | null
        quantity_delta?: number | null
        reason?: string | null
        vendor_id?: string | null
      }>
      store_follows: TableDef<{
        created_at: string | null
        id: string
        store_id: string
        user_id: string
      }, {
        created_at?: string | null
        id?: string | null
        store_id: string
        user_id: string
      }, {
        created_at?: string | null
        id?: string | null
        store_id?: string | null
        user_id?: string | null
      }>
      store_type_evolution_log: TableDef<{
        acknowledged_at: string | null
        created_at: string
        current_active_products_count: number
        current_delivery_option: string | null
        current_store_type: string
        id: string
        message_ar: string
        previous_active_products_count: number
        previous_delivery_option: string | null
        previous_store_type: string | null
        vendor_id: string
      }, {
        acknowledged_at?: string | null
        created_at?: string | null
        current_active_products_count?: number | null
        current_delivery_option?: string | null
        current_store_type: string
        id?: string | null
        message_ar: string
        previous_active_products_count?: number | null
        previous_delivery_option?: string | null
        previous_store_type?: string | null
        vendor_id: string
      }, {
        acknowledged_at?: string | null
        created_at?: string | null
        current_active_products_count?: number | null
        current_delivery_option?: string | null
        current_store_type?: string | null
        id?: string | null
        message_ar?: string | null
        previous_active_products_count?: number | null
        previous_delivery_option?: string | null
        previous_store_type?: string | null
        vendor_id?: string | null
      }>
      store_type_rules: TableDef<{
        allowed_delivery_options: string[]
        default_delivery_option: string
        description_ar: string
        label_ar: string
        max_products: number | null
        min_products: number
        sort_order: number
        store_type: string
      }, {
        allowed_delivery_options: string[]
        default_delivery_option: string
        description_ar: string
        label_ar: string
        max_products?: number | null
        min_products: number
        sort_order: number
        store_type: string
      }, {
        allowed_delivery_options?: string[] | null
        default_delivery_option?: string | null
        description_ar?: string | null
        label_ar?: string | null
        max_products?: number | null
        min_products?: number | null
        sort_order?: number | null
        store_type?: string | null
      }>
      stores: TableDef<{
        address: string | null
        city: string | null
        country: string | null
        created_at: string | null
        delivery_radius_km: number | null
        description: string | null
        id: string
        image_url: string | null
        is_active: boolean | null
        is_verified: boolean | null
        latitude: number | null
        longitude: number | null
        min_order_value: number | null
        name: string
        owner_id: string
        rating: number | null
        total_orders: number | null
        total_revenue: number | null
        total_reviews: number | null
        updated_at: string | null
      }, {
        address?: string | null
        city?: string | null
        country?: string | null
        created_at?: string | null
        delivery_radius_km?: number | null
        description?: string | null
        id?: string | null
        image_url?: string | null
        is_active?: boolean | null
        is_verified?: boolean | null
        latitude?: number | null
        longitude?: number | null
        min_order_value?: number | null
        name: string
        owner_id: string
        rating?: number | null
        total_orders?: number | null
        total_revenue?: number | null
        total_reviews?: number | null
        updated_at?: string | null
      }, {
        address?: string | null
        city?: string | null
        country?: string | null
        created_at?: string | null
        delivery_radius_km?: number | null
        description?: string | null
        id?: string | null
        image_url?: string | null
        is_active?: boolean | null
        is_verified?: boolean | null
        latitude?: number | null
        longitude?: number | null
        min_order_value?: number | null
        name?: string | null
        owner_id?: string | null
        rating?: number | null
        total_orders?: number | null
        total_revenue?: number | null
        total_reviews?: number | null
        updated_at?: string | null
      }>
      subscription_history: TableDef<{
        amount: number | null
        change_type: string
        created_at: string | null
        id: string
        new_plan: string
        old_plan: string | null
        reason: string | null
        stripe_event_id: string | null
        vendor_id: string
      }, {
        amount?: number | null
        change_type: string
        created_at?: string | null
        id?: string | null
        new_plan: string
        old_plan?: string | null
        reason?: string | null
        stripe_event_id?: string | null
        vendor_id: string
      }, {
        amount?: number | null
        change_type?: string | null
        created_at?: string | null
        id?: string | null
        new_plan?: string | null
        old_plan?: string | null
        reason?: string | null
        stripe_event_id?: string | null
        vendor_id?: string | null
      }>
      subscription_plans: TableDef<{
        commission_rate: number
        created_at: string | null
        features: Json | null
        id: string
        is_active: boolean | null
        max_products: number | null
        name: string
        name_ar: string
        price_monthly: number
        price_yearly: number
        stripe_price_id_monthly: string | null
        stripe_price_id_yearly: string | null
      }, {
        commission_rate?: number | null
        created_at?: string | null
        features?: Json | null
        id: string
        is_active?: boolean | null
        max_products?: number | null
        name: string
        name_ar: string
        price_monthly: number
        price_yearly: number
        stripe_price_id_monthly?: string | null
        stripe_price_id_yearly?: string | null
      }, {
        commission_rate?: number | null
        created_at?: string | null
        features?: Json | null
        id?: string | null
        is_active?: boolean | null
        max_products?: number | null
        name?: string | null
        name_ar?: string | null
        price_monthly?: number | null
        price_yearly?: number | null
        stripe_price_id_monthly?: string | null
        stripe_price_id_yearly?: string | null
      }>
      support_tickets: TableDef<{
        admin_response: string | null
        assigned_to: string | null
        attachments: string[] | null
        category: string
        created_at: string | null
        description: string
        id: string
        order_id: string | null
        priority: string | null
        rating: number | null
        resolved_at: string | null
        responded_at: string | null
        responded_by: string | null
        status: string | null
        subject: string
        updated_at: string | null
        user_id: string
      }, {
        admin_response?: string | null
        assigned_to?: string | null
        attachments?: string[] | null
        category: string
        created_at?: string | null
        description: string
        id?: string | null
        order_id?: string | null
        priority?: string | null
        rating?: number | null
        resolved_at?: string | null
        responded_at?: string | null
        responded_by?: string | null
        status?: string | null
        subject: string
        updated_at?: string | null
        user_id: string
      }, {
        admin_response?: string | null
        assigned_to?: string | null
        attachments?: string[] | null
        category?: string | null
        created_at?: string | null
        description?: string | null
        id?: string | null
        order_id?: string | null
        priority?: string | null
        rating?: number | null
        resolved_at?: string | null
        responded_at?: string | null
        responded_by?: string | null
        status?: string | null
        subject?: string | null
        updated_at?: string | null
        user_id?: string | null
      }>
      tier_pricing: TableDef<{
        created_at: string | null
        discount_percentage: number | null
        id: string
        is_active: boolean | null
        max_quantity: number | null
        min_quantity: number
        price_per_unit: number
        product_id: string | null
        updated_at: string | null
        vendor_id: string | null
      }, {
        created_at?: string | null
        discount_percentage?: number | null
        id?: string | null
        is_active?: boolean | null
        max_quantity?: number | null
        min_quantity: number
        price_per_unit: number
        product_id?: string | null
        updated_at?: string | null
        vendor_id?: string | null
      }, {
        created_at?: string | null
        discount_percentage?: number | null
        id?: string | null
        is_active?: boolean | null
        max_quantity?: number | null
        min_quantity?: number | null
        price_per_unit?: number | null
        product_id?: string | null
        updated_at?: string | null
        vendor_id?: string | null
      }>
      user_activity_log: TableDef<{
        action: string
        created_at: string | null
        device_info: string | null
        id: string
        ip_address: string | null
        location: string | null
        user_id: string | null
      }, {
        action: string
        created_at?: string | null
        device_info?: string | null
        id?: string | null
        ip_address?: string | null
        location?: string | null
        user_id?: string | null
      }, {
        action?: string | null
        created_at?: string | null
        device_info?: string | null
        id?: string | null
        ip_address?: string | null
        location?: string | null
        user_id?: string | null
      }>
      user_reports: TableDef<{
        action_taken: string | null
        admin_notes: string | null
        category: string
        category_id: string | null
        created_at: string | null
        description: string
        evidence_urls: string[] | null
        id: string
        priority: string
        report_type: string
        reported_user_id: string
        reporter_id: string
        resolution_notes: string | null
        resolved_at: string | null
        resolved_by: string | null
        status: string
        suspension_duration_hours: number | null
        updated_at: string | null
      }, {
        action_taken?: string | null
        admin_notes?: string | null
        category: string
        category_id?: string | null
        created_at?: string | null
        description: string
        evidence_urls?: string[] | null
        id?: string | null
        priority?: string | null
        report_type: string
        reported_user_id: string
        reporter_id: string
        resolution_notes?: string | null
        resolved_at?: string | null
        resolved_by?: string | null
        status?: string | null
        suspension_duration_hours?: number | null
        updated_at?: string | null
      }, {
        action_taken?: string | null
        admin_notes?: string | null
        category?: string | null
        category_id?: string | null
        created_at?: string | null
        description?: string | null
        evidence_urls?: string[] | null
        id?: string | null
        priority?: string | null
        report_type?: string | null
        reported_user_id?: string | null
        reporter_id?: string | null
        resolution_notes?: string | null
        resolved_at?: string | null
        resolved_by?: string | null
        status?: string | null
        suspension_duration_hours?: number | null
        updated_at?: string | null
      }>
      user_settings: TableDef<{
        created_at: string | null
        id: string
        setting_key: string
        setting_value: Json | null
        updated_at: string | null
        user_id: string
      }, {
        created_at?: string | null
        id?: string | null
        setting_key: string
        setting_value?: Json | null
        updated_at?: string | null
        user_id: string
      }, {
        created_at?: string | null
        id?: string | null
        setting_key?: string | null
        setting_value?: Json | null
        updated_at?: string | null
        user_id?: string | null
      }>
      user_violations: TableDef<{
        action_taken: string
        created_at: string | null
        description: string
        evidence: string | null
        id: string
        reported_by: string | null
        reviewed_by: string | null
        severity: string
        suspension_end: string | null
        suspension_start: string | null
        updated_at: string | null
        user_id: string | null
        violation_type: string
      }, {
        action_taken: string
        created_at?: string | null
        description: string
        evidence?: string | null
        id?: string | null
        reported_by?: string | null
        reviewed_by?: string | null
        severity: string
        suspension_end?: string | null
        suspension_start?: string | null
        updated_at?: string | null
        user_id?: string | null
        violation_type: string
      }, {
        action_taken?: string | null
        created_at?: string | null
        description?: string | null
        evidence?: string | null
        id?: string | null
        reported_by?: string | null
        reviewed_by?: string | null
        severity?: string | null
        suspension_end?: string | null
        suspension_start?: string | null
        updated_at?: string | null
        user_id?: string | null
        violation_type?: string | null
      }>
      vendor_cancellation_policies: TableDef<{
        allow_cancellation: boolean
        auto_approve_before_preparing: boolean
        cancellation_fee_type: string
        cancellation_fee_value: number
        created_at: string
        cutoff_status: string
        free_cancellation_window_minutes: number
        id: string
        policy_text_ar: string | null
        refund_percentage: number
        updated_at: string
        vendor_id: string
      }, {
        allow_cancellation?: boolean | null
        auto_approve_before_preparing?: boolean | null
        cancellation_fee_type?: string | null
        cancellation_fee_value?: number | null
        created_at?: string | null
        cutoff_status?: string | null
        free_cancellation_window_minutes?: number | null
        id?: string | null
        policy_text_ar?: string | null
        refund_percentage?: number | null
        updated_at?: string | null
        vendor_id: string
      }, {
        allow_cancellation?: boolean | null
        auto_approve_before_preparing?: boolean | null
        cancellation_fee_type?: string | null
        cancellation_fee_value?: number | null
        created_at?: string | null
        cutoff_status?: string | null
        free_cancellation_window_minutes?: number | null
        id?: string | null
        policy_text_ar?: string | null
        refund_percentage?: number | null
        updated_at?: string | null
        vendor_id?: string | null
      }>
      vendor_compliance_log: TableDef<{
        action_taken: string | null
        created_at: string | null
        description: string
        id: string
        order_id: string | null
        product_id: string | null
        resolved_at: string | null
        resolved_by: string | null
        severity: string
        vendor_id: string
        violation_type: string
      }, {
        action_taken?: string | null
        created_at?: string | null
        description: string
        id?: string | null
        order_id?: string | null
        product_id?: string | null
        resolved_at?: string | null
        resolved_by?: string | null
        severity: string
        vendor_id: string
        violation_type: string
      }, {
        action_taken?: string | null
        created_at?: string | null
        description?: string | null
        id?: string | null
        order_id?: string | null
        product_id?: string | null
        resolved_at?: string | null
        resolved_by?: string | null
        severity?: string | null
        vendor_id?: string | null
        violation_type?: string | null
      }>
      vendor_contracts: TableDef<{
        agreed_account_freeze: boolean | null
        agreed_commission_rate: number | null
        agreed_debt_survives_deletion: boolean | null
        agreed_payment_deadline: number | null
        bank_account_holder: string
        bank_iban: string
        bank_name: string
        cin: string
        contract_version: string | null
        created_at: string | null
        device_fingerprint: string | null
        email: string
        full_name: string
        id: string
        ip_address: string | null
        is_active: boolean | null
        phone: string
        signed_at: string | null
        vendor_id: string | null
      }, {
        agreed_account_freeze?: boolean | null
        agreed_commission_rate?: number | null
        agreed_debt_survives_deletion?: boolean | null
        agreed_payment_deadline?: number | null
        bank_account_holder: string
        bank_iban: string
        bank_name: string
        cin: string
        contract_version?: string | null
        created_at?: string | null
        device_fingerprint?: string | null
        email: string
        full_name: string
        id?: string | null
        ip_address?: string | null
        is_active?: boolean | null
        phone: string
        signed_at?: string | null
        vendor_id?: string | null
      }, {
        agreed_account_freeze?: boolean | null
        agreed_commission_rate?: number | null
        agreed_debt_survives_deletion?: boolean | null
        agreed_payment_deadline?: number | null
        bank_account_holder?: string | null
        bank_iban?: string | null
        bank_name?: string | null
        cin?: string | null
        contract_version?: string | null
        created_at?: string | null
        device_fingerprint?: string | null
        email?: string | null
        full_name?: string | null
        id?: string | null
        ip_address?: string | null
        is_active?: boolean | null
        phone?: string | null
        signed_at?: string | null
        vendor_id?: string | null
      }>
      vendor_delivery_slots: TableDef<{
        created_at: string
        cutoff_hours: number
        day_of_week: number
        end_time: string
        id: string
        is_active: boolean
        max_orders: number | null
        slot_label: string
        start_time: string
        updated_at: string
        vendor_id: string
      }, {
        created_at?: string | null
        cutoff_hours?: number | null
        day_of_week: number
        end_time: string
        id?: string | null
        is_active?: boolean | null
        max_orders?: number | null
        slot_label: string
        start_time: string
        updated_at?: string | null
        vendor_id: string
      }, {
        created_at?: string | null
        cutoff_hours?: number | null
        day_of_week?: number | null
        end_time?: string | null
        id?: string | null
        is_active?: boolean | null
        max_orders?: number | null
        slot_label?: string | null
        start_time?: string | null
        updated_at?: string | null
        vendor_id?: string | null
      }>
      vendor_documents: TableDef<{
        created_at: string | null
        document_type: string
        id: string
        status: string | null
        url: string
        vendor_id: string
      }, {
        created_at?: string | null
        document_type: string
        id?: string | null
        status?: string | null
        url: string
        vendor_id: string
      }, {
        created_at?: string | null
        document_type?: string | null
        id?: string | null
        status?: string | null
        url?: string | null
        vendor_id?: string | null
      }>
      vendor_monthly_sales: TableDef<{
        commission_due: number | null
        commission_paid: number | null
        commission_rate: number | null
        created_at: string | null
        due_date: string | null
        id: string
        month: number
        paid_at: string | null
        payment_method: string | null
        payment_reference: string | null
        status: string | null
        total_sales: number | null
        updated_at: string | null
        vendor_id: string | null
        year: number
      }, {
        commission_due?: number | null
        commission_paid?: number | null
        commission_rate?: number | null
        created_at?: string | null
        due_date?: string | null
        id?: string | null
        month: number
        paid_at?: string | null
        payment_method?: string | null
        payment_reference?: string | null
        status?: string | null
        total_sales?: number | null
        updated_at?: string | null
        vendor_id?: string | null
        year: number
      }, {
        commission_due?: number | null
        commission_paid?: number | null
        commission_rate?: number | null
        created_at?: string | null
        due_date?: string | null
        id?: string | null
        month?: number | null
        paid_at?: string | null
        payment_method?: string | null
        payment_reference?: string | null
        status?: string | null
        total_sales?: number | null
        updated_at?: string | null
        vendor_id?: string | null
        year?: number | null
      }>
      vendor_schedules: TableDef<{
        close_time: string | null
        created_at: string | null
        day_of_week: number
        id: string
        is_closed: boolean | null
        is_open: boolean | null
        open_time: string | null
        updated_at: string | null
        vendor_id: string
      }, {
        close_time?: string | null
        created_at?: string | null
        day_of_week: number
        id?: string | null
        is_closed?: boolean | null
        is_open?: boolean | null
        open_time?: string | null
        updated_at?: string | null
        vendor_id: string
      }, {
        close_time?: string | null
        created_at?: string | null
        day_of_week?: number | null
        id?: string | null
        is_closed?: boolean | null
        is_open?: boolean | null
        open_time?: string | null
        updated_at?: string | null
        vendor_id?: string | null
      }>
      vendor_wait_responses: TableDef<{
        buyer_id: string
        created_at: string | null
        id: string
        order_id: string
        status: string
        updated_at: string | null
        vendor_id: string
        vendor_message: string | null
        waiting_period_days: number
      }, {
        buyer_id: string
        created_at?: string | null
        id?: string | null
        order_id: string
        status: string
        updated_at?: string | null
        vendor_id: string
        vendor_message?: string | null
        waiting_period_days: number
      }, {
        buyer_id?: string | null
        created_at?: string | null
        id?: string | null
        order_id?: string | null
        status?: string | null
        updated_at?: string | null
        vendor_id?: string | null
        vendor_message?: string | null
        waiting_period_days?: number | null
      }>
      verification_documents: TableDef<{
        admin_notes: string | null
        created_at: string | null
        document_type: string
        document_url: string
        expires_at: string | null
        id: string
        rejection_reason: string | null
        reviewed_at: string | null
        reviewed_by: string | null
        status: string | null
        updated_at: string | null
        user_id: string
      }, {
        admin_notes?: string | null
        created_at?: string | null
        document_type: string
        document_url: string
        expires_at?: string | null
        id?: string | null
        rejection_reason?: string | null
        reviewed_at?: string | null
        reviewed_by?: string | null
        status?: string | null
        updated_at?: string | null
        user_id: string
      }, {
        admin_notes?: string | null
        created_at?: string | null
        document_type?: string | null
        document_url?: string | null
        expires_at?: string | null
        id?: string | null
        rejection_reason?: string | null
        reviewed_at?: string | null
        reviewed_by?: string | null
        status?: string | null
        updated_at?: string | null
        user_id?: string | null
      }>
    }
    Functions: {
      apply_notification_defaults_and_preferences: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      apply_vendor_store_defaults: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      assign_invoice_number_defaults: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      audit_orders_changes: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      audit_payout_status_change: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      audit_products_changes: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      audit_profiles_changes: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      auth_is_admin: {
        Args: {
          [key: string]: never
        }
        Returns: boolean
      }
      ban_user_permanently: {
        Args: {
          p_user_id: string
          p_reason: string
          p_admin_id: string
        }
        Returns: Json
      }
      build_store_evolution_message_ar: {
        Args: {
          p_previous_store_type: string
          p_current_store_type: string
          p_previous_active_products_count: number
          p_current_active_products_count: number
          p_previous_delivery_option: string
          p_current_delivery_option: string
        }
        Returns: string
      }
      calculate_actual_delivery_price: {
        Args: {
          p_distance_km: number
          p_vehicle_type?: string
          p_is_late?: boolean
          p_is_fragile?: boolean
        }
        Returns: number
      }
      calculate_commission: {
        Args: {
          p_amount: number
          p_rate?: number
        }
        Returns: Json
      }
      calculate_delivery_fee: {
        Args: {
          p_distance_km: number
          p_same_region?: boolean
        }
        Returns: Json
      }
      calculate_delivery_price: {
        Args: {
          p_distance_km: number
          p_vehicle_type?: string
        }
        Returns: number
      }
      calculate_distance: {
        Args: {
          lat1: number
          lon1: number
          lat2: number
          lon2: number
        }
        Returns: number
      }
      calculate_distance_km: {
        Args: {
          lat1: number
          lng1: number
          lat2: number
          lng2: number
        }
        Returns: number
      }
      calculate_eta: {
        Args: {
          p_distance_km: number
          p_vehicle_type?: string
        }
        Returns: Json
      }
      calculate_platform_revenue: {
        Args: {
          buyer_comm: number
          vendor_comm: number
          driver_comm: number
        }
        Returns: number
      }
      calculate_vendor_trust_score: {
        Args: {
          vendor_id: string
        }
        Returns: Json
      }
      can_vendor_sell: {
        Args: {
          p_vendor_id: string
        }
        Returns: boolean
      }
      check_driver_availability_in_region: {
        Args: {
          p_region_id: string
        }
        Returns: Json
      }
      check_driver_verification_before_accept: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      check_expired_documents: {
        Args: {
          [key: string]: never
        }
        Returns: null
      }
      check_late_deliveries: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_action: string
          p_max_attempts?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      check_requires_second_approval: {
        Args: {
          p_amount: number
        }
        Returns: boolean
      }
      check_user_suspension_before_order: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      claim_checkout_request: {
        Args: {
          p_buyer_id: string
          p_idempotency_key: string
          p_request_hash?: string
          p_payload_snapshot?: Json
        }
        Returns: Json
      }
      cleanup_expired_ip_blocks: {
        Args: {
          [key: string]: never
        }
        Returns: number
      }
      cleanup_expired_otps: {
        Args: {
          [key: string]: never
        }
        Returns: number
      }
      cleanup_expired_sessions: {
        Args: {
          [key: string]: never
        }
        Returns: number
      }
      cleanup_old_audit_logs: {
        Args: {
          [key: string]: never
        }
        Returns: number
      }
      cleanup_old_location_history: {
        Args: {
          [key: string]: never
        }
        Returns: number
      }
      cleanup_old_notifications: {
        Args: {
          [key: string]: never
        }
        Returns: number
      }
      cleanup_old_rate_limits: {
        Args: {
          [key: string]: never
        }
        Returns: number
      }
      close_month_commissions: {
        Args: {
          [key: string]: never
        }
        Returns: null
      }
      complete_payout: {
        Args: {
          p_payout_id: string
        }
        Returns: null
      }
      create_delivery_request: {
        Args: {
          p_order_id: string
          p_vendor_id: string
          p_buyer_id: string
          p_pickup_city: string
          p_pickup_lat: number
          p_pickup_lng: number
          p_delivery_city: string
          p_delivery_lat: number
          p_delivery_lng: number
        }
        Returns: Json
      }
      create_delivery_timeline_entry: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      create_notification_for_user: {
        Args: {
          p_user_id: string
          p_title: string
          p_message: string
          p_type?: string
          p_data?: Json
        }
        Returns: string
      }
      create_notification_on_delivery_status_change: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      create_notification_on_order_status_change: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      create_notification_on_product_approval: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      create_order_timeline_entry: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      create_security_alert: {
        Args: {
          p_alert_type: string
          p_severity: string
          p_title: string
          p_description?: string
          p_source_ip?: string
          p_user_id?: string
          p_user_agent?: string
          p_request_path?: string
          p_request_method?: string
          p_metadata?: Json
        }
        Returns: string
      }
      create_user_notification: {
        Args: {
          p_user_id: string
          p_title: string
          p_message: string
          p_type?: string
          p_category?: string
          p_data?: Json
          p_channel?: string
          p_priority?: string
          p_action_url?: string
          p_action_label?: string
        }
        Returns: string
      }
      create_user_report: {
        Args: {
          p_reporter_id: string
          p_reported_user_id: string
          p_report_type: string
          p_category: string
          p_category_id: string
          p_description: string
          p_evidence_urls?: string[]
        }
        Returns: string
      }
      delete_user_account: {
        Args: {
          [key: string]: never
        }
        Returns: null
      }
      detect_suspicious_activity: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      enforce_rate_limit: {
        Args: {
          p_scope: string
          p_identifier_hash: string
          p_max_attempts: number
          p_window_seconds: number
          p_block_seconds?: number
        }
        Returns: Json
      }
      enforce_tracking_compliance: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      expire_past_deadline_rfqs: {
        Args: {
          [key: string]: never
        }
        Returns: null
      }
      find_available_drivers_with_capacity: {
        Args: {
          p_search_latitude: number
          p_search_longitude: number
          p_radius_km?: number
          p_vehicle_type?: string
        }
        Returns: Json
      }
      find_nearby_drivers: {
        Args: {
          p_search_latitude: number
          p_search_longitude: number
          p_radius_km?: number
        }
        Returns: Json
      }
      find_nearest_drivers: {
        Args: {
          p_pickup_lat: number
          p_pickup_lng: number
          p_max_distance_km?: number
          p_limit?: number
        }
        Returns: Json
      }
      freeze_overdue_vendors: {
        Args: {
          [key: string]: never
        }
        Returns: null
      }
      generate_delivery_number: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      generate_invoice_number: {
        Args: {
          p_order_id: string
        }
        Returns: string
      }
      generate_order_number: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      generate_otp: {
        Args: {
          p_user_id: string
          p_purpose?: string
        }
        Returns: string
      }
      generate_payment_number: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      get_bank_account: {
        Args: {
          p_user_id: string
        }
        Returns: Json
      }
      get_client_ip: {
        Args: {
          [key: string]: never
        }
        Returns: string
      }
      get_default_delivery_option_for_store_type: {
        Args: {
          p_store_type: string
        }
        Returns: string
      }
      get_delivery_option_label_ar: {
        Args: {
          p_delivery_option: string
        }
        Returns: string
      }
      get_nearby_drivers: {
        Args: {
          p_lat: number
          p_lng: number
          p_radius_km?: number
          p_limit?: number
        }
        Returns: Json
      }
      get_order_audit_trail: {
        Args: {
          order_id_param: string
        }
        Returns: Json
      }
      get_order_view: {
        Args: {
          p_order_id: string
          p_role?: string
        }
        Returns: OrderView
      }
      get_region_from_coords: {
        Args: {
          lat: number
          lng: number
        }
        Returns: string
      }
      get_security_metrics: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      get_store_type_from_product_count: {
        Args: {
          p_count: number
        }
        Returns: string
      }
      get_store_type_label_ar: {
        Args: {
          p_store_type: string
        }
        Returns: string
      }
      get_unhashed_backup_codes: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      get_user_violations: {
        Args: {
          p_user_id: string
          p_limit?: number
        }
        Returns: Json
      }
      get_vendor_stock_summary: {
        Args: {
          p_vendor_id: string
        }
        Returns: Json
      }
      handle_missing_features_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      handle_new_user: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      handle_new_user_mfa: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      handle_return_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      handle_schedule_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      handle_subscription_expiration: {
        Args: {
          [key: string]: never
        }
        Returns: null
      }
      handle_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      is_delivery_option_allowed: {
        Args: {
          p_store_type: string
          p_delivery_option: string
        }
        Returns: boolean
      }
      is_driver_verified: {
        Args: {
          p_driver_id: string
        }
        Returns: boolean
      }
      is_ip_blocked: {
        Args: {
          p_ip: string
        }
        Returns: boolean
      }
      is_user_suspended: {
        Args: {
          p_user_id: string
        }
        Returns: Json
      }
      is_vendor_in_grace_period: {
        Args: {
          p_vendor_id: string
        }
        Returns: boolean
      }
      is_vendor_open: {
        Args: {
          p_vendor_id: string
        }
        Returns: boolean
      }
      log_audit: {
        Args: {
          p_user_id: string
          p_action: string
          p_entity_type: string
          p_entity_id?: string
          p_old_values?: Json
          p_new_values?: Json
          p_ip_address?: string
          p_user_agent?: string
          p_device_fingerprint?: string
          p_session_id?: string
          p_signature?: string
        }
        Returns: string
      }
      log_audit_event: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      log_financial_audit: {
        Args: {
          p_entity_type: string
          p_entity_id: string
          p_action: string
          p_previous_status: string
          p_new_status: string
          p_amount: number
          p_details?: Json
          p_reason?: string
        }
        Returns: null
      }
      log_order_status_change: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      log_stock_change: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      mark_backup_codes_as_hashed: {
        Args: {
          p_user_id: string
        }
        Returns: boolean
      }
      mask_cin: {
        Args: {
          cin: string
        }
        Returns: string
      }
      normalize_notification_category: {
        Args: {
          p_category: string
          p_type?: string
        }
        Returns: string
      }
      notify_admin_stock_change: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      notify_admins_on_security_alert: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      notify_driver_assigned: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      notify_on_delivery_complete: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      notify_on_new_order: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      notify_on_order_accept: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      notify_vendor_status_change: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      prevent_delivery_double_accept: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      process_order_refund: {
        Args: {
          order_id_param: string
          refund_amount_param: number
          refund_reason_param: string
          admin_id_param: string
        }
        Returns: Json
      }
      process_payout_bank_transfer: {
        Args: {
          p_payout_id: string
          p_vendor_id: string
          p_amount: number
        }
        Returns: Json
      }
      refresh_product_review_stats: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      refresh_product_waitlist_count: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      refresh_single_product_review_stats: {
        Args: {
          p_product_id: string
        }
        Returns: null
      }
      refresh_single_product_waitlist_count: {
        Args: {
          p_product_id: string
        }
        Returns: null
      }
      refresh_vendor_store_type: {
        Args: {
          p_vendor_id: string
        }
        Returns: null
      }
      refresh_vendor_store_type_after_product_change: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      release_checkout_inventory: {
        Args: {
          p_items: Json
        }
        Returns: Json
      }
      request_account_deletion: {
        Args: {
          p_reason?: string
        }
        Returns: boolean
      }
      reserve_checkout_inventory: {
        Args: {
          p_items: Json
        }
        Returns: Json
      }
      restore_record: {
        Args: {
          table_name: string
          record_id: string
        }
        Returns: boolean
      }
      safe_accept_delivery: {
        Args: {
          p_delivery_id: string
          p_driver_id: string
        }
        Returns: Json
      }
      sanitize_order_inputs: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      sanitize_product_inputs: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      sanitize_text_input: {
        Args: {
          p_text: string
        }
        Returns: string
      }
      set_cancellation_log_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      set_checkout_requests_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      set_delivery_eta: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      set_refund_policies_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      set_request_rate_limits_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      set_rfq_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      set_support_tickets_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      set_vendor_monthly_sales_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      should_store_notification: {
        Args: {
          p_user_id: string
          p_category: string
          p_channel?: string
        }
        Returns: boolean
      }
      soft_delete_record: {
        Args: {
          table_name: string
          record_id: string
        }
        Returns: boolean
      }
      suspend_user: {
        Args: {
          p_user_id: string
          p_reason: string
          p_duration_hours?: number
          p_admin_id: string
        }
        Returns: Json
      }
      sync_cancellation_log: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      sync_delivery_participants: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      sync_driver_availability: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      sync_driver_location_timestamps: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      sync_notification_read_state: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      sync_product_activity_fields: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      sync_product_condition_status: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      to_arabic_digits: {
        Args: {
          p_value: number
        }
        Returns: string
      }
      touch_driver_delivery_preferences_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      touch_fraud_reports_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      touch_partnership_requests_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      touch_vendor_payment_policy_updated_at: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      update_delivery_timestamps: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      update_driver_active_deliveries: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      update_driver_location: {
        Args: {
          p_driver_id: string
          p_delivery_id: string
          p_latitude: number
          p_longitude: number
          p_speed_kmh?: number
          p_heading?: number
          p_accuracy?: number
        }
        Returns: Json
      }
      update_driver_performance: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      update_driver_rating: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      update_driver_region: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      update_driver_stats: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      update_product_search_document: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      update_trust_score: {
        Args: {
          p_user_id: string
          p_change: number
        }
        Returns: null
      }
      update_updated_at_column: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      upsert_bank_account: {
        Args: {
          p_user_id: string
          p_bank_name: string
          p_account_holder: string
          p_rib: string
          p_iban?: string
        }
        Returns: Json
      }
      validate_email: {
        Args: {
          p_email: string
        }
        Returns: boolean
      }
      validate_moroccan_phone: {
        Args: {
          p_phone: string
        }
        Returns: boolean
      }
      validate_profile_email: {
        Args: {
          [key: string]: never
        }
        Returns: Json
      }
      verify_otp: {
        Args: {
          p_user_id: string
          p_code: string
          p_purpose?: string
        }
        Returns: boolean
      }
    }
  }
}

export type OrderView = {
  order: Database['public']['Tables']['orders']['Row'] | null
  buyer: Database['public']['Tables']['profiles']['Row'] | null
  vendor: Database['public']['Tables']['profiles']['Row'] | null
  delivery: Database['public']['Tables']['deliveries']['Row'] | null
  driver: Database['public']['Tables']['profiles']['Row'] | null
  items: Database['public']['Tables']['order_items']['Row'][] | null
  payment: Database['public']['Tables']['payments']['Row'] | null
}
