const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const { sendEmail } = await import(pathToFileURL(path.join(path.resolve(__dirname, 'dist'), 'services/email.service.js')).href);
  const to = process.argv[2] ?? 'recipient-mailtrap@example.com';
  const ok = await sendEmail({
    to,
    subject: 'FarmFlow SMTP test',
    html: '<p>Hello from <strong>FarmFlow</strong>.</p><p>If you see this, SMTP delivery works.</p>',
  });
  console.log(ok ? 'SEND_RESULT=DELIVERED' : 'SEND_RESULT=FAILED');
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(1);
});