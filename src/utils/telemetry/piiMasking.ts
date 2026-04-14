// PII Masking Utility for PostHog Session Recordings

function maskSensitiveData(data) {
    // Mask passwords
    if (data.password) {
        data.password = '********';
    }

    // Mask payment details
    if (data.paymentDetails) {
        data.paymentDetails.cardNumber = data.paymentDetails.cardNumber.replace(/\d(?=\d{4})/g, '*');
        data.paymentDetails.expiryDate = '****';
    }

    // Mask usernames
    if (data.username) {
        data.username = '********';
    }

    return data;
}

export default maskSensitiveData;
