# Instagram DM Unsender

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

This userscript adds an **Unsend all DMs** button to Instagram Direct. It repeats
Instagram's normal **Unsend** action for the messages in the conversation you
select, one message at a time.

> **Warning:** Unsending is destructive and may not be reversible. Check the
> conversation before you start. This tool does not send messages or delete the
> whole conversation.

## For regular users

You do not need Node.js or programming knowledge. You need a desktop browser and
the Tampermonkey browser extension.

### 1. Install Tampermonkey

Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
The official page detects your browser and shows the appropriate installation
option.

After installing it, click the puzzle-piece **Extensions** button in your
browser and pin Tampermonkey so its icon is easy to find.

### 2. Download the script

Download this file only:

**`instagram-dm-unsender.user.js`**

To download it, open this project's GitHub page, click **Releases**, open the
latest release, and click **`instagram-dm-unsender.user.js`** under
**Assets**. Do not download files from the **Code** page; the source files
there are not the ready-to-install script.

### 3. Load the script into Tampermonkey

1. Click the Tampermonkey icon in your browser toolbar.
2. Click **Dashboard**.
3. Click the **+** button (or **Create a new script**).
4. Open the downloaded `.user.js` file in a text editor.
5. Select and copy the entire file.
6. Return to the new Tampermonkey tab, select the starter text, and paste the
   script.
7. Click the **Save** (disk) button, or press `Ctrl+S`.
8. Return to **Dashboard** and make sure **Instagram DM Unsender** is enabled.

### 4. Start it on Instagram

1. Open [Instagram](https://www.instagram.com/) in the same browser and sign in.
2. Click **Messages** or open [Instagram Direct](https://www.instagram.com/direct/).
3. Click the conversation you want to clean up.
4. Wait until the messages finish loading.
5. Refresh the page once so the script can add its controls.
6. Look for **Unsend all DMs** in the small control panel on the page.
7. Check the conversation one more time, then click **Unsend all DMs**.
8. Keep the tab open while it works. The status text shows its progress.
9. To pause or stop, click the same button, which changes to **Stop processing**.

The script works only on the conversation currently open in Instagram. It
clicks Instagram's own menu and confirmation controls; it does not bypass
Instagram restrictions.

### If the button is missing

Check these items in order:

1. Tampermonkey is installed and enabled in the browser's **Extensions** page.
2. **Instagram DM Unsender** is enabled in Tampermonkey **Dashboard**.
3. You are using Instagram in a desktop browser, not the phone app.
4. A conversation is open at an Instagram Direct URL.
5. Refresh the Instagram page after opening the conversation.
6. If it still does not appear, disable and re-enable the script in Dashboard,
   then refresh again.

## Safety and limitations

- Run only one copy at a time.
- Keep the built-in delays; do not make the script faster.
- Stop if Instagram shows a warning, error, or verification request.
- If actions begin failing, wait and try again later.
- Instagram may limit repeated actions.
- Removal from Instagram systems or backups cannot be guaranteed.
- Use the tool responsibly and follow Instagram's Terms of Use.

## For developers

The project source is in `src/`. Most users should use the built `.user.js`
file instead.

```sh
npm install
npm run build
```

The build creates `dist/instagram-dm-unsender.user.js`, which can be loaded
into Tampermonkey using the steps above.

When publishing a release, attach that generated `.user.js` file to the
release's **Assets** section. Users should download it from there, not from the
source-code folders.

## License

Released under the [MIT License](LICENSE).
