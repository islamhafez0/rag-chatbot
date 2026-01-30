import puppeteer from "puppeteer";

export async function scrapeUrl(url: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set User-Agent to avoid being blocked by some sites
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  );

  try {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 6000)); // Wait for JS rendering and hydrate

    // Extract text from standard content tags
    const content = await page.evaluate(() => {
      // Remove noise
      const selectors = [
        "nav",
        "header",
        "footer",
        "script",
        "style",
        "iframe",
        "noscript",
      ];
      selectors.forEach((s) => {
        document.querySelectorAll(s).forEach((el) => el.remove());
      });

      // Get title and body text
      const title = document.title;
      const body = document.body.innerText;
      return `${title}\n\n${body}`;
    });

    console.log(`Scraped ${content.length} characters.`);
    return content;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return "";
  } finally {
    await browser.close();
  }
}

// ESM compatible main module check
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  if (url) {
    scrapeUrl(url).then(console.log);
  } else {
    console.log("Please provide a URL as an argument.");
  }
}
