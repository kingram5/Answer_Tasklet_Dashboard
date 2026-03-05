import { supabaseAdmin } from '../../../lib/supabase';
import { getGoogleAccessToken } from '../../../lib/google-auth';

export default async function handler(req, res) {
  // Verify cron request is from Vercel
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const accessToken = await getGoogleAccessToken();

    // 1. Fetch events for next 14 days
    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: twoWeeksOut.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
    });

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!calRes.ok) {
      const err = await calRes.text();
      console.error('Google Calendar API failed:', err);
      return res.status(500).json({ error: 'Calendar API failed', details: err });
    }

    const calData = await calRes.json();
    const events = calData.items || [];

    // 2. Map events to calendar_cache rows
    const eventRows = events.map(event => {
      const isAllDay = !!event.start?.date && !event.start?.dateTime;

      return {
        gcal_id: event.id,
        title: event.summary || '(No title)',
        description: event.description || null,
        start_time: event.start?.dateTime || `${event.start?.date}T00:00:00Z`,
        end_time: event.end?.dateTime || `${event.end?.date}T00:00:00Z`,
        location: event.location || null,
        attendees: event.attendees
          ? event.attendees.map(a => a.email).join(', ')
          : null,
        is_all_day: isAllDay,
        synced_at: new Date().toISOString(),
      };
    });

    const gcalIds = eventRows.map(r => r.gcal_id);

    // 3. Upsert events
    if (eventRows.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('calendar_cache')
        .upsert(eventRows, { onConflict: 'gcal_id' });

      if (upsertError) {
        console.error('Calendar upsert failed:', upsertError);
        return res.status(500).json({ error: 'Database upsert failed' });
      }
    }

    // 4. Delete stale events within the 14-day window that are no longer in Google
    const { error: deleteError } = await supabaseAdmin
      .from('calendar_cache')
      .delete()
      .gte('start_time', now.toISOString())
      .lte('start_time', twoWeeksOut.toISOString())
      .not('gcal_id', 'in', `(${gcalIds.map(id => `"${id}"`).join(',')})`);

    if (deleteError) {
      console.error('Stale event cleanup failed:', deleteError);
      // Non-fatal — stale events will get cleaned up next run
    }

    return res.status(200).json({
      message: 'Calendar sync complete',
      synced: eventRows.length,
    });
  } catch (err) {
    console.error('Calendar sync cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
