const { chromium } = require("playwright");
const axios = require("axios");

require("dotenv").config();

let currentPage;
async function extractReviews(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });

  // this handle pop I am not able to optimize without llm.
  await handlePopups(page);

  await clickSeeAllReviews(page);

  const html = await page.content();
  const selectors = await getSelectorsFromLLM(html);

  let reviews = [];
  let hasNextPage = true;
  currentPage = 1;

  while (hasNextPage) {
    const pageReviews = await extractPageReviews(page, selectors);
    reviews = reviews.concat(pageReviews);
    console.log(pageReviews);
    hasNextPage = await goToNextPage(page, selectors.nextPageSelector);
    currentPage++;
  }

  await browser.close();

  return {
    reviews_count: reviews.length,
    reviews: reviews,
  };
}

async function handlePopups(page) {
  const popupCloseSelectors = [
    'button[aria-label="Close"]',
    '.modal-close',
    '.popup-close',
  ];

  for (const selector of popupCloseSelectors) {
    try {
      await page.click(selector, { timeout: 5000 });
      console.log(`Closed popup using selector: ${selector}`);
      // Wait a bit for the popup to disappear
      await page.waitForTimeout(1000);
    } catch (error) {
      // If the selector isn't found or can't be clicked, move to the next one
      console.log(`No popup found with selector: ${selector}`);
    }
  }
}

async function clickSeeAllReviews(page) {
  const seeAllReviewsSelectors = [
    'a:text("See all reviews")',
    'button:text("See all reviews")',
  ];

  for (const selector of seeAllReviewsSelectors) {
    try {
      await page.click(selector, { timeout: 5000 });
      console.log(`Clicked "See all reviews" using selector: ${selector}`);
      // Wait for the reviews to load
      await page.waitForTimeout(2000);
      return;
    } catch (error) {
      console.log(`No "See all reviews" button found with selector: ${selector}`);
    }
  }
}

async function getSelectorsFromLLM(html) {
    const response =  await axios.post('https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-4o-mini",
        messages: [
          {role: "system", content: "You are a helpful assistant that identifies CSS selectors and provide respones in javascript object format , in key value pair, example {reviewsContainer:.reviews, reviewContainer:review, title:.title, body:.body, rating:.rating, reviewer:.reviewer, nextPageSelector:.next}. the immediate child of reviewsContainer should be one or more reviewContainer. The nextPageSelector should be the selector for the next page button."},
          {role: "user", content: `Given the following HTML, provide CSS selectors in object with keys reviewsContainer, reviewContainer, title, body, rating, reviewer, nextPageSelector for review elements:\n\n${html}\n\nCSS Selectors without any explaination:`}
        ]
      },
      {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(response.data.choices[0].message.content);


    // const data={
    //   reviewsContainer: '#judgeme_product_reviews',
    //   reviewContainer: '.jdgm-rev',
    //   title: '.jdgm-rev__title',
    //   body: '.jdgm-rev__body p',
    //   rating: '.jdgm-rev__rating',
    //   reviewer: '.jdgm-rev__author',
    //   nextPageSelector: '.jdgm-paginate__next-page'
    // }

  

let cleanedResponse = response.data.choices[0].message.content.replace(/```javascript|```/g, '').trim();

const selectors = eval(`(${cleanedResponse})`);

// console.log(selectors);
  
  return selectors;
}

async function extractPageReviews(page, selectors) {
  return page.evaluate((selectors) => {
    const container = document.querySelector(selectors.reviewsContainer);
    if (!container) return [];

    const reviewElements = container.querySelectorAll(selectors.reviewContainer);
    return Array.from(reviewElements).map((review) => ({
      title: review.querySelector(selectors.title)?.textContent.trim() || "",
      body: review.querySelector(selectors.body)?.textContent.trim() || "",
      rating: parseInt(
        review.querySelector(selectors.rating)?.getAttribute('aria-label')?.match(/\d+/)?.[0] ||
        review.querySelector(selectors.rating)?.textContent.trim() || "0"
      ),
      reviewer: review.querySelector(selectors.reviewer)?.textContent.trim() || "",
    }));
  }, selectors);
}


async function goToNextPage(page, nextPageSelector) {
  console.log('Attempting to go to the next page...');
  const nextPageButton = await page.$(nextPageSelector);
  
  if (nextPageButton && currentPage < 10) {
    console.log('Next page button found. Scrolling into view...');
    await nextPageButton.scrollIntoViewIfNeeded();
    
    console.log('Trying to click the button...');
    await nextPageButton.click({ force: true }).catch(err => {
      console.log('Error clicking button:', err);
    });

    console.log('Waiting for reviews to load...');
    await page.waitForSelector('.jdgm-rev', { timeout: 5000 }).catch(err => {
      console.log('Error waiting for reviews:', err);
    });
    
    return true;
  }
  
  console.log('No next page button or maximum pages reached.');
  return false;
}



module.exports = { extractReviews };
