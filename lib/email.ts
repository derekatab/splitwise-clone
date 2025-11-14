import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // false for TLS (587), true for SSL (465)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendInviteEmail(
  recipientEmail: string,
  inviteUrl: string,
  tripName: string
): Promise<void> {
  const mailOptions = {
    from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
    to: recipientEmail,
    subject: `You're invited to join "${tripName}" on Splitwise`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">You're invited to join a trip!</h2>
        <p style="color: #666; font-size: 16px;">
          You've been invited to join <strong>${tripName}</strong> on Splitwise.
        </p>
        <p style="color: #666; font-size: 16px; margin: 30px 0;">
          Click the link below to set up your profile and join the trip:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Accept Invite
          </a>
        </div>
        <p style="color: #999; font-size: 14px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
          Or copy this link: <br/>
          <code style="background-color: #f5f5f5; padding: 10px; display: block; word-break: break-all; margin: 10px 0;">${inviteUrl}</code>
        </p>
        <p style="color: #999; font-size: 14px;">
          This link doesn't expire, so you can use it whenever you're ready.
        </p>
      </div>
    `,
    text: `You've been invited to join "${tripName}" on Splitwise.\n\nClick this link to join: ${inviteUrl}\n\nThis link doesn't expire.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✓ Invite email sent to ${recipientEmail}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send invite email');
  }
}
