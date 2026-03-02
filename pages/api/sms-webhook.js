import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const twilioSignature = req.headers['x-twilio-signature']
  const webhookUrl = `https://${req.headers.host}/api/sms-webhook`
  const isValid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    twilioSignature,
    webhookUrl,
    req.body
  )

  if (!isValid) {
    console.warn('Invalid Twilio signature — request rejected')
    return res.status(403).end()
  }

  const { Body: message, From: from_number } = req.body

  if (from_number !== process.env.ALLOWED_NUMBER) {
    console.warn(`Rejected message from unknown number: ${from_number}`)
    res.setHeader('Content-Type', 'text/xml')
    return res.status(200).send('<Response></Response>')
  }

  const { error } = await supabase
    .from('incoming_sms')
    .insert({ message: message.trim(), from_number, processed: false })

  if (error) {
    console.error('Supabase insert failed:', error)
    return res.status(500).end()
  }

  console.log(`SMS queued from ${from_number}: "${message.trim()}"`)

  res.setHeader('Content-Type', 'text/xml')
  res.status(200).send('<Response></Response>')
}
