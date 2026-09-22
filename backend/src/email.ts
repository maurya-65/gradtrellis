// No mail provider yet (it needs a domain), so emails are printed to the console.
// Swap this for SMTP when there is one.
export async function sendEmail(to: string, subject: string, text: string) {
  console.log(`\n--- email to ${to}: ${subject}\n${text}\n---\n`);
}
