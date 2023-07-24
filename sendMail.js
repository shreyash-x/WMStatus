const nodemailer = require("nodemailer");

// pass nzkerqmrpovsdybz

const sendMail = async (html) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "wmonitor2023@gmail.com",
      pass: "nzkerqmrpovsdybz",
    },
  });

  const mailOptions = {
    from: "wmonitor2023@gmail.com",
    to: "shreyashjain1007@gmail.com",
    subject: "WMONITOR STATUS",
    html: html,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = {
    sendMail,
};
