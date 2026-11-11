'use server';

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminNotification } from './notifications';
import { MAX_VERIFICATION_BYTES, NID_TYPES, detectFileType } from '@/lib/upload-validation';

export async function uploadVerificationDocument(formData: FormData) {
  try {
    const userId = formData.get('userId') as string;
    const nidType = formData.get('nidType') as string;
    const description = formData.get('description') as string;
    const file = formData.get('file') as File;

    if (!userId || !file) throw new Error("Missing data");

    // Verify authentication
    const authSupabase = await createServerClient();
    const { data: { user } } = await authSupabase.auth.getUser();

    if (!user || user.id !== userId) {
      throw new Error("Unauthorized");
    }

    // Identity documents are sensitive, so the server checks everything itself:
    // the document kind, the size, and the real file type (read from the bytes,
    // never from the name or type the browser claims).
    if (!(NID_TYPES as readonly string[]).includes(nidType)) {
      throw new Error("Please choose a valid document type.");
    }
    if (file.size > MAX_VERIFICATION_BYTES) {
      throw new Error("File is too large. The limit is 5 MB.");
    }

    // Convert File to ArrayBuffer to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const detected = detectFileType(buffer);
    if (!detected) {
      throw new Error("Unsupported file. Please upload a JPG, PNG, WebP or PDF.");
    }

    // Bypass RLS for storage using service_role key
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Private bucket, random name, extension taken from the verified type.
    // What is stored in the database is this path, not a public URL; admins
    // open the file through a short-lived signed link (see admin.ts).
    const filePath = `${userId}/${crypto.randomUUID()}.${detected.ext}`;

    const { error: uploadError } = await adminSupabase.storage
      .from('verifications')
      .upload(filePath, buffer, {
        contentType: detected.mime,
        upsert: false
      });

    if (uploadError) {
      throw new Error("Admin Upload Error: " + uploadError.message);
    }

    // Insert into verifications table (using normal auth so it respects RLS)
    const { error: insertError } = await authSupabase
      .from('verifications')
      .insert({
        user_id: userId,
        nid_type: nidType,
        document_path: filePath,
        description: description
      });

    if (insertError) {
      // Do not leave an orphaned identity document behind.
      await adminSupabase.storage.from('verifications').remove([filePath]);
      throw new Error("DB Insert Error: " + insertError.message);
    }

    // Trigger notification to admins
    await createAdminNotification(
      'verification',
      `New identity verification submitted by user ${userId}.`,
      `/admin?tab=verifications`
    );

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function uploadExchangeItemPhoto(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file provided");

    // Verify authentication
    const authSupabase = await createServerClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Bypass RLS for storage using service_role key
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const ext = file.name.split('.').pop();
    const filePath = `exchange/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    // Convert File to ArrayBuffer to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminSupabase.storage
      .from('uiunest')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      throw new Error("Admin Upload Error: " + uploadError.message);
    }

    const { data: publicUrlData } = adminSupabase.storage
      .from('uiunest')
      .getPublicUrl(filePath);

    return { path: publicUrlData.publicUrl };

  } catch (error: any) {
    console.error("Upload photo error:", error);
    throw new Error(error.message);
  }
}
