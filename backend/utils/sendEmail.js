const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const formatDate = (date) => new Date(date).toLocaleDateString();

// One shared sender, 3 different templates depending on `kind`
const sendTaskEmail = async (toEmail, taskTitle, deadline, kind) => {
  const formattedDate = formatDate(deadline);

  const templates = {
    due_soon: {
      subject: `⏰ Reminder: "${taskTitle}" is due tomorrow`,
      heading: "Coming up tomorrow!",
      body: `Your task <strong>${taskTitle}</strong> is due on <strong>${formattedDate}</strong> — that's tomorrow. Now's a good time to wrap it up.`,
    },
    due_today: {
      subject: `🔥 Last chance: "${taskTitle}" is due today`,
      heading: "Last chance to complete this task!",
      body: `Your task <strong>${taskTitle}</strong> is due <strong>today (${formattedDate})</strong>. Log in and mark it complete before the day is over.`,
    },
    overdue: {
      subject: `⚠️ Overdue: "${taskTitle}" needed your attention`,
      heading: "This task is now overdue",
      body: `Your task <strong>${taskTitle}</strong> was due on <strong>${formattedDate}</strong> and hasn't been marked complete yet. Take a moment to catch up on it.`,
    },
  };

  const t = templates[kind] || templates.due_soon;

  await transporter.sendMail({
    from: `"Flowlist" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: t.subject,
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>${t.heading}</h2>
        <p>${t.body}</p>
        <p>Log in to Flowlist to update it.</p>
      </div>
    `,
  });
};

module.exports = sendTaskEmail;
