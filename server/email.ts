import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

// Verified sender email from SendGrid
const FROM_EMAIL = 'app@wheatoncreative.com';

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<boolean> {
  const resetLink = `${process.env.ORIGIN || 'http://localhost:5000'}/auth?token=${resetToken}`;

  try {
    const msg = {
      to,
      from: FROM_EMAIL,
      subject: 'Reset Your Password',
      text: `Click the link below to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.`,
      html: `
        <p>You requested to reset your password.</p>
        <p>Click the link below to set a new password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    };

    console.log('Attempting to send password reset email to:', to);
    const response = await mailService.send(msg);
    console.log('SendGrid API Response:', response);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    if (error.response) {
      console.error('SendGrid API Error Details:', {
        body: error.response.body,
        statusCode: error.response.statusCode,
      });
    }
    return false;
  }
}