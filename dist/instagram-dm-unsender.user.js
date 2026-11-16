
// ==UserScript==

// @name				Instagram DM Unsender
// @namespace				instagram-dm-unsender
// @version				0.7.2
// @description				Unsend messages from an Instagram DM thread one at a time.
// @match				https://www.instagram.com/direct/*
// @run-at				document-end
// @grant				none
// @license				MIT
// @icon				https://www.instagram.com/favicon.ico

// ==/UserScript==


var InstagramDMUnsender = (function (exports) {
	'use strict';

	/** @module instagram Helpers to mimick Instagram's look and feel */

	const BUTTON_STYLE = {
		"PRIMARY": "primary",
		"SECONDARY": "secondary",
	};

	/**
	 *
	 * @param {HTMLButtonElement} buttonElement
	 * @param {string}            styleName
	 */
	function applyButtonStyle(buttonElement, styleName) {
		buttonElement.style.fontSize = "var(--system-14-font-size)";
		buttonElement.style.color = "white";
		buttonElement.style.border = "0px";
		buttonElement.style.borderRadius = "8px";
		buttonElement.style.padding = "8px";
		buttonElement.style.fontWeight = "bold";
		buttonElement.style.cursor = "pointer";
		buttonElement.style.lineHeight = "var(--system-14-line-height)";
		if(styleName) {
			buttonElement.style.backgroundColor = `rgb(var(--ig-${styleName}-button))`;
		}
	}

	/** @module menu-button Helpers to create buttons that can be used in IDMU's menu */


	/**
	 *
	 * @param {Document} document
	 * @param {string}   text
	 * @param {string}   styleName
	 * @returns {HTMLButtonElement}
	 */
	function createMenuButtonElement(document, text, styleName) {
		const buttonElement = document.createElement("button");
		buttonElement.textContent = text;
		applyButtonStyle(buttonElement, styleName);
		buttonElement.addEventListener("mouseover", () => {
			buttonElement.style.filter = `brightness(1.15)`;
		});
		buttonElement.addEventListener("mouseout", () => {
			buttonElement.style.filter = ``;
		});
		return buttonElement
	}

	/** @module menu IDMU's main menu */

	/**
	 * @param {Document} document
	 * @returns {HTMLButtonElement}
	 */
	function createMenuElement(document) {
		const menuElement = document.createElement("div");
		menuElement.id = "idmu-menu";
		menuElement.style.top = "20px";
		menuElement.style.right = "430px";
		menuElement.style.position = "fixed";
		menuElement.style.zIndex = 999;
		menuElement.style.display = "flex";
		menuElement.style.gap = "10px";
		menuElement.style.placeItems = "center";
		return menuElement
	}

	/** @module async-events Utils module for finding elements asynchronously in the DOM */

	/**
	 *
	 * @callback getElement
	 * @returns {Element}
	 */

	/**
	 * Run a callback on DOM mutation (addedNode) that tests whether a specific element was found (or was not found)
	 * When the callback returns true the promise is resolved
	 * @param {Element} target
	 * @param {getElement} getElement
	 * @param {AbortController} abortController
	 * @returns {Promise<Element>}
	 * @example
	 * waitForElement(
	 *		body,
	 *		() => body.contains(document.querySelector("button#foo")),
	 *		abortController
	 *	)
	 */
	function waitForElement(target, getElement, abortController) {
		return new Promise((resolve, reject) => {
			let mutationObserver;
			const abortHandler = () => {
				if(mutationObserver) {
					mutationObserver.disconnect();
				}
				reject(new Error(`waitForElement aborted: ${abortController.signal.reason}`));
			};
			abortController.signal.addEventListener("abort", abortHandler);
			let element = getElement();
			if(element) {
				resolve(element);
				abortController.signal.removeEventListener("abort", abortHandler);
			} else {
				mutationObserver = new MutationObserver((mutations, observer) => {
					element = getElement(mutations);
					if(element) {
						observer.disconnect();
						resolve(element);
						abortController.signal.removeEventListener("abort", abortHandler);
					}
				});
				mutationObserver.observe(target, { subtree: true, childList: true });
			}
		})
	}

	/**
	 * Click target and run waitForElement
	 * @param {Element} clickTarget
	 * @param {Element} target
	 * @param {getElement} getElement
	 * @param {AbortController} abortController
	 * @returns {Element|Promise<Element>}
	 * @example
	 * In this case clicking "#foo" button would make "#bar" appear
	 * clickElementAndWaitFor(
	 *		document.querySelector("#foo"),
	 *		body,
	 *		() => body.contains(document.querySelector("#bar")),
	 *		abortController
	 *	)
	 */
	function clickElementAndWaitFor(clickTarget, target, getElement, abortController) {
		const promise = waitForElement(target, getElement, abortController);
		clickTarget.click();
		return getElement() || promise
	}

	/** @module ui-component Base class for any element that is a part of the UI. */


	/**
	 *
	 * @abstract
	 */
	class UIComponent {
		/**
		 *
		 * @param {Element} root
		 * @param {object} identifier
		 */
		constructor(root, identifier={}) {
			this.root = root;
			this.identifier = identifier;
		}

		/**
		 * Alias of dom/async-events#waitForElement
		 * @param {Element} target
		 * @param {function} getElement
		 * @param {AbortController} abortController
		 * @returns {Promise<Element>}
		 */
		waitForElement(target, getElement, abortController) {
			return getElement() || waitForElement(target, getElement, abortController)
		}

		/**
		 * Alias of dom/async-events#clickElementAndWaitFor
		 * @param {Element} clickTarget
		 * @param {Element} target
		 * @param {function} getElement
		 * @param {AbortController} abortController
		 * @returns {Promise<Element>}
		 */
		clickElementAndWaitFor(clickTarget, target, getElement, abortController) {
			return clickElementAndWaitFor(clickTarget, target, getElement, abortController)
		}

	}

	/** @module dom-lookup Utils module for looking up elements on the default UI */


	/**
	 * Finds the scrollable messages container inside the conversation panel.
	 * Instagram removed role="grid" — we now locate the container via aria-label
	 * and walk into its scrollable child.
	 *
	 * @param {Window} window
	 * @returns {HTMLDivElement|null}
	 */
	function findMessagesWrapper(window) {
		const conversation = window.document.querySelector("[data-pagelet='IGDMessagesList']");
		if (!conversation) {
			return null
		}
		const scrollable = findScrollableChild(conversation, window);
		if (!scrollable) {
			return null
		}
		return scrollable
	}

	/**
	 * Recursively finds the first scrollable descendant of a given element.
	 *
	 * @param {Element} parent
	 * @param {Window} window
	 * @returns {HTMLDivElement|null}
	 */
	function findScrollableChild(parent, window) {
		for (const child of parent.children) {
			const style = window.getComputedStyle(child);
			if (
				(style.overflowY === "auto" || style.overflowY === "scroll") &&
				child.scrollHeight > child.clientHeight
			) {
				return child
			}
			const found = findScrollableChild(child, window);
			if (found) {
				return found
			}
		}
		return null
	}

	/**
	 * Returns the inner container that holds individual message row divs.
	 * Traverses wrapper layers to find the div with the most children (the message list).
	 *
	 * @param {Element} scrollable
	 * @returns {HTMLDivElement}
	 */
	function getMessagesInnerContainer(scrollable) {
		// Instagram wraps messages in several nested divs.
		// Strategy: find the deepest descendant (within 3 levels) that has the most children,
		// since the actual messages container has many direct children (one per message row).
		let best = scrollable;
		let bestCount = scrollable.children.length;

		function search(el, depth) {
			if (depth > 3) return
			for (const child of el.children) {
				if (child.children.length > bestCount) {
					best = child;
					bestCount = child.children.length;
				}
				search(child, depth + 1);
			}
		}

		search(scrollable, 0);
		return best
	}

	/**
	 * Determines whether a message element was sent by the current user.
	 * Instagram aligns sent messages to the right using flexbox (justify-content: flex-end).
	 *
	 * @param {Element} element
	 * @param {Window} window
	 * @returns {boolean}
	 */
	function isSentByCurrentUser(element, window) {
		// BFS through all descendants up to depth 8.
		// Instagram places justify-content: flex-end on a nested div (depth ~5)
		// that may be on any child branch, not just the first-child path.
		const queue = [{ el: element, depth: 0 }];
		while (queue.length > 0) {
			const { el, depth } = queue.shift();
			const s = window.getComputedStyle(el);
			if (s.justifyContent === "flex-end") {
				return true
			}
			if (depth < 8) {
				for (const child of el.children) {
					queue.push({ el: child, depth: depth + 1 });
				}
			}
		}
		return false
	}

	/**
	 * Gets the first visible message sent by the current user that hasn't been processed yet.
	 *
	 * @param {Element} root - The scrollable messages wrapper
	 * @param {AbortController} abortController
	 * @param {Window} window
	 * @returns {Element|undefined}
	 */
	function getFirstVisibleMessage(root, abortController, window) {
		const innerContainer = getMessagesInnerContainer(root);
		if (!innerContainer) {
			return
		}

		const elements = [...innerContainer.children]
			.filter(d => {
				if (d.hasAttribute("data-idmu-ignore")) return false
				if (d.hasAttribute("data-idmu-unsent")) return false
				// Must contain message content indicators
				const hasMessageContent = d.querySelector("[role=none]") || d.querySelector("[role=presentation]");
				if (!hasMessageContent) return false
				return isSentByCurrentUser(d, window)
			});

		elements.reverse();
		if(elements.length >= 1) ;

		for (const element of elements) {
			if (abortController.signal.aborted) {
				break
			}
			const visibilityCheck = element.checkVisibility({
				visibilityProperty: true,
				contentVisibilityAuto: true,
				opacityProperty: true,
			});
			if (visibilityCheck === false) {
				continue
			}
			const rect = element.getBoundingClientRect();
			// Check if element is at least partially in viewport.
			// For tall elements (images, long text), rect.y can be negative
			// while the element is still visible. Use bottom edge instead.
			if (rect.y + rect.height < 0 || rect.height === 0) {
				continue
			}
			element.setAttribute("data-idmu-ignore", "");
			return element
		}
	}

	/**
	 * Scrolls to top to trigger loading of older messages.
	 * Handles both normal and column-reverse layouts.
	 *
	 * In column-reverse (Instagram's current layout):
	 *   scrollTop=0 is the BOTTOM (newest messages)
	 *   scrollTop=-(scrollHeight-clientHeight) is the TOP (oldest messages)
	 *
	 * @param {Element} root
	 * @param {AbortController} abortController
	 * @returns {Promise<boolean>}
	 */
	async function loadMoreMessages(root, abortController) {
		const scrollAbortController = new AbortController();
		let findLoaderTimeout;
		let resolveTimeout;
		const abortHandler = () => {
			scrollAbortController.abort("abortHandler was aborted");
			clearTimeout(findLoaderTimeout);
			if (resolveTimeout) {
				resolveTimeout();
			}
		};
		abortController.signal.addEventListener("abort", abortHandler);

		// Detect column-reverse layout
		const style = root.ownerDocument.defaultView.getComputedStyle(root);
		const isReversed = style.flexDirection === "column-reverse";
		// In column-reverse, "scroll to top" means most negative scrollTop
		const scrollToTopValue = isReversed
			? -(root.scrollHeight - root.clientHeight)
			: 0;
		// In column-reverse, "at top" means scrollTop is at or near minimum
		const isAtTop = () => isReversed
			? root.scrollTop <= scrollToTopValue + 5
			: root.scrollTop === 0;

		const beforeScroll = root.scrollTop;
		const beforeHeight = root.scrollHeight;
		root.scrollTop = scrollToTopValue;

		// Helper: find a visible loader within the scrollable root's viewport
		const findVisibleLoader = () => {
			const bars = root.querySelectorAll("[role=progressbar]");
			for (const bar of bars) {
				const rect = bar.getBoundingClientRect();
				const rootRect = root.getBoundingClientRect();
				// Must be within root's horizontal+vertical bounds and have dimensions
				if (rect.height > 0 && rect.y >= rootRect.y - 100 && rect.y <= rootRect.y + rootRect.height + 100) {
					return bar
				}
			}
			return null
		};

		// Short chat: everything fits in viewport, nothing to load
		const noScrollNeeded = isReversed
			? beforeScroll === 0 && root.scrollHeight <= root.clientHeight + 50
			: beforeScroll === 0 && root.scrollHeight <= root.clientHeight + 50;
		if (noScrollNeeded) {
			abortController.signal.removeEventListener("abort", abortHandler);
			return true
		}

		// Already at top after scrolling: wait briefly for new content, then check
		if (isAtTop()) {
			// Give Instagram a moment to start loading older messages
			await new Promise(resolve => setTimeout(resolve, 500));

			// Check if a visible loader appeared
			const loader = findVisibleLoader();
			if (loader) {
				await Promise.race([
					waitForElement(root, () => findVisibleLoader() === null, abortController),
					new Promise(resolve => setTimeout(resolve, 5000))
				]);
				abortController.signal.removeEventListener("abort", abortHandler);
				const grew = root.scrollHeight > beforeHeight;
				return !grew
			}

			// No loader appeared — check if scrollHeight grew (new content loaded without spinner)
			const grew = root.scrollHeight > beforeHeight;
			if (!grew) {
				abortController.signal.removeEventListener("abort", abortHandler);
				return true
			}
		}

		// Fallback: wait for progressbar to appear (with shorter timeout)
		let loadingElement;
		try {
			loadingElement = await Promise.race([
				waitForElement(root, () => {
					if (findVisibleLoader() === null) {
						root.scrollTop = scrollToTopValue;
					}
					return findVisibleLoader()
				}, scrollAbortController),
				new Promise(resolve => {
					resolveTimeout = resolve;
					findLoaderTimeout = setTimeout(() => {
						resolve();
					}, 3000);
				})
			]);
		} catch (ex) {
			console.error(ex);
		}
		scrollAbortController.abort("Scrolling took too much time. Timeout after 10s");
		abortController.signal.removeEventListener("abort", abortHandler);
		clearTimeout(findLoaderTimeout);
		if (loadingElement && loadingElement !== true) {
			await Promise.race([
				waitForElement(root, () => findVisibleLoader() === null, abortController),
				new Promise(resolve => setTimeout(resolve, 5000))
			]);
		}
		const atTop = isAtTop();
		return atTop
	}

	/** Locale-independent patterns for the "Unsend" menu item */
	const UNSEND_TEXT_VARIANTS = [
		"unsend",        // English
		"annulla invio", // Italian
		"retirar",       // Portuguese
		"deshacer",      // Spanish
		"retirer",       // French
		"zurücknehmen",  // German
	];


	/** Represents the description text that is associated with the "..." button that reveals the actions menu */
	const LABEL_PATTERNS = [
		"[aria-label^='See more options for message']",
		"[aria-label*='more options']",
		"[aria-label*='More']",
		"[aria-label*='Altre opzioni']",
		"[aria-label*='opzioni']",
		"[aria-label*='opciones']",
		"[aria-label*='options']",
	];

	/** @module ui-message UI element representing a message */


	/**
	 * Dispatches pointer and mouse hover events on a target element.
	 * Instagram's React uses pointer events internally; mouse events alone are insufficient.
	 *
	 * @param {Element} target
	 */
	function dispatchHoverIn(target) {
		const rect = target.getBoundingClientRect();
		const opts = {
			bubbles: true,
			cancelable: true,
			clientX: rect.x + rect.width / 2,
			clientY: rect.y + rect.height / 2,
			pointerId: 1,
			pointerType: "mouse",
		};
		target.dispatchEvent(new PointerEvent("pointerenter", { ...opts, bubbles: false }));
		target.dispatchEvent(new PointerEvent("pointerover", opts));
		target.dispatchEvent(new PointerEvent("pointermove", opts));
		target.dispatchEvent(new MouseEvent("mouseenter", { ...opts, bubbles: false }));
		target.dispatchEvent(new MouseEvent("mouseover", opts));
		target.dispatchEvent(new MouseEvent("mousemove", opts));
	}

	/**
	 * Dispatches pointer and mouse leave events on a target element.
	 *
	 * @param {Element} target
	 */
	function dispatchHoverOut(target) {
		const rect = target.getBoundingClientRect();
		const opts = {
			bubbles: true,
			cancelable: true,
			clientX: rect.x + rect.width / 2,
			clientY: rect.y + rect.height / 2,
			pointerId: 1,
			pointerType: "mouse",
		};
		target.dispatchEvent(new PointerEvent("pointerout", opts));
		target.dispatchEvent(new PointerEvent("pointerleave", { ...opts, bubbles: false }));
		target.dispatchEvent(new MouseEvent("mouseout", opts));
		target.dispatchEvent(new MouseEvent("mouseleave", { ...opts, bubbles: false }));
	}

	class UIMessage extends UIComponent {

		/**
		 * Dismiss any stale dialog or dropdown left from a previous failed workflow.
		 */
		_dismissStaleOverlays() {
			const doc = this.root.ownerDocument;
			// Close stale confirmation dialogs
			const staleDialog = doc.querySelector("[role=dialog]");
			if (staleDialog) {
				const closeBtn = staleDialog.querySelector("button");
				if (closeBtn) closeBtn.click();
			}
			// Close stale dropdown menus by pressing Escape
			const activeMenu = doc.querySelector("[role=menu], [role=listbox]");
			if (activeMenu) {
				doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			}
		}

		/**
		 * Find the action button within the message row.
		 * Instagram moved aria-label from the button div to a nested SVG/title.
		 * Any match (SVG or div) is walked up to the nearest [role=button] ancestor.
		 *
		 * @param {Element} scope
		 * @returns {Element|null}
		 */
		_findActionButton(scope) {
			for (const sel of LABEL_PATTERNS) {
				const el = scope.querySelector(sel);
				if (el) {
					// Always resolve to a clickable button container
					const btn = el.closest("[role=button]") || el.closest("button");
					if (btn && scope.contains(btn)) return btn
					// el itself is already a button-like element
					if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") return el
				}
			}

			// Fallback: any role=button with aria-haspopup=menu inside the message row
			return scope.querySelector("[role=button][aria-haspopup=menu]")
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<HTMLButtonElement>}
		 */
		async showActionsMenuButton(abortController) {
			this._dismissStaleOverlays();

			// Collect all hoverable ancestors from root down to the message bubble.
			// Instagram React listens at intermediate levels (role=group, flex-end wrapper).
			const hoverTargets = [this.root];
			const collectTargets = (el, depth) => {
				if (depth > 8) return
				for (const child of el.children) {
					hoverTargets.push(child);
					collectTargets(child, depth + 1);
				}
			};
			collectTargets(this.root, 0);

			// Try up to 3 times — hover events can be flaky
			for (let attempt = 0; attempt < 3; attempt++) {
				if (abortController.signal.aborted) return null

				for (const target of hoverTargets) {
					dispatchHoverIn(target);
				}

				await new Promise(resolve => setTimeout(resolve, 100));

				const btn = this._findActionButton(this.root);
				if (btn) {
					return btn
				}
				dispatchHoverOut(this.root);
				await new Promise(resolve => setTimeout(resolve, 50));
			}

			// Final fallback: use waitForElement with extended timeout
			const waitAbortController = new AbortController();
			let promiseTimeout;
			const abortHandler = () => {
				waitAbortController.abort("showActionsMenuButton step was aborted by the parent process");
				clearTimeout(promiseTimeout);
			};
			abortController.signal.addEventListener("abort", abortHandler);

			for (const target of hoverTargets) {
				dispatchHoverIn(target);
			}

			try {
				const actionButton = await Promise.race([
					this.waitForElement(
						this.root,
						() => this._findActionButton(this.root),
						waitAbortController
					),
					new Promise((resolve, reject) => {
						promiseTimeout = setTimeout(() => reject("Timeout showActionsMenuButton"), 3000);
					})
				]);

				if (actionButton) {
					return actionButton
				}
				return actionButton
			} finally {
				waitAbortController.abort(); // Aborting without reason because the reason is the error itself
				clearTimeout(promiseTimeout);
				abortController.signal.removeEventListener("abort", abortHandler);
			}
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<boolean>}
		 */
		async hideActionMenuButton(abortController) {
			dispatchHoverOut(this.root);

			const noneEl = this.root.querySelector("[role=none]");
			if (noneEl) {
				dispatchHoverOut(noneEl);
			}

			const waitAbortController = new AbortController();
			let promiseTimeout;
			let resolveTimeout;
			const abortHandler = () => {
				waitAbortController.abort("hideActionMenuButton step was aborted by the parent process");
				clearTimeout(promiseTimeout);
				if (resolveTimeout) {
					resolveTimeout();
				}
			};
			abortController.signal.addEventListener("abort", abortHandler);

			try {
				const result = await Promise.race([
					this.waitForElement(
						this.root,
						() => this._findActionButton(this.root) === null,
						waitAbortController
					),
					new Promise((resolve, reject) => {
						resolveTimeout = resolve;
						promiseTimeout = setTimeout(() => reject("Timeout hideActionMenuButton"), 500);
					})
				]);
				return result
			} finally {
				waitAbortController.abort(); // Aborting without reason because the reason is the error itself
				clearTimeout(promiseTimeout);
				abortController.signal.removeEventListener("abort", abortHandler);
			}
		}

		/**
		 * Opens the actions menu by clicking the action button and waiting for the "Unsend" item.
		 *
		 * @param {HTMLButtonElement} actionButton
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		async openActionsMenu(actionButton, abortController) {
			const waitAbortController = new AbortController();
			let promiseTimeout;
			const abortHandler = () => {
				waitAbortController.abort("openActionsMenu step was aborted by the parent process");
				clearTimeout(promiseTimeout);
			};
			abortController.signal.addEventListener("abort", abortHandler);

			/** Check if text matches any known "Unsend" variant */
			const isUnsendText = (text) => {
				const normalized = text.trim().toLocaleLowerCase();
				return UNSEND_TEXT_VARIANTS.some(v => normalized === v)
			};

			try {
				const unsendButton = await Promise.race([
					this.clickElementAndWaitFor(
						actionButton,
						this.root.ownerDocument.body,
						(mutations) => {
							if (mutations) {
								const addedNodes = [...mutations.map(mutation => [...mutation.addedNodes])].flat().filter(node => node.nodeType === 1);
								for (const addedNode of addedNodes) {
									const node = [...addedNode.querySelectorAll("span,div")].find(node => isUnsendText(node.textContent) && node.firstChild?.nodeType === 3);
									if (node) {
										return node
									}
								}
							}
							// Fallback: scan the whole document for an unsend menu item already present
							const allSpans = this.root.ownerDocument.querySelectorAll("[role=menu] span, [role=menu] div, [role=menuitem] span, [role=menuitem] div");
							for (const span of allSpans) {
								if (isUnsendText(span.textContent) && span.firstChild?.nodeType === 3) {
									return span
								}
							}
						},
						waitAbortController
					),
					new Promise((resolve, reject) => {
						promiseTimeout = setTimeout(() => reject("Timeout openActionsMenu"), 3000);
					})
				]);
				return unsendButton
			} finally {
				waitAbortController.abort(); // Aborting without reason because the reason is the error itself
				clearTimeout(promiseTimeout);
				abortController.signal.removeEventListener("abort", abortHandler);
			}
		}

		/**
		 * Closes the actions menu.
		 *
		 * @param {HTMLButtonElement} actionButton
		 * @param {HTMLDivElement} actionsMenuElement
		 * @param {AbortController} abortController
		 * @returns {Promise<boolean>}
		 */
		async closeActionsMenu(actionButton, actionsMenuElement, abortController) {
			const waitAbortController = new AbortController();
			let promiseTimeout;
			const abortHandler = () => {
				waitAbortController.abort("closeActionsMenu step was aborted by the parent process");
				clearTimeout(promiseTimeout);
			};
			abortController.signal.addEventListener("abort", abortHandler);

			try {
				const result = await Promise.race([
					this.clickElementAndWaitFor(
						actionButton,
						this.root.ownerDocument.body,
						() => this.root.ownerDocument.body.contains(actionsMenuElement) === false,
						abortController
					),
					new Promise((resolve, reject) => {
						promiseTimeout = setTimeout(() => reject("Timeout closeActionsMenu"), 500);
					})
				]);
				return result !== null
			} finally {
				waitAbortController.abort();
				clearTimeout(promiseTimeout);
				abortController.signal.removeEventListener("abort", abortHandler);
			}
		}

		/**
		 * Click unsend button and wait for the confirmation dialog.
		 *
		 * @param {HTMLSpanElement} unsendButton
		 * @param {AbortController} abortController
		 * @returns {Promise<HTMLButtonElement>|Promise<Error>}
		 */
		openConfirmUnsendModal(unsendButton, abortController) {
			return this.clickElementAndWaitFor(
				unsendButton,
				this.root.ownerDocument.body,
				() => this.root.ownerDocument.querySelector("[role=dialog] button"),
				abortController
			)
		}

		/**
		 * Click unsend confirm button in the modal dialog.
		 *
		 * @param {HTMLButtonElement} dialogButton
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		async confirmUnsend(dialogButton, abortController) {
			// Preserve current scroll position before Instagram rerenders
			const wrapper = findMessagesWrapper(this.root.ownerDocument.defaultView);
			const previousScrollTop = wrapper ? wrapper.scrollTop : 0;
			await this.clickElementAndWaitFor(
				dialogButton,
				this.root.ownerDocument.body,
				() => this.root.ownerDocument.querySelector("[role=dialog] button") === null,
				abortController
			);
			// Restore scroll position after rerender (with RAF + 50ms delay for virtualized lists)
			if (wrapper) {
				requestAnimationFrame(() => {
					wrapper.scrollTop = previousScrollTop;
					setTimeout(() => {
						wrapper.scrollTop = previousScrollTop;
					}, 50);
				});
			}
		}

	}

	/** @module uipi-message API for UIMessage */


	class FailedWorkflowException extends Error {}

	class UIPIMessage {

		/**
		 * @param {UIMessage} uiMessage
		 */
		constructor(uiMessage) {
			this._uiMessage = uiMessage;
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<boolean>}
		 */
		async unsend(abortController) {
			let actionButton;
			let unsendButton;
			try {
				actionButton = await this.uiMessage.showActionsMenuButton(abortController);
				unsendButton = await this.uiMessage.openActionsMenu(actionButton, abortController);
				const dialogButton = await this.uiMessage.openConfirmUnsendModal(unsendButton, abortController);
				await this.uiMessage.confirmUnsend(dialogButton, abortController);
				this.uiMessage.root.setAttribute("data-idmu-unsent", "");
				return true
			} catch(ex) {
				console.error(ex);
				this.uiMessage.root.setAttribute("data-idmu-ignore", "");
				// Dismiss any open overlay so the next message starts clean
				try {
					const doc = this.uiMessage.root.ownerDocument;
					doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
					await new Promise(resolve => setTimeout(resolve, 200));
					// If dialog is still open, press Escape again
					if (doc.querySelector("[role=dialog]")) {
						doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
						await new Promise(resolve => setTimeout(resolve, 200));
					}
				} catch (error) {
					console.error(error);
				}
				throw new FailedWorkflowException("Failed to execute workflow for this message", ex)
			}
		}

		/**
		 * @type {UIMessage}
		 */
		get uiMessage() {
			return this._uiMessage
		}

	}

	/**
	 *
	 * @abstract
	 */
	class UI extends UIComponent {

		/**
		 *
		 * @abstract
		 * @returns {UI}
		 */
		static create() {
		}

		/**
		 *
		 * @abstract
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		/* eslint-disable-next-line no-unused-vars */
		async fetchAndRenderThreadNextMessagePage(abortController) {
		}

		/**
		 *
		 * @abstract
		 * @returns {Promise<UIPIMessage>}
		 */
		async getNextUIPIMessage() {
		}

	}

	/** @module ui-messages-wrapper UI element representing the messages wrapper */


	class UIMessagesWrapper extends UIComponent {

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		fetchAndRenderThreadNextMessagePage(abortController) {
			return loadMoreMessages(this.root, abortController)
		}

	}

	/** @module default-ui Default UI / English UI */


	class DefaultUI extends UI {

		constructor(root, identifier = {}) {
			super(root, identifier);
			this.lastScrollTop = null;
		}

		/**
		 * @param {Window} window
		 * @returns {DefaultUI}
		 */
		static create(window) {
			const messagesWrapperElement = findMessagesWrapper(window);
			if (messagesWrapperElement !== null) {
				const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement);
				return new DefaultUI(window, { uiMessagesWrapper })
			} else {
				throw new Error("Unable to find messagesWrapperElement. The query selector might be out of date.")
			}
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		async fetchAndRenderThreadNextMessagePage(abortController) {
			return await this.identifier.uiMessagesWrapper.fetchAndRenderThreadNextMessagePage(abortController)
		}

		/**
		 * Scroll until a (visible) message is found and return it.
		 *
		 * Instagram uses flex-direction: column-reverse on the messages container.
		 * This means scrollTop=0 is the BOTTOM (newest messages) and scrolling to
		 * older messages requires NEGATIVE scrollTop values.
		 * In normal (non-reversed) layouts, scrollTop=0 is the top and the max is positive.
		 *
		 * This method detects the layout direction and scrolls accordingly.
		 *
		 * @param {AbortController} abortController
		 * @returns {Promise<UIPIMessage|false>}
		 */
		async getNextUIPIMessage(abortController) {
			const uiMessagesWrapperRoot = this.identifier.uiMessagesWrapper.root;

			// Detect column-reverse: scrollTop can go negative
			const style = this.root.getComputedStyle
				? this.root.getComputedStyle(uiMessagesWrapperRoot)
				: uiMessagesWrapperRoot.ownerDocument.defaultView.getComputedStyle(uiMessagesWrapperRoot);
			const isReversed = style.flexDirection === "column-reverse";

			// Pre-check: try finding a message at the current scroll position without scrolling.
			// This catches messages already visible in viewport (common for short conversations
			// and after unsending when the DOM shrinks).
			try {
				const messageElement = getFirstVisibleMessage(uiMessagesWrapperRoot, abortController, this.root);
				if (messageElement) {
					const uiMessage = new UIMessage(messageElement);
					return new UIPIMessage(uiMessage)
				}
			} catch (ex) {
				console.error(ex);
			}

			// Allow up to 3 full passes; covers cases where DOM shrinks after unsends
			for (let pass = 0; pass < 3; pass++) {
				if (abortController.signal.aborted) {
					return false
				}

				if (isReversed) {
					// column-reverse: scrollTop ranges from 0 (bottom/newest) to negative (top/oldest)
					const minScroll = -(uiMessagesWrapperRoot.scrollHeight - uiMessagesWrapperRoot.clientHeight);
					const startPos = (pass === 0 && this.lastScrollTop !== null)
						? Math.max(this.lastScrollTop, minScroll)
						: uiMessagesWrapperRoot.scrollTop;

					// Use smaller increments for short conversations to avoid overshooting
					const totalRange = Math.abs(minScroll);
					const step = totalRange < 500 ? 30 : 150;

					for (let i = startPos; i >= minScroll; i = i - step) {
						if (abortController.signal.aborted) {
							return false
						}
						this.lastScrollTop = i;
						uiMessagesWrapperRoot.scrollTop = i;
						uiMessagesWrapperRoot.dispatchEvent(new this.root.Event("scroll"));
						await new Promise(resolve => setTimeout(resolve, 5));
						try {
							const messageElement = getFirstVisibleMessage(uiMessagesWrapperRoot, abortController, this.root);
							if (messageElement) {
								const uiMessage = new UIMessage(messageElement);
								return new UIPIMessage(uiMessage)
							}
						} catch (ex) {
							console.error(ex);
						}
					}
				} else {
					// Normal layout: scrollTop ranges from 0 (top) to positive max (bottom)
					const maxScroll = uiMessagesWrapperRoot.scrollHeight - uiMessagesWrapperRoot.clientHeight;
					const startScrollTop = (pass === 0 && this.lastScrollTop !== null)
						? Math.min(this.lastScrollTop, maxScroll)
						: maxScroll;

					// Use smaller increments for short conversations
					const step = maxScroll < 500 ? 30 : 150;

					for (let i = Math.max(1, startScrollTop); i > 0; i = i - step) {
						if (abortController.signal.aborted) {
							return false
						}
						this.lastScrollTop = i;
						uiMessagesWrapperRoot.scrollTop = i;
						uiMessagesWrapperRoot.dispatchEvent(new this.root.Event("scroll"));
						await new Promise(resolve => setTimeout(resolve, 5));
						try {
							const messageElement = getFirstVisibleMessage(uiMessagesWrapperRoot, abortController, this.root);
							if (messageElement) {
								const uiMessage = new UIMessage(messageElement);
								return new UIPIMessage(uiMessage)
							}
						} catch (ex) {
							console.error(ex);
						}
					}
				}

				// Reached the end without finding a message.
				// Reset for a fresh pass (DOM may have shrunk after unsends).
				this.lastScrollTop = null;
			}
			return false
		}

	}

	/** @module get-ui UI loader module. Allow loading of a certain UI based on a given strategy (locale etc..)
	 * There might be need for multiple UI as Instagram might serve different apps based on location for example.
	 * There is also a need to internationalize each ui so that it doesn't fail if we change the language.
	 */


	/**
	 *
	 * @returns {UI}
	 */
	function getUI() {
		return DefaultUI
	}

	/** @module uipi API for UI */


	/**
	 * UI Interface API
	 */
	class UIPI {

		/**
		 *
		 * @param {UI} ui
		 */
		constructor(ui) {
			this._ui = ui;
		}

		/**
		 *
		 * @param {Window} window
		 * @returns {UIPI}
		 */
		static create(window) {
			const ui = getUI().create(window);
			return new UIPI(ui)
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		fetchAndRenderThreadNextMessagePage(abortController) {
			return this.ui.fetchAndRenderThreadNextMessagePage(abortController)
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<UIPIMessage>}
		 */
		getNextUIPIMessage(abortController) {
			return this.ui.getNextUIPIMessage(abortController)
		}

		/**
		 *
		 * @type {UI}
		 */
		get ui() {
			return this._ui
		}

	}

	/** @module idmu Global/Main API for interacting with the UI */


	class IDMU {

		/**
		 *
		 * @param {Window} window
		 * @param {callback} onStatusText
		 */
		constructor(window, onStatusText) {
			this.window = window;
			this.uipi = null;
			this.onStatusText = onStatusText;
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<UIPIMessage>}
		 */
		getNextUIPIMessage(abortController) {
			return this.uipi.getNextUIPIMessage(abortController)
		}

		/**
		 *
		 * @param {string} text
		 */
		setStatusText(text) {
			this.onStatusText(text);
		}


		/**
		 *
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		fetchAndRenderThreadNextMessagePage(abortController) {
			return this.uipi.fetchAndRenderThreadNextMessagePage(abortController)
		}

		/**
		 * Map Instagram UI
		 */
		loadUIPI() {
			this.uipi = UIPI.create(this.window);
		}


	}

	/** @module unsend-strategy Various strategies for unsending messages */


	/**
	 *
	 * @abstract
	 */
	class UnsendStrategy {

		/**
		 *
		 * @param {IDMU} idmu
		 */
		constructor(idmu) {
			this._idmu = idmu;
		}

		/**
		 *
		 * @abstract
		 * @returns {boolean}
		 */
		isRunning() {
		}

		/**
		 *
		 * @abstract
		 */
		stop() {
		}

		/**
		 *
		 * @abstract
		 */
		reset() {
		}

		/**
		 *
		 * @abstract
		 */
		async run() {
		}

		/**
		 * @readonly
		 * @type {IDMU}
		 */
		get idmu() {
			return this._idmu
		}

	}

	/** @module unsend-strategy Various strategies for unsending messages */


	/**
	 * Loads all pages first, then unsends messages from bottom to top.
	 * For short conversations (all messages fit in viewport), skips page loading entirely.
	 */
	class DefaultStrategy extends UnsendStrategy {

		/**
		 * @param {IDMU} idmu
		 */
		constructor(idmu) {
			super(idmu);
			this._allPagesLoaded = false;
			this._unsentCount = 0;
			this._pagesLoadedCount = 0;
			this._running = false;
			this._abortController = null;
			this._lastUnsendDate = null;
			this._consecutiveFailures = 0;
		}

		/**
		 * @returns {boolean}
		 */
		isRunning() {
			return this._running && this._abortController && this._abortController.signal.aborted === false
		}

		stop() {
			this.idmu.setStatusText("Stopping...");
			this._abortController.abort("DefaultStrategy stopped");
		}

		reset() {
			this._allPagesLoaded = false;
			this._unsentCount = 0;
			this._lastUnsendDate = null;
			this._pagesLoadedCount = 0;
			this._consecutiveFailures = 0;
			this.idmu.setStatusText("Ready");
		}

		/**
		 * @returns {Promise}
		 */
		async run() {
			this._unsentCount = 0;
			this._pagesLoadedCount = 0;
			this._consecutiveFailures = 0;
			this._running = true;
			this._abortController = new AbortController();
			// Clear stale ignore markers from previous runs so messages can be retried
			this.idmu.window.document.querySelectorAll("[data-idmu-ignore]").forEach(el => {
				el.removeAttribute("data-idmu-ignore");
			});
			this.idmu.loadUIPI();
			try {
				if (this._allPagesLoaded) {
					await this.#unsendNextMessage();
				} else {
					await this.#loadNextPage();
				}

				// Race condition: on first page load, Instagram's React may not have
				// finished hydrating message components (role attributes missing).
				// If we found nothing, wait and re-scan up to 3 times.
				if (this._unsentCount === 0 && !this._abortController.signal.aborted) {
					for (let retry = 1; retry <= 3; retry++) {
						this.idmu.setStatusText(`No messages detected, retrying (${retry}/3)...`);
						await new Promise(resolve => setTimeout(resolve, 2000));
						if (this._abortController.signal.aborted) break
						// Reset for fresh scan
						this._allPagesLoaded = false;
						this._consecutiveFailures = 0;
						this.idmu.window.document.querySelectorAll("[data-idmu-ignore]").forEach(el => {
							el.removeAttribute("data-idmu-ignore");
						});
						this.idmu.loadUIPI();
						await this.#loadNextPage();
						if (this._unsentCount > 0 || this._abortController.signal.aborted) break
					}
				}

				if (this._abortController.signal.aborted) {
					this.idmu.setStatusText(`Aborted. ${this._unsentCount} message(s) unsent.`);
				} else {
					this.idmu.setStatusText(`Done. ${this._unsentCount} message(s) unsent.`);
				}
			} catch (ex) {
				console.error(ex);
				this.idmu.setStatusText(`Errored. ${this._unsentCount} message(s) unsent.`);
			}
			this._running = false;
		}

		/**
		 * Tries to load the thread next page.
		 * If loadMoreMessages returns true (no more pages), moves to unsending.
		 */
		async #loadNextPage() {
			if (this._abortController.signal.aborted) {
				return
			}
			this.idmu.setStatusText("Loading next page...");
			try {
				const done = await this.idmu.fetchAndRenderThreadNextMessagePage(this._abortController);
				if (this._abortController.signal.aborted === false) {
					if (done) {
						this.idmu.setStatusText(`All pages loaded (${this._pagesLoadedCount} in total). Unsending...`);
						this._allPagesLoaded = true;
						await this.#unsendNextMessage();
					} else {
						this._pagesLoadedCount++;
						await this.#loadNextPage();
					}
				} else {
				}
			} catch (ex) {
				console.error(ex);
			}
		}

		/**
		 * Unsend first message in viewport.
		 * Uses adaptive delays: fast baseline (1-2s) with exponential backoff on rate limit detection.
		 */
		async #unsendNextMessage() {
			if (this._abortController.signal.aborted) {
				return
			}
			if (this._consecutiveFailures >= 5) {
				this.idmu.setStatusText(`Stopped: ${this._consecutiveFailures} consecutive failures. ${this._unsentCount} message(s) unsent.`);
				return
			}
			let canScroll = true;
			let msgElement = null;
			try {
				this.idmu.setStatusText(`Retrieving next message... (${this._unsentCount} unsent so far)`);
				const uipiMessage = await this.idmu.getNextUIPIMessage(this._abortController);
				canScroll = uipiMessage !== false;
				if (uipiMessage) {
					this.idmu.setStatusText(`Unsending message... (${this._unsentCount + 1})`);

					// Adaptive delay: 1-2s randomized baseline between unsends
					if (this._lastUnsendDate !== null) {
						const elapsed = Date.now() - this._lastUnsendDate.getTime();
						const minDelay = 1000 + Math.floor(Math.random() * 1000); // 1-2s
						if (elapsed < minDelay) {
							const waitMs = minDelay - elapsed;
							this.idmu.setStatusText(`Waiting ${(waitMs / 1000).toFixed(1)}s... (${this._unsentCount} unsent so far)`);
							await new Promise(resolve => setTimeout(resolve, waitMs));
						}
					}

					if (this._abortController.signal.aborted) return

					msgElement = uipiMessage.uiMessage.root;
					const unsent = await uipiMessage.unsend(this._abortController);

					if (unsent) {
						// Verify the message actually disappeared from DOM (server accepted the mutation)
						await new Promise(resolve => setTimeout(resolve, 800));
						const stillInDOM = msgElement.isConnected && !msgElement.hasAttribute("data-idmu-unsent");
						if (stillInDOM) {
							// Server likely rejected — the message reappeared after optimistic removal
							msgElement.removeAttribute("data-idmu-ignore");
							this._consecutiveFailures++;
							const backoffMs = Math.min(60000, 5000 * Math.pow(2, this._consecutiveFailures - 1));
							this.idmu.setStatusText(`Rate limit detected. Backing off ${(backoffMs / 1000).toFixed(0)}s... (${this._unsentCount} unsent)`);
							await new Promise(resolve => setTimeout(resolve, backoffMs));
						} else {
							this._lastUnsendDate = new Date();
							this._unsentCount++;
							this._consecutiveFailures = 0;
							// DOM shrunk after removal; reset scroll for fresh scan
							if (this.idmu.uipi && this.idmu.uipi.ui) {
								this.idmu.uipi.ui.lastScrollTop = null;
							}
						}
					} else {
						// Unsend workflow returned false — allow retry on next pass
						msgElement.removeAttribute("data-idmu-ignore");
						this._consecutiveFailures++;
					}
				}
			} catch (ex) {
				console.error(ex);
				// Remove ignore marker so this message can be retried
				if (msgElement) {
					msgElement.removeAttribute("data-idmu-ignore");
				}
				this._consecutiveFailures++;
				const backoffMs = Math.min(60000, 3000 * Math.pow(2, this._consecutiveFailures - 1));
				this.idmu.setStatusText(`Workflow failed (${this._consecutiveFailures}/5), retrying in ${(backoffMs / 1000).toFixed(0)}s... (${this._unsentCount} unsent)`);
				await new Promise(resolve => setTimeout(resolve, backoffMs));
			} finally {
				if (canScroll && this._abortController && !this._abortController.signal.aborted) {
					await this.#unsendNextMessage();
				}
			}
		}

	}

	/** @module alert Alert UI */

	/**
	 *
	 * @param {Document} document
	 * @returns {HTMLButtonElement}
	 */
	function createAlertsWrapperElement(document) {
		const alertsWrapperElement = document.createElement("div");
		alertsWrapperElement.id = "idmu-alerts";
		alertsWrapperElement.style.position = "fixed";
		alertsWrapperElement.style.top = "20px";
		alertsWrapperElement.style.right = "20px";
		alertsWrapperElement.style.display = "grid";
		return alertsWrapperElement
	}

	/** @module overlay IDMU's overlay */

	/**
	 * @param {Document} document
	 * @returns {HTMLDivElement}
	 */
	function createOverlayElement(document) {
		const overlayElement = document.createElement("div");
		overlayElement.id = "idmu-overlay";
		overlayElement.tabIndex = 0;
		overlayElement.style.top = "0";
		overlayElement.style.right = "0";
		overlayElement.style.position = "fixed";
		overlayElement.style.width = "100vw";
		overlayElement.style.height = "100vh";
		overlayElement.style.zIndex = "998";
		overlayElement.style.backgroundColor = "#000000d6";
		overlayElement.style.display = "none";
		return overlayElement
	}

	/** @module ui IDMU's own ui/overlay
	 * Provide a button to unsend messages
	 */


	class OSD {
		/**
		 *
		 * @param {Document} document
		 * @param {HTMLDivElement} root
		 * @param {HTMLDivElement} overlayElement
		 * @param {HTMLDivElement} menuElement
		 * @param {HTMLButtonElement} unsendThreadMessagesButton
		 * @param {HTMLDivElement} statusElement
		 */
		constructor(document, root, overlayElement, menuElement, unsendThreadMessagesButton, statusElement) {
			this._document = document;
			this._root = root;
			this._overlayElement = overlayElement;
			this._menuElement = menuElement;
			this._statusElement = statusElement;
			this._unsendThreadMessagesButton = unsendThreadMessagesButton;
			this._idmu = new IDMU(this.window, this.onStatusText.bind(this));
			this._strategy = new DefaultStrategy(this._idmu); // TODO move out
		}

		/**
		 *
		 * @param {window} window
		 * @returns {OSD}
		 */
		static render(window) {
			const ui = OSD.create(window.document);
			window.document.body.appendChild(ui.root);
			return ui
		}

		/**
		 *
		 * @param   {Document} document
		 * @returns {OSD}
		 */
		static create(document) {
			const root = document.createElement("div");
			root.id = "idmu-root";
			const menuElement = createMenuElement(document);
			const overlayElement = createOverlayElement(document);
			const alertsWrapperElement = createAlertsWrapperElement(document);
			const unsendThreadMessagesButton = createMenuButtonElement(document, "Unsend all DMs", BUTTON_STYLE.PRIMARY);
			const statusElement = document.createElement("div");
			statusElement.textContent = "Ready";
			statusElement.id = "idmu-status";
			statusElement.style = "width: 200px";
			document.body.appendChild(overlayElement);
			document.body.appendChild(alertsWrapperElement);
			menuElement.appendChild(unsendThreadMessagesButton);
			menuElement.appendChild(statusElement);
			root.appendChild(menuElement);
			const ui = new OSD(document, root, overlayElement, menuElement, unsendThreadMessagesButton, statusElement);
			document.addEventListener("keydown", (event) => ui.#onWindowKeyEvent(event)); // TODO test
			document.addEventListener("keyup", (event) => ui.#onWindowKeyEvent(event)); // TODO test
			unsendThreadMessagesButton.addEventListener("click", (event) => ui.#onUnsendThreadMessagesButtonClick(event));
			ui._mutationObserver = new MutationObserver((mutations) => ui.#onMutations(ui, mutations));
			ui._mutationObserver.observe(document.body, { childList: true }); // TODO test
			unsendThreadMessagesButton.dataTextContent = unsendThreadMessagesButton.textContent;
			unsendThreadMessagesButton.dataBackgroundColor = unsendThreadMessagesButton.style.backgroundColor;
			return ui
		}

		/**
		 *
		 * @param {string} text
		 */
		onStatusText(text) {
			this.statusElement.textContent = text;
		}

		async #startUnsending() {
	[...this.menuElement.querySelectorAll("button")].filter(button => button !== this.unsendThreadMessagesButton).forEach(button => {
				button.style.visibility = "hidden";
				button.disabled = true;
			});
			this.overlayElement.style.display = "";
			this.overlayElement.focus();
			this.unsendThreadMessagesButton.textContent = "Stop processing";
			this.unsendThreadMessagesButton.style.backgroundColor = "#FA383E";
			this.statusElement.style.color = "white";
			this._mutationObserver.disconnect();
			try {
				await this.strategy.run();
			} catch(error) {
				console.error(error);
				if(this.strategy.isRunning()) {
					this.strategy.stop();
				}
				this.statusElement.textContent = "An error occurred. Check the browser console for details.";
			} finally {
				this.#onUnsendingFinished();
			}
		}

		/**
		 *
		 * @param {OSD} ui
		 */
		#onMutations(ui) {
			if(ui.root.ownerDocument.querySelector("[id^=mount] > div > div > div") !== null && ui) {
				if(this._mutationObserver) {
					this._mutationObserver.disconnect();
				}
				this._mutationObserver = new MutationObserver(ui.#onMutations.bind(this, ui));
				this._mutationObserver.observe(ui.root.ownerDocument.querySelector("[id^=mount] > div > div > div"), { childList: true, attributes: true });
			}
			if(this.window.location.pathname.startsWith("/direct/t/")) {
				if(!this.strategy.isRunning()) {
					this.strategy.reset();
				}
				this.root.style.display = "";
			} else {
				this.root.style.display = "none";
				if(this.strategy.isRunning()) {
					this.strategy.stop();
				}
			}
		}

		/**
		 *
		 * @param {OSD} ui
		 * @param {Event} event
		 */
		#onUnsendThreadMessagesButtonClick() {
			if(this.strategy.isRunning()) {
				this.strategy.stop();
				this.#onUnsendingFinished();
			} else {
				this.#startUnsending();
			}
		}

		/**
		 *
		 * @param {Event} event
		 * @returns {boolean}
		 */
		#onWindowKeyEvent(event) {
			if(this.strategy.isRunning()) {
				console.log("User interaction is disabled as the unsending is still running; Please stop the execution first.");
				event.stopImmediatePropagation();
				event.preventDefault();
				event.stopPropagation();
				this.overlayElement.focus();
				return false
			}
		}

		#onUnsendingFinished() {
	[...this.menuElement.querySelectorAll("button")].filter(button => button !== this.unsendThreadMessagesButton).forEach(button => {
				button.style.visibility = "";
				button.disabled = false;
			});
			this.unsendThreadMessagesButton.textContent = this.unsendThreadMessagesButton.dataTextContent;
			this.unsendThreadMessagesButton.style.backgroundColor = this.unsendThreadMessagesButton.dataBackgroundColor;
			this.overlayElement.style.display = "none";
			this.statusElement.style.color = "";
			this._mutationObserver.observe(this._document.body, { childList: true }); // TODO test
		}

		/**
		 * @readonly
		 * @type {Document}
		 */
		get document() {
			return this._document
		}

		/**
		 * @readonly
		 * @type {Window}
		 */
		get window() {
			return this._document.defaultView
		}

		/**
		 * @readonly
		 * @type {HTMLDivElement}
		 */
		get root() {
			return this._root
		}

		/**
		 * @readonly
		 * @type {HTMLDivElement}
		 */
		get overlayElement() {
			return this._overlayElement
		}

		/**
		 * @readonly
		 * @type {HTMLDivElement}
		 */
		get menuElement() {
			return this._menuElement
		}

		/**
		 * @readonly
		 * @type {HTMLButtonElement}
		 */
		get unsendThreadMessagesButton() {
			return this._unsendThreadMessagesButton
		}

		/**
		 * @readonly
		 * @type {HTMLDivElement}
		 */
		get statusElement() {
			return this._statusElement
		}

		/**
		 * @readonly
		 * @type {UnsendStrategy}
		 */
		get strategy() { // TODO move out
			return this._strategy
		}

		/**
		 * @readonly
		 * @type {IDMU}
		 */
		get idmu() {
			return this._idmu
		}

	}

	/** @module main Main module */


	/**
	 * @param {Window} window
	 */
	function main(window) {
		OSD.render(window);
	}

	if(typeof window !== "undefined") {
		main(window);
	}

	exports.main = main;

	return exports;

})({});
