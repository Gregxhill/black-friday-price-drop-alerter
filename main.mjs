import { chromium } from 'playwright';
import nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import chalk from 'chalk';
import dotenv from 'dotenv';
import _ from 'lodash';
dotenv.config();

const sendNotification = async (text, subject) => {
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
    text: text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Notification sent!');
  } catch (error) {
    console.error(`Error sending notification: ${error.message}`);
  }
};

const fetchCurrentPrices = async (products) => {
  const browser = await chromium.launch({ headless: true }); // Launch browser

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

      console.log(priceText);

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
          const msgText = `The price of your product has dropped!\n
          Starting Price: R${product.startingPrice}\n
          Current Price: R${currentPrice}\n
          Product URL: ${product.url}\n
          Saved: R${startingPrice - currentPrice}`;

          await sendNotification(
            msgText,
            `Only ${remainingItemsNum} amount left!`
          );
        }
      }

      if (currentPrice && currentPrice < product.startingPrice) {
        const timestamp = new Date().toLocaleString();
        console.log(`[${timestamp}] PRICE DECREASE!`);

        const msgText = `The price of your product has dropped!\n
        Starting Price: R${product.startingPrice}\n
        Current Price: R${currentPrice}\n
        Product URL: ${product.url}\n
        Saved: R${startingPrice - currentPrice}`;

        await sendNotification(msgText, 'Price Drop Alert!');
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
  } catch (error) {
    console.error('Error updating products.json:', error.message);
  }
};

const checkCoupons = async (products) => {
  const selector =
    'section[data-ref="banner-carousel"] >> a.banner-carousel-module_banner_1HceQ';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const page = await context.newPage();

  await page.goto('https://www.takealot.com/blue-dot-sale-live-shopping', {
    waitUntil: 'domcontentloaded',
    timeout: 180000,
  });

  const productPaths = products.map((product) =>
    _.replace(product.url, /^https?:\/\/[^/]+/, '')
  );

  // Wait for the price element to be visible
  await page.waitForSelector(selector, { timeout: 180000, state: 'visible' });

  const links = await page.$$(selector);

  for (const link of links) {
    const href = await link.getAttribute('href');

    if (href) {
      const linkPath = _.replace(href, /^https?:\/\/[^/]+/, '');

      if (productPaths.includes(linkPath)) {
        console.log('match found! For ', linkPath);
        await sendNotification(
          'Coupon found',
          `Coupon Available for ${linkPath}`
        );
      }
    }
  }

  await browser.close();
};

(async () => {
  //Read products
  const data = await fs.readFile('products.json', 'utf8');
  const products = await JSON.parse(data);

  await checkCoupons(products.products);
  await fetchCurrentPrices(products.products);
})();
