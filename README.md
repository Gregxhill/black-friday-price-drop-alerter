# black-friday-price-drop-alerter

## Requires:

- node lts
- gmail account & app password

## To run:

- run `npm install` to install project deps
- generate app password for gmail acc: https://knowledge.workspace.google.com/kb/how-to-create-app-passwords-000009237 Copy the password generated and set the `EMAIL_PASSWORD` env value using it
- copy paste the .env-example into a .env and fill out the values
  - copy & set the `PRODUCT_URL` using the url for the takealot/ecom product page
  - inspect the page using chrome dev tools/playwright tools and set the DOM selector for the price component
- update the constants in the main.js file accordingly
- run `node main.js`

## To automate:

- on MacOS create a plist file with the interval logic etc and use launchctl to load and start the script automation
