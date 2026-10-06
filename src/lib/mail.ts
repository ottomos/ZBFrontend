import nodemailer from 'nodemailer';

export async function sendMail({ to, subject, text }: { to: string, subject: string, text: string }) {
  let transporter;

  // Debug logging
  console.log('Initializing mail transport...');
  if (process.env.MAIL_SERVICE) {
    console.log('Using Service:', process.env.MAIL_SERVICE);
  } else if (process.env.MAIL_HOST) {
    console.log('Using Host:', process.env.MAIL_HOST);
  } else {
    console.error('No mail configuration found.');
  }

  if (process.env.MAIL_SERVICE) {
    // Gmail or other known services
    transporter = nodemailer.createTransport({
      service: process.env.MAIL_SERVICE,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  } else if (process.env.MAIL_HOST) {
    // Custom SMTP
    transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT) : 587,
      secure: process.env.MAIL_SECURE === 'true',
      requireTLS: process.env.MAIL_REQUIRE_TLS === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      tls: {
        rejectUnauthorized: process.env.MAIL_TLS_REJECT_UNAUTHORIZED !== 'false',
      },
      logger: process.env.MAIL_LOGGER === 'true',
      debug: process.env.MAIL_DEBUG === 'true',
    });
  } else {
    throw new Error('No mail configuration found in environment variables.');
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
    });
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending email:', error);
    throw error;
  }
}
