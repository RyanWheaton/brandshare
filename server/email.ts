import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

// Verified sender email from SendGrid
const FROM_EMAIL = 'app@wheatoncreative.com';

export async function sendVerificationEmail(
  to: string,
  verificationToken: string
): Promise<boolean> {
  const verificationLink = `${process.env.ORIGIN || 'http://localhost:5000'}/auth/verify?token=${verificationToken}`;

  try {
    console.log('Attempting to send verification email to:', to);
    const msg = {
      to,
      from: {
        email: FROM_EMAIL,
        name: "Dropbox Share Portal"
      },
      subject: 'Verify Your Email - Dropbox Share Portal',
      text: `Hello,\n\nWelcome to Dropbox Share Portal! Please verify your email address by clicking the link below:\n\n${verificationLink}\n\nThis verification link is valid for 24 hours.\n\nIf you did not sign up for a Dropbox Share Portal account, please ignore this email.\n\nBest regards,\nThe Dropbox Share Portal Team`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
            <title>Verify your email</title>
          </head>
          <body style="background-color: #f6f9fc; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 20px; font-family: sans-serif;">
              <h2 style="color: #333; margin-bottom: 20px;">Welcome to Dropbox Share Portal!</h2>
              <p style="color: #555; line-height: 1.5;">Please verify your email address by clicking the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
              </div>
              <p style="color: #555; line-height: 1.5;">This verification link is valid for 24 hours.</p>
              <p style="color: #555; line-height: 1.5;">If you did not sign up for a Dropbox Share Portal account, please ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #888; font-size: 12px;">If you're having trouble clicking the verification button, copy and paste the URL below into your web browser:</p>
              <p style="color: #888; font-size: 12px; word-break: break-all;">${verificationLink}</p>
            </div>
          </body>
        </html>
      `,
      mailSettings: {
        bypassSpamManagement: true,
        bypassBounceManagement: true,
        bypassUnsubscribeManagement: true,
        sandboxMode: {
          enable: false
        }
      },
      headers: {
        'List-Unsubscribe': '<mailto:unsubscribe@wheatoncreative.com>',
        'Precedence': 'Bulk',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      },
      trackingSettings: {
        clickTracking: {
          enable: false
        },
        openTracking: {
          enable: false
        },
        subscriptionTracking: {
          enable: false
        }
      },
      asm: {
        groupId: 0
      }
    };

    const response = await mailService.send(msg);
    console.log('SendGrid API Response:', response);

    if (response[0]?.statusCode === 202) {
      console.log('Verification email sent successfully');
      console.log('Message ID:', response[0]?.headers['x-message-id']);
      return true;
    } else {
      console.error('Unexpected response status:', response[0]?.statusCode);
      return false;
    }
  } catch (error: any) {
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

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<boolean> {
  const resetLink = `${process.env.ORIGIN || 'http://localhost:5000'}/auth?token=${resetToken}`;

  try {
    const msg = {
      to,
      from: {
        email: FROM_EMAIL,
        name: "Dropbox Share Portal"
      },
      subject: 'Your Password Reset Request - Dropbox Share Portal',
      text: `Hello,\n\nYou recently requested to reset your password for your Dropbox Share Portal account. Click the link below to reset it:\n\n${resetLink}\n\nThis password reset link is only valid for 1 hour.\n\nIf you did not request a password reset, please ignore this email or contact support if you have concerns.\n\nBest regards,\nThe Dropbox Share Portal Team`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
            <title>Reset your password</title>
          </head>
          <body style="background-color: #f6f9fc; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 20px; font-family: sans-serif;">
              <h2 style="color: #333; margin-bottom: 20px;">Reset Your Password</h2>
              <p style="color: #555; line-height: 1.5;">Hello,</p>
              <p style="color: #555; line-height: 1.5;">You recently requested to reset your password for your Dropbox Share Portal account. Click the button below to reset it:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Your Password</a>
              </div>
              <p style="color: #555; line-height: 1.5;">This password reset link is only valid for 1 hour.</p>
              <p style="color: #555; line-height: 1.5;">If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #888; font-size: 12px;">If you're having trouble clicking the password reset button, copy and paste the URL below into your web browser:</p>
              <p style="color: #888; font-size: 12px; word-break: break-all;">${resetLink}</p>
            </div>
          </body>
        </html>
      `,
      mailSettings: {
        bypassSpamManagement: true,
        bypassBounceManagement: true,
        bypassUnsubscribeManagement: true,
        sandboxMode: {
          enable: false
        }
      },
      headers: {
        'List-Unsubscribe': '<mailto:unsubscribe@wheatoncreative.com>',
        'Precedence': 'Bulk',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      },
      trackingSettings: {
        clickTracking: {
          enable: false
        },
        openTracking: {
          enable: false
        },
        subscriptionTracking: {
          enable: false
        }
      },
      asm: {
        groupId: 0
      }
    };

    console.log('Attempting to send password reset email to:', to);
    const response = await mailService.send(msg);
    console.log('SendGrid API Response:', response);

    if (response[0]?.statusCode === 202) {
      console.log('Email accepted by SendGrid successfully');
      console.log('Message ID:', response[0]?.headers['x-message-id']);
      return true;
    } else {
      console.error('Unexpected response status:', response[0]?.statusCode);
      return false;
    }
  } catch (error: any) {
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