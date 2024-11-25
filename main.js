const { chromium } = require('playwright');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;

require('dotenv').config();

// CONSTANTS
const INITIAL_PRICE = 1;
const LAST_PRICE_FILE_PATH = 'last-price.txt';

const sendNotification = async (url, currentPrice, startingPrice) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL,
    to: process.env.NOTIFY_EMAIL,
    subject: 'Price Drop Alert!',
    text: `The price of your product has dropped!\n
          Starting Price: R${startingPrice}\n
          Current Price: R${currentPrice}\n
          Product URL: ${url}\n
          Saved: R${startingPrice - currentPrice}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Notification sent!');
  } catch (error) {
    console.error(`Error sending notification: ${error.message}`);
  }
};

const fetchPrice = async (url, selector) => {
  const browser = await chromium.launch(); // Launch browser
  const page = await browser.newPage(); // Open a new page
  await page.goto(url, { waitUntil: 'domcontentloaded' }); // Navigate to the product page

  try {
    // Wait for the price element to be visible
    await page.waitForSelector(selector);
    const priceText = await page.$eval(
      selector,
      (element) => element.textContent
    );

    console.log('Heres the price text: ', priceText);

    // Parse and clean the price
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
    console.log(`Price: ${price}`);
    await browser.close();
    return price;
  } catch (error) {
    console.error(`Error fetching price: ${error.message}`);
    await browser.close();
    return null;
  }
};

const getPriceFromFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return parseFloat(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, create it with default price
      await fs.writeFile(filePath, INITIAL_PRICE.toString());
      return INITIAL_PRICE;
    }
    throw error;
  }
};

const updatePriceInFile = async (filePath, price) => {
  await fs.writeFile(filePath, price.toString());
};

(async () => {
  const url = process.env.PRODUCT_URL;
  const selector = process.env.PRICE_DOM_SELECTOR;
  const priceFilePath = LAST_PRICE_FILE_PATH;

  // Read the starting price from file
  const startingPrice = await getPriceFromFile(priceFilePath);
  const currentPrice = await fetchPrice(url, selector);

  console.log(`Starting Price: ${startingPrice}`);
  console.log(`Fetched Price: ${currentPrice}`);

  if (currentPrice && currentPrice < startingPrice) {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] PRICE DECREASE!`);
    await sendNotification(url, currentPrice, startingPrice);
    // Update the price in the file for the next run
    await updatePriceInFile(priceFilePath, currentPrice);
  } else {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] Price increased or remained the same`);
  }
})();
