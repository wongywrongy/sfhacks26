const nodemailer = require('nodemailer');

// In production: use real SMTP credentials via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
// For hackathon/dev: uses Ethereal (fake SMTP that captures emails for preview)
let transporterPromise = null;

function getTransporter() {
  if (transporterPromise) return transporterPromise;

  if (process.env.SMTP_HOST) {
    // Real SMTP config
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    );
  } else {
    // Ethereal test account — emails are captured at ethereal.email for preview
    transporterPromise = nodemailer.createTestAccount().then((account) => {
      console.log(`  Email: using Ethereal test account (${account.user})`);
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: account.user, pass: account.pass },
      });
    });
  }

  return transporterPromise;
}

async function sendReportEmail({ to, firstName, projectName, reportUrl }) {
  try {
    const transporter = await getTransporter();

    const info = await transporter.sendMail({
      from: '"CommonGround" <reports@commonground.co>',
      to,
      subject: `Your Financial Profile is Ready — ${projectName}`,
      text: [
        `Hi ${firstName},`,
        '',
        `Your personal financial profile for ${projectName} is ready to view.`,
        '',
        `View your report: ${reportUrl}`,
        '',
        'This report contains a summary of your financial data as part of your group housing application. It includes your credit profile, payment history, and personalized next steps.',
        '',
        'No login is required — just click the link above.',
        '',
        'If you have questions about your application, please contact your property manager.',
        '',
        'Best,',
        'The CommonGround Team',
      ].join('\n'),
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
          <div style="text-align: center; padding: 32px 0 16px;">
            <span style="font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #059669;">CommonGround</span>
          </div>
          <div style="background: #fefce8; border-radius: 12px; padding: 32px; text-align: center;">
            <h1 style="font-size: 22px; font-weight: 700; color: #1c1917; margin: 0 0 8px;">Your Financial Profile is Ready</h1>
            <p style="font-size: 15px; color: #57534e; margin: 0 0 24px;">Hi ${firstName}, your personalized report for <strong>${projectName}</strong> is ready to view.</p>
            <a href="${reportUrl}" style="display: inline-block; background: #059669; color: #fff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 32px; border-radius: 8px;">View Your Report</a>
          </div>
          <div style="padding: 24px 0; font-size: 13px; color: #78716c; text-align: center; line-height: 1.6;">
            <p>This report is for educational purposes only and does not constitute a credit decision. No login is required.</p>
            <p style="margin-top: 12px;">Questions? Contact your property manager directly.</p>
          </div>
        </div>
      `,
    });

    // Log Ethereal preview URL in dev
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`  Email preview: ${previewUrl}`);
    }

    return { success: true, messageId: info.messageId, previewUrl: previewUrl || null };
  } catch (err) {
    console.error(`  Email send failed for ${to}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = { sendReportEmail };
