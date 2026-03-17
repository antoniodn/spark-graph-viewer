/*!
  * Utils.js 
  * Copyright 2026 Spark Graph Viewer
  * Licensed under MIT (license text available in LICENSE file)
  */


/**
 * Truncates a string if it exceeds a specified maximum length,
 * appending an ellipsis to the end.
 *
 * @param {string} t The original text to be truncated.
 * @param {number} ms The maximum allowed length for the string.
 * @return {string} The formatted text, truncated with "…" if necessary,
 *     or the original string if it is within the limit.
 */
const truncateText = (t, ms) => { 
    if ((t || "").length > ms) {
        return (t || "").substring(0, ms) + "\u2026";
    } 
    return (t || ""); 
};

/**
 * Format number with space as thousands separator
 *
 * @param {number} num - number to format
 * @returns {string} - formatted number
 */
function formatWithSpace(num) {
    return new Intl.NumberFormat("en-US")
        .formatToParts(num)
        .map(({ type, value }) => type === "group" ? " " : value)
        .join("");
    }

/**
 * Fast hash function for strings
 *
 * @param {string} str - input string
 * @returns {string} - hash value as string
 */
function fastHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i); // Bitwise operations are fast
        hash |= 0; // Convert to 32bit integer
    }
    return String(hash >>> 0); // Ensure the result is unsigned    
}

/**
 * Normalizes a string by removing accents/diacritics and converting it to lowercase.
 *
 * @param {string} t The text to be normalized.
 * @return {string} The normalized string, stripped of marks and downcased.
 */
const normalizeText = (t) => { 
    return (t || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); 
};


/**
 * Get Font Awesome icon names from the loaded CSS
 *
 * @returns {Array} - array of icon objects with prefix, iconName, and uiText
 */
function fontAwesomeIconNames() {
    const prefixes = [{prefix:"fas",title:"Solid"}, {prefix:"far",title:"Regular"}, {prefix:"fab",title:"Brands"}];
    const styleSheets = document.styleSheets;
    let fontAwesomeSheet = null;
    const iconClasses = new Array();

    const iconDefinition = window.FontAwesome.findIconDefinition;

    // Locate the Font Awesome stylesheet
    for (const sheet of styleSheets) {
        if (sheet.href && sheet.href.includes("font-awesome")) {
            fontAwesomeSheet = sheet;
            break;
        }
    }

    // If not found, return empty array
    if (!fontAwesomeSheet) {
        console.error("Font Awesome stylesheet not found.");
        return [];
    }

    // Iterate through the CSS rules to extract icon class names
    try {
        for (const rule of fontAwesomeSheet.cssRules) {
            if (rule instanceof CSSStyleRule && rule.selectorText) {
                // Check if the rule defines a Font Awesome icon
                const faProperty = rule.style.getPropertyValue("--fa");

                // Ignore pseudo-elements when faProperty is not defined
                if (faProperty == null && faProperty == "") {
                    continue;
                }

                // Check if the selector matches the Font Awesome icon pattern
                if (!(rule.selectorText && rule.selectorText.startsWith(".fa-"))) {
                    continue;
                }

                // Extract icon names from the selector
                let icon_list = rule.selectorText.split(",");
                for(const ico of icon_list) {
                    for (const p of prefixes) {
                        let icodef = iconDefinition({ prefix: p.prefix, iconName: ico.trim().replace(".fa-", "") });
                        if (icodef != undefined) {
                            let icon = {}
                            icon["prefix"] = icodef.prefix;
                            icon["iconName"] = icodef.iconName;
                            icon["uiText"] = ico.trim()
                                            .replace(".fa-", "")
                                            .replace(/-/g, " ")
                                            .replace(/\b\w/g, c => c.toUpperCase())
                                            + " (" + prefixes[prefixes.findIndex(p => p.prefix === icodef.prefix)].title + ")";
                            iconClasses.push(icon);
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Could not read CSS rules due to Same-Origin Policy:", e);
    }

    iconClasses.sort((a, b) => a.uiText.localeCompare(b.uiText))

    return iconClasses;
}

/**
 * Exports the utility functions for use in other modules.
 */
export { 
  truncateText,
  formatWithSpace,
  fastHash,
  normalizeText,
  fontAwesomeIconNames,  
};