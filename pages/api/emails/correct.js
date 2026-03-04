import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email_id, corrected_class } = req.body;
  if (!email_id || !corrected_class) {
    return res.status(400).json({ error: 'email_id and corrected_class are required' });
  }

  try {
    // Get the email for snapshot data
    const { data: email, error: fetchError } = await supabaseAdmin
      .from('emails')
      .select('id, classification, subject, sender')
      .eq('id', email_id)
      .single();

    if (fetchError) throw fetchError;

    // Update email's corrected classification
    const { error: updateError } = await supabaseAdmin
      .from('emails')
      .update({ corrected_classification: corrected_class })
      .eq('id', email_id);

    if (updateError) throw updateError;

    // Insert correction record
    const { error: insertError } = await supabaseAdmin
      .from('classifier_corrections')
      .insert({
        email_id: email_id,
        original_class: email.classification,
        corrected_class: corrected_class,
        subject_snapshot: email.subject,
        sender_snapshot: email.sender,
      });

    if (insertError) throw insertError;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email correction error:', err);
    return res.status(500).json({ error: err.message });
  }
}
