// where the links in emails point (the frontend)
export const appUrl = process.env.APP_URL ?? "http://localhost:5173";

// No mail provider yet (it needs a domain), so emails are printed to the console.
// Swap this for SMTP when there is one.
export async function sendEmail(to: string, subject: string, text: string) {
  console.log(`\n--- email to ${to}: ${subject}\n${text}\n---\n`);
}
