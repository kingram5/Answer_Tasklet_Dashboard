export default function Privacy() {
  return (
    <div style={{ maxWidth: 700, margin: '60px auto', padding: '0 24px', fontFamily: 'Georgia, serif', color: '#222', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 32 }}>Last updated: March 2026</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Overview</h2>
      <p>
        This privacy policy applies to the SMS automation service operated by Kyle Ingram
        ("the Service"). The Service is a single-user personal automation tool that processes
        text message commands from the account holder to trigger AI-assisted workflows.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Data Collected</h2>
      <p>
        The Service collects only the text content and originating phone number of inbound
        SMS messages sent to the registered Twilio number. No personal data from third parties
        is collected. Message content is stored temporarily in a private Supabase database for
        processing by the AI assistant and is not retained beyond operational necessity.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>How Data Is Used</h2>
      <p>
        Incoming message data is used exclusively to trigger automated personal workflows
        such as email triage, task reminders, and CRM updates on behalf of the account holder.
        Data is never sold, shared, or used for marketing purposes.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Third-Party Services</h2>
      <p>
        The Service uses Twilio for SMS delivery, Supabase for temporary message storage,
        and Vercel for hosting. Each service operates under its own privacy policy.
        No data is shared with third parties beyond what is required for the operation of
        these infrastructure services.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Data Retention</h2>
      <p>
        Processed messages are marked as complete in the database. No message content is
        retained for advertising, analytics, or any purpose beyond the immediate automated task.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Contact</h2>
      <p>
        For questions about this policy, contact:{' '}
        <a href="mailto:kyle.ingram5@gmail.com" style={{ color: '#0070f3' }}>kyle.ingram5@gmail.com</a>
      </p>
    </div>
  );
}
