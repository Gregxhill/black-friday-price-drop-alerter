import { chromium } from 'playwright';
import nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import chalk from 'chalk';
import dotenv from 'dotenv';
dotenv.config();

const sendNotification = async (url, currentPrice, startingPrice, subject) => {
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
    subject: subject,
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

const fetchCurrentPrices = async (products) => {
  const browser = await chromium.launch(); // Launch browser

  for (const product of products) {
    const page = await browser.newPage();
    console.log(
      chalk.green('Tracking price for: '),
      chalk.bgMagenta.bold(product.productName)
    );
    try {
      await page.goto(product.url, {
        waitUntil: 'domcontentloaded',
        timeout: 180000,
      }); // Navigate to the product page
      // Wait for the price element to be visible
      await page.waitForSelector(product.selector, { timeout: 180000 });

      const priceText = await page.$eval(product.selector, (element) =>
        element.textContent.trim()
      );

      console.log('Heres the price text: ', priceText);

      // Parse and clean the price
      const currentPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
      console.log(chalk.yellowBright.bold(`Current Price: R${currentPrice}`));

      if (product?.remainingProductsDomSelector) {
        const itemsRemainingText = await page.$eval(
          product.remainingProductsDomSelector,
          (element) => element.textContent
        );

        const match = itemsRemainingText.match(/Only (\d+) left/);

        const remainingItemsNum = match ? parseInt(match[1], 10) : null;

        console.log('items remaining ', remainingItemsNum);

        if (remainingItemsNum <= 1) {
          await sendNotification(
            product.url,
            currentPrice,
            product.startingPrice,
            `Only ${remainingItemsNum} amount left!`
          );
        }
      }

      if (currentPrice && currentPrice < product.startingPrice) {
        const timestamp = new Date().toLocaleString();
        console.log(`[${timestamp}] PRICE DECREASE!`);
        await sendNotification(
          product.url,
          currentPrice,
          product.startingPrice,
          'Price Drop Alert!'
        );
        // Update startingPrice
        product.startingPrice = currentPrice;
      } else {
        const timestamp = new Date().toLocaleString();
        console.log(`[${timestamp}] Price increased or remained the same`);
      }
    } catch (error) {
      console.error(`Error fetching price: ${error.message}`);
    } finally {
      await page.close(); // Close page after processing
    }
  }

  await browser.close(); // Close the browser after all operations are complete

  // Save updated products back to the JSON file
  try {
    const updatedData = { products }; // Wrap the products array in an object
    await fs.writeFile('products.json', JSON.stringify(updatedData, null, 2));
    console.log('Updated products.json file.');
  } catch (error) {
    console.error('Error updating products.json:', error.message);
  }
};

(async () => {
  //Read products
  const data = await fs.readFile('products.json', 'utf8');
  const products = await JSON.parse(data);

  await fetchCurrentPrices(products.products);
})();
