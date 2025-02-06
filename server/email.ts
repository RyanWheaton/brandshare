import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL = 'noreply@yourdomain.com'; // Replace with your verified sender

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<boolean> {
  const resetLink = `${process.env.ORIGIN || 'http://localhost:5000'}/auth/reset-password?token=${resetToken}`;

  try {
    await mailService.send({
      to,
      from: FROM_EMAIL,
      subject: 'Reset Your Password',
      html: `
        <p>You requested to reset your password.</p>
        <p>Click the link below to set a new password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}
