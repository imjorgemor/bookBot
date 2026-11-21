// Emails via Resend: RESEND_API_KEY, and NOTIFY_EMAIL_<n> for each user who wants them (several
// addresses separated by commas). Users without NOTIFY_EMAIL_<n> get no email.
const { RESEND_API_KEY, NOTIFY_FROM } = Bun.env;

// Sender on the domain verified in Resend (NOTIFY_FROM overrides it)
const DEFAULT_FROM = "bookBot <bot@paravosotrosjugadores.xyz>";

// User "jorge - 3" → "3" (a bare "3" works too)
export const userNumber = (user: string) => user.split("-").pop()!.trim();

// Email user n what happened. Returns true if Resend accepted it.
// Never throws: a failed email must not stop a booking.
export async function notify(user: string, subject: string, text: string, html?: string) {
  const n = userNumber(user);
  const to = Bun.env[`NOTIFY_EMAIL_${n}`];
  if (!to) {
    console.log(`No email for user ${n} (no NOTIFY_EMAIL_${n})`);
    return false;
  }
  if (!RESEND_API_KEY) {
    console.log(`No email sent to user ${n}: missing RESEND_API_KEY`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: NOTIFY_FROM || DEFAULT_FROM,
        to: to.split(",").map((a) => a.trim()),
        subject,
        text,
        html,
      }),
    });
    if (res.ok) {
      console.log(`Email sent to user ${n}: ${subject}`);
      return true;
    }
    console.error(`Email to user ${n} failed: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error(`Email to user ${n} failed:`, err);
  }
  return false;
}
