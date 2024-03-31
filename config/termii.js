const axios = require("axios");

const sendSMS = async (to, message) => {
  const payload = {
    to,
    from: process.env.TERMII_SENDER_ID,
    sms: message,
    type: "plain",
    api_key: process.env.TERMII_API_KEY,
    channel: "generic",
  };

  try {
    await axios.post("https://api.ng.termii.com/api/sms/send", payload);
  } catch (error) {
    console.error("SMS notification failed", error);
  }
};

module.exports = { sendSMS };
