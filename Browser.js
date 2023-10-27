const Scripts = require('./lib/Scripts');
const TwirlTimer = require('./lib/TwirlTimer');

const NNLBrowserPuppeteer = require("./browsers/NNLBrowserPuppeteer");
const M14BrowserRemoteControl = require("./browsers/M14BrowserRemoteControl");

module.exports = function(args) {

	let baseUrl = "http://localhost:3000";

	let waitForRedirection = 250; // how long to wait for a redirection after a button or link has been clicked?

	if (process.env.M14BROWSER_WAITTIMEOUT) {
		waitForRedirection = Number(process.env.M14BROWSER_WAITTIMEOUT);
	}

	let viewportSize = {
		width: 600,
		height: 961
	}; // default to the iPhone7

	let loadImages = false;

	let logDebug = false;

	if (args) {
		if (args.site) {
			baseUrl = args.site;
		}
		if (args.waitForRedirection) {
			waitForRedirection = args.waitForRedirection;
		}
		if (args.viewportSize) {
			viewportSize = args.viewportSize;
		}
		if (args.loadImages) {
			loadImages = args.loadImages;
		}
		if (args.debug) {
			logDebug = args.debug;
		}
	}

	const driverArgs = {
		onLoadFinished,
		onNavigationRequested,
		onResourceReceived,
		loadImages,
		viewportSize,
		authentication,
		args: args
	};

	let browserDriver;
	if (args && args.remoteControl) {
		browserDriver = new M14BrowserRemoteControl(driverArgs);
	} else {
		browserDriver = new NNLBrowserPuppeteer(driverArgs);
	}

	let callbackWaiting;
	let navigationRequested = false;
	let redirectTimeout;
	let resources = [];

	const visit = function(url, forceReload = false) {
		log("visiting " + "\x1b[34m" + url);

		return new Promise(async function(resolve, reject) {
			callbackWaiting = resolve;

			if (args && args.authentication) {
				driverArgs.authentication = args.authentication;
			}

			await browserDriver.create(driverArgs);

			let urlToOpen = url;

			if (url.indexOf("://") == -1) {
				urlToOpen = baseUrl + url;
			}

			await browserDriver.open(urlToOpen, forceReload);

		});
	}

	const waitForAjaxToFinish = function() {
		return new Promise(async function(resolve) {

			const myInterval = setInterval(async function() {
				if (await pendingAjax() === 0) {
					clearInterval(myInterval);
					TwirlTimer.stop();
					return resolve();
				}
				TwirlTimer.start();
			}, 250);

		});

	}

	const reload = function() {
		return new Promise(async function(resolve, reject) {
			let url = await browserDriver.property("url");
			url = url.replace(baseUrl, "");
			log("Reloading " + url);
			await visit(url, true);
			resolve();
		});
	}

	const url = function() {
		return new Promise(async function(resolve, reject) {
			const url = await browserDriver.property("url");
			resolve(url);
		});
	}

	const fill = function(selector, value) {
		return new Promise(async function(resolve, reject) {

			const script = await Scripts.fetch("fill", selector, value);
			await browserDriver.evaluateJavaScript(script);
			resolve();
		});
	}

	const select = function(selector, value) {
		return new Promise(async function(resolve, reject) {

			const script = await Scripts.fetch("select", selector, value);
			await browserDriver.evaluateJavaScript(script);
			resolve();
		});
	}

	const choose = function(selector, value) {
		return new Promise(async function(resolve, reject) {

			const script = await Scripts.fetch("choose", selector, value);
			await browserDriver.evaluateJavaScript(script);
			resolve();
		});
	}

	const uncheck = function(selector, value) {
		return new Promise(async function(resolve, reject) {

			const script = await Scripts.fetch("uncheck", selector, value);
			await browserDriver.evaluateJavaScript(script);
			resolve();
		});
	}

	const login = function(username, password) {
		return new Promise(async function(resolve, reject) {
			await visit("/");
			await fill('username', username);
			await fill('password', password);
			await pressButton("#login-button");

			await text();
			console.log("Signed in " + username);
			resolve();
		});
	}

	/*
		callbackWaiting to be called once the button has been pressed and the page reloads
	*/

	const pressButton = function(selector) {
		return activateElement("pressButton", selector);
	}

	const clickLink = function(selector) {
		return activateElement("clickLink", selector);
	}

	const activateElement = function(command, selector) {
		log(command + " '" + selector + "'");
		return new Promise(async function(resolve, reject) {

			const script = await Scripts.fetch(command, selector);
			await browserDriver.evaluateJavaScript(script);

			debug("activateElement Finished clicking, now waiting");

			if (await pendingAjax() > 0) {
				log(command + " (within activateElement) waiting for all pending ajax calls to complete '" + selector + "'");
				await waitForAjaxToFinish();
			}

			redirectTimeout = setTimeout(async () => {
				debug("activateElement Finished waitForRedirection");
				if (!navigationRequested) {
					debug("activateElement !navigationRequested");

					if (await pendingAjax() > 0) {
						log(command + " (within activateElement) waiting for all pending ajax calls to complete '" + selector + "'");
						await waitForAjaxToFinish();
					}

					log(command + " complete (within activateElement) no navigationRequested '" + selector + "'");
					debug("Callback from activateElement");

					resolve();
				}
			}, waitForRedirection);
		});
	}

	const pendingAjax = function() {
		return new Promise(async (resolve) => {
			const script = await Scripts.fetch("pendingjQueryAjax");
			const pendingCount = await browserDriver.evaluateJavaScript(script, true);
			resolve(pendingCount);

		});
	}

	const text = function(selector) {
		return new Promise(async function(resolve, reject) {

			const script = await Scripts.fetch("text", selector);
			let text = await browserDriver.evaluateJavaScript(script);

			if (text) {
				text = text.replace(/\r?\n|\r/g, " ").replace(/ +(?= )/g, '').replace(/\t/g, " ");;
			}
			resolve(text);
		});
	}

	const html = function() {
		return new Promise(async function(resolve, reject) {

			const script = await Scripts.fetch("html");
			let html = await browserDriver.evaluateJavaScript(script);

			if (html) {
				html = html.replace(/\r?\n|\r/g, " ").replace(/ +(?= )/g, '').replace(/\t/g, " ");;
			}
			resolve(html);

		});
	}

	const runScript = function(script) {
		return new Promise(async function(resolve, reject) {

			const results = await browserDriver.evaluateJavaScript("function(){ " + script + "}");
			resolve(results);

		});
	}

	const status = function() {
		return new Promise(function(resolve, reject) {
			resolve(resources[resources.length - 1].status);
		});
	}

	const query = function(selector) {
		return new Promise(async function(resolve, reject) {

			const script = await Scripts.fetch("query", selector);
			const result = await browserDriver.evaluateJavaScript(script);

			if (result) {
				return resolve(true);
			}
			resolve(undefined);

		});
	};

	const screenShot = function(name) {
		return browserDriver.screenshot(name);
	}

	async function onLoadFinished(status) {
		log("onLoadFinished", status);
		let url = await browserDriver.property("url");
		log("done " + "\x1b[34m" + url);

		redirectTimeout = setTimeout(async () => {
			if (await pendingAjax() > 0) {
				log("waiting for all pending ajax calls to complete");
				await waitForAjaxToFinish();
			}

			// The page has loaded, we've waited for all the ajax stuff to complete. We can go ahead and say the page is loaded
			if (callbackWaiting && redirectTimeout) {

				debug("Callback from onLoadFinished");

				clearTimeout(redirectTimeout);
				redirectTimeout = false;
				callbackWaiting();
				callbackWaiting = false;
			}
			navigationRequested = false;
		}, waitForRedirection);

	};

	async function onNavigationRequested(url) {
		log("load " + "\x1b[34m" + url);

		debug("Current resource array:");
		resources.forEach(function(resource) {
			debug("\t" + resource.url + " " + resource.status);
		});

		// handle either the old, or new,or both links being #something
		if (resources.length > 0 && (resources[0].url.indexOf('#') > 0 || url.indexOf('#') > 0)) {

			debug("onNavigationRequested detected #anchor tag");

			// ignore any #anchor in the url
			let currenctUrl = resources[0].url.indexOf('#') > 0 ? resources[0].url.substring(0, resources[0].url.indexOf('#')) : resources[0].url;
			let newUrl = url.indexOf('#') > 0 ? url.substring(0, url.indexOf('#')) : url;

			if (currenctUrl == newUrl) {
				onLoadFinished();
				return;
			} else {

				debug("onNavigationRequested not the same page " + currenctUrl + " " + newUrl);

			}
		} else {
			debug("onNavigationRequested no #anchor tag");
		}
		resources = [];
		navigationRequested = true;
	};

	// add to resources list if "start", otherwisde update or add
	function onResourceReceived(response) {
		debug("onResourceReceived " + response.stage + " " + response.url + " " + response.status);

		// If the first thing we get is a redirect, follow it.
		if (resources.length == 0 && response.status == 302) {
			return;
		}

		let updated = false;

		resources.forEach(function(resource, i) {
			if (resource.url == response.url) {
				debug("resource updated: " + response.url + " " + response.status);
				resources[i] = response;
				updated = true;
			}
		});

		if (!updated) {
			debug("resource added: " + response.url + " " + response.status);
			resources.push(response);
		}

	};

	function authentication(username, password) {
		return browserDriver.authentication(username, password);
	}

	function debug(text) {
		if (logDebug) {
			console.log("\x1b[32m " + "Browser [Debug]" + "\x1b[0m " + text + "\x1b[0m");
		}
	}

	function log(text) {
		console.log("\x1b[32m " + "Browser" + "\x1b[0m " + text + "\x1b[0m");
	}

	return {
		visit,
		reload,
		fill,
		select,
		pressButton,
		clickLink,
		choose,
		check: choose,
		uncheck,
		text,
		html,
		query,
		login,
		authentication,
		status,
		runScript,
		screenShot,
		url
	}
};

// used for Mocha tests
process.on('unhandledRejection', function(reason) {
	throw reason;
});