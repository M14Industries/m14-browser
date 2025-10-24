const puppeteer = require('puppeteer');
const fs = require('fs');

module.exports = function () {

	let browser, page;

	let onResourceReceived, onLoadFinished;

	let basicAuthUsername, basicAuthPassword;

	async function create(args) {

		if (page) {
			return;
		}

		if (args.authentication && args.authentication.username && args.authentication.password) {
			basicAuthUsername = args.authentication.username;
			basicAuthPassword = args.authentication.password;
		}

		const launchOptions = {
			headless: "old"
		};

		// Add no-sandbox flags when running in CI environments
		if (process.env.CI === 'true' || process.env.PUPPETEER_ARGS) {
			launchOptions.args = ['--no-sandbox', '--disable-setuid-sandbox'];
		}

		browser = await puppeteer.launch(launchOptions);
		page = await browser.newPage();

		page.on("load", args.onLoadFinished);
		page.on("onNavigationRequested", args.onNavigationRequested);
		onResourceReceived = args.onResourceReceived;
		onLoadFinished = args.onLoadFinished;

		if (basicAuthUsername && basicAuthPassword) {
			await page.authenticate({ 'username': basicAuthUsername, 'password': basicAuthPassword });
		}
	}

	async function open(url, forceReload) {

		let response = null;

		const resource = {
			url: url
		};

		// ForecReload always reloads the page. It's caused by the reload() API request.
		if (forceReload) {
			response = await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
		} else {
			try {
				response = await page.goto(url);
			} catch (error) {
				if (error.message.indexOf("ERR_INVALID_AUTH_CREDENTIALS") != -1) {
					resource.status = 401;
				}
			}
		}

		if (response && response !== null) {
			resource.status = response.status();
		}

		onResourceReceived(resource);
	}

	async function evaluateJavaScript(script, ignoreRetry) {

		try {
			const results = await page.evaluate(`(${script})()`);
			return results;
		} catch (error) {

			if (error.message == "Execution context was destroyed, most likely because of a navigation.") {
				if (!ignoreRetry) {
					await page.waitForNavigation();
				}
				const results = await page.evaluate(`(${script})()`);
				return results;
			}

			console.log(error);
			return;

		}
	}

	async function screenshot(name) {
		if (!page) {
			console.log("Error: No Page found, could not take screen shot");
		}

		const screenshotOptions = {
			fullPage: true,
			captureBeyondViewport: false, // As we have fullPage (which changes the height) we set this to false to make the background act properly
			path: `./screenshots/${name}.png`
		};

		await page.screenshot(screenshotOptions);

		console.log(`Screenshot captured: ${screenshotOptions.path}`);
		return;
	}

	async function property(name) {
		if (name == "url") {
			const url = await page.url();
			return url;
		}

		console.log("Property not found");
	}

	async function authentication(username, password) {
		if (page) {
			await page.authenticate({ 'username': username, 'password': password });
		} else {
			basicAuthUsername = username;
			basicAuthPassword = password;
		}
	}

	return {
		create,
		open,
		property,
		evaluateJavaScript,
		screenshot,
		authentication
	}
};