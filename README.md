# M14 Browser

[![NPM](https://nodei.co/npm/m14-browser.png)](https://nodei.co/npm/m14-browser/)

The M14 Browser is a promise based browser built for testing websites and hybrid mobile apps. It's controlled through a simple interface and interacts with the webview by injects JavaScript into the page to control behaviour.

It can support multiple browsers with the same interface, allowing us to change the browser of choice or test multiple browsers without changing our code.

The project is still undergoing frequent changes. The Puppeteer browser driver is taken from the Next New Line fork of this project.

### An easy to use headless browser, good for testing

Currently these browsers are supported:

* [Puppeteer](https://pptr.dev/) - a headless chromium controller
* [Remote control](#remote-control) - control any browser or webview in real-time

## But why

We're (John Kershaw, M14 Industries) building this as a testing tool so we can have a single, promise-based Browser interface which can control multiple different browsers.

Here's an example:

```js
const Browser = require("m14-browser");
const expect = require('chai').expect;


describe('Given we view the forms1 page', function() {

  const browser = new Browser();
    
  it("We can fill in the values and submit the form", async function() {

    await browser.visit("/forms1");

    await browser.fill("forumInput", "Forms4Life");
    await browser.fill("formTextArea", "Textareasaremylife");
    await browser.select("#favouriteCat", "Russian Blue");
    await browser.choose(".favouritePlant", "spiderplant");
    await browser.pressButton("#forumSubmitButton");
    
    await browser.screenShot("myScreenshot");

    expect(await browser.text("#formResults")).to.contain("Forms4Life");
    expect(await browser.text("#formResults")).to.contain("Textareasaremylife");
    expect(await browser.text("#formResults")).to.contain("russianblue");
    expect(await browser.text("#formResults")).to.contain("spiderplant");
    
  });
});
```

## Browser API

### Control

#### `browser.visit(url)`

Visit a given Url.

#### `browser.reload()`

Reload the current page.
 
#### `browser.fill(selector, value)`

Fill in a form text field or text area.

#### `browser.select(selector, value)`

Select an option from a selection drop down

#### `browser.pressButton(selector)`

Press a button. This includes Bootstrap's `a.btn`.

If the selector is text, the first button with the selector as its text (case insensitive) is pressed. 

#### `browser.clickLink(selector)`

Click a link.

If the selector is text, the first anchro tag with the selector as its text contents (case insensitive) is clicked. 

If there is an exact match, that link will be clicked. If there are no links with an exact match, any link with the selector in will be clicked.

#### `browser.choose(selector, value)`

Choose and click a radio button.

#### `browser.check(selector, value)`

The same as `.choose`.

#### `browser.uncheck(selector, value)`

Uncheck and click a radio button.

### Observe

#### `browser.html()`

Return the html of the whole page.

#### `browser.text(selector)`

Return the readable text. Approximatly, this is what the user sees.

#### `browser.query(selector)`

Does an element exist? Returns `true` or `false`.

#### `browser.status()`

Return the status of the most recently loaded page (e.g. `200` if everything loaded ok). If a redirect is followed, the value returned will be the page you end up on, not the `3xx` code from the first page.

#### `browser.url()`

Return the complete URL of the page being displayed


## Helpful additional functions

#### `browser.authentication(username, password)`

Provide a Basic Auth username and password.

#### `browser.screenShot()`

Take and save a screen shot of the current page. Saves as a png in the /screenshots folder.

#### `browser.login(username, password)`

Visit the root URL, fill fields with either the id or class of "username" and "password", then submit the form by pressing the button with the id "login-button". Then wait for everything after to load.

This is a shortcut for the following

```node 
await visit("/");
await fill('username', username);
await fill('password', password);
await pressButton("#login-button");

await text();
```

## Remote Control

***Important:*** The remote control browser is very experimental (even for us). It's being built to allow our existing tests to be run on a Cordova app, on device.

When using Remote Control, you can run your code using any web view which includes the remote control execution script. The script needs to be embedded on every page you'd like to control.

```html
<script type="text/javascript" src="http://localhost:1414/remoteControl.js"></script>
```

The process works by running a Remote Control Server on port 1414. The browser loads `remoteControl.js` which in turn polls the Remote Control Server for new events (e.g. clicking a link).

Our testing code sends server-side commands to the Remote Control Server, which it in turn sends on to the browser-side `remoteControl.js`. Results are relayed back.

The `browser` object becomes a relay, not an actual browser. It is functionally the same from the perspective of the code using it but you have to manually open your own browser for it to use. This could mean you manually openning Chrome (great if you want to watch the tests), or another instance of the `m14 browser` (great for automation), or even a Cordova webview running on an actual device (great for real-world integration testing).

For example:

```node
const Browser = require("m14-browser");
const expect = require('chai').expect;

describe('Remote Control browser.text()', () => {

  let browser;
  let controlledBrowser;

  before(async () => {

    // Create a new Remote Controlled Browser
    browser = new Browser({
      remoteControl: true,
      remoteUrl: "http://localhost:1414"
    });

    // Create a browser instance to be controlled.
    controlledBrowser = new Browser();

    // The controlled browser must be given a starting point with the remote control script tag in
    controlledBrowser.visit("/remoteControl");
  });

  it("Returns the text on a text-only page", async () => {
    await browser.visit("/remoteControl");
    expect(await browser.text()).to.equal("Hello Remote Controlled World!");
  });
});
```


### Cordova/PhoneGap app

Considerations:

* If you're running the Android emulator, `http://localhost` on the host machine becomes `http://10.0.2.2` in the emulator.
* The local 'site' within the Android emulator becomes `file:///android_asset/www`.

The remote control script is now included using this:

```html
<script type="text/javascript" src="http://10.0.2.2:1414/remoteControl.js"></script>
```

Your `config.xml` will need the following added to allow the in-app webview access the Remote Control Server (Only using this during dev, and removing it when you're publishing your app):

```xml
<plugin name="cordova-plugin-whitelist" spec="1.*" />
<access origin="*" />
```

And your tests can look something like this (assuming there's an emulator open running your app):

```node
describe('Remote Control Cordova', function() {

  it("Returns the text on the page after clicking Sign Up", async function() {

    const browser = new Browser({
      remoteControl: true,
      remoteUrl: "http://10.0.2.2:1414",
      site: "file:///android_asset/www"
    });

    await browser.visit("/index.html");

    await browser.clickLink("sign up with your email");
    
    expect(await browser.text()).to.contain("Create Your Account");

  });
});
```