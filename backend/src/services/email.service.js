/**
 * Email service - sends booking confirmation and cancellation emails
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const loadTemplate = (templateName, variables) => {
  const templatePath = path.join(__dirname, '../templates/email', templateName);
  let html = fs.readFileSync(templatePath, 'utf8');
  
  for (const [key, value] of Object.entries(variables)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  
  return html;
};

const sendBookingConfirmation = async (booking, customer, services) => {
  try {
    const bookingDate = new Date(booking.date).toLocaleDateString('en-ZA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const servicesList = services.map(s => 
      `<tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #eeeeee;">${s.name}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #eeeeee; text-align: center;">${s.duration} min</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #eeeeee; text-align: right;">R${s.price.toFixed(2)}</td>
      </tr>`
    ).join('');

    const html = loadTemplate('bookingConfirmation.html', {
      customerName: `${customer.firstName} ${customer.lastName}`,
      bookingDate: bookingDate,
      bookingTime: booking.startTime,
      services: servicesList,
      totalPrice: booking.totalPrice.toFixed(2),
      bookingId: booking._id.toString().slice(-8).toUpperCase()
    });

    await transporter.sendMail({
      from: `"PinkMeUP" <${process.env.EMAIL_FROM}>`,
      to: customer.email,
      subject: 'Booking Confirmed - PinkMeUP Beauty Spa',
      html: html
    });

    return true;
  } catch (error) {
    console.error('Email error:', error.message);
    return false;
  }
};

const sendCancellationEmail = async (booking, customer) => {
  try {
    const bookingDate = new Date(booking.date).toLocaleDateString('en-ZA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const html = loadTemplate('bookingCancellation.html', {
      customerName: `${customer.firstName} ${customer.lastName}`,
      bookingDate: bookingDate,
      bookingTime: booking.startTime,
      cancellationReason: booking.cancellationReason || 'Not provided'
    });

    await transporter.sendMail({
      from: `"PinkMeUP" <${process.env.EMAIL_FROM}>`,
      to: customer.email,
      subject: 'Booking Cancelled - PinkMeUP Beauty Spa',
      html: html
    });

    return true;
  } catch (error) {
    console.error('Cancellation email error:', error.message);
    return false;
  }
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, resetToken, firstName) => {
  try {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ff6b9d; padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0;">Reset Your Password</h1>
        </div>
        <div style="padding: 30px; border: 1px solid #ddd; border-top: none;">
          <p>Dear <strong>${firstName}</strong>,</p>
          <p>We received a request to reset your password.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: #ff6b9d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px;">Reset Password</a>
          </p>
          <p>This link expires in 1 hour.</p>
          <p>If you didn't request this, ignore this email.</p>
          <p>Kind regards,<br><strong>The PinkMeUP Team</strong></p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"PinkMeUP" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Reset Your Password - PinkMeUP',
      html: html
    });

    return true;
  } catch (error) {
    console.error('Password reset email error:', error.message);
    return false;
  }
};

module.exports = {
  sendBookingConfirmation,
  sendCancellationEmail,
  sendPasswordResetEmail  
};