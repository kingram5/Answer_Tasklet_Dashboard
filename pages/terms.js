export default function Terms() {
  return (
    <div style={{ maxWidth: 700, margin: '60px auto', padding: '0 24px', fontFamily: 'Georgia, serif', color: '#222', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Terms and Conditions</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 32 }}>Last updated: March 2026</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Program Name</h2>
      <p>Kyle Ingram – Personal AI Assistant SMS Automation</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Program Description</h2>
      <p>
        This SMS service allows the registered account holder to send task instructions
        to a personal AI assistant via text message. The assistant processes the commands
        and executes automated workflows including email triage, reminders, and CRM updates.
        This is a private, single-user service. No marketing or promotional messages are sent.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Message Frequency</h2>
      <p>
        Message frequency varies depending on the account holder's usage. Typically fewer
        than 10 inbound messages per day. There are no recurring scheduled outbound messages.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Message and Data Rates</h2>
      <p>
        Standard message and data rates may apply depending on your mobile carrier plan.
        The Service does not charge any additional fees for SMS usage.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Opt-Out Instructions</h2>
      <p>
        To stop receiving any automated responses from this number, reply{' '}
        <strong>STOP</strong> at any time. For assistance, reply{' '}
        <strong>HELP</strong> or contact kyle.ingram5@gmail.com.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Privacy</h2>
      <p>
        Your privacy is important to us. Message content is used solely to process
        your personal automation requests. No data is shared with third parties for
        marketing purposes. See our{' '}
        <a href="/privacy" style={{ color: '#0070f3' }}>Privacy Policy</a> for details.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Support</h2>
      <p>
        For support or questions, contact:{' '}
        <a href="mailto:kyle.ingram5@gmail.com" style={{ color: '#0070f3' }}>kyle.ingram5@gmail.com</a>
      </p>
    </div>
  );
}
