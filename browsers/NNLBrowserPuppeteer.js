const puppeteer = require('puppeteer');
const fs = require('fs');

module.exports = function() {

	let browser, page;

	let onResourceReceived;

	let basicAuthUsername, basicAuthPassword;

	async function create(args) {
		
		if (page) {
			return;
		}

		if (args.authentication && args.authentication.username && args.authentication.password) {
			basicAuthUsername = args.authentication.username;
			basicAuthPassword = args.authentication.password;
		}

		browser = await puppeteer.launch({
			headless: "old"
		});
		page = await browser.newPage();

		page.on("load", args.onLoadFinished);
		page.on("onNavigationRequested", args.onNavigationRequested);
		onResourceReceived = args.onResourceReceived;

		if (basicAuthUsername && basicAuthPassword) {
			await page.authenticate({'username':basicAuthUsername, 'password': basicAuthPassword});
		}
	}

	async function open(url) {

		const response = await page.goto(url);
		const resource = {
			url: url,
			status: response.status()
		};

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

	function screenshot(name) {
		console.log("Screenshots not currrently supported");
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
			await page.authenticate({'username':username, 'password': password});
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