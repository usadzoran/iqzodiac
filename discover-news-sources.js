/*
 * Discover / World News & Trends source registry.
 * Configuration only. Fetching and database synchronization live elsewhere.
 * Keep all source URLs in English and edit this list when sources change.
 */
const IQZodiacDiscoverNewsSources = Object.freeze([
  {
    category: 'US News',
    sources: Object.freeze([
      Object.freeze({ key: 'npr', name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' }),
      Object.freeze({ key: 'nbc-news', name: 'NBC News', url: 'https://feeds.nbcnews.com/nbcnews/public/news' }),
      Object.freeze({ key: 'abc-news', name: 'ABC News', url: 'https://abcnews.go.com/abcnews/topstories' }),
      Object.freeze({ key: 'cbs-news', name: 'CBS News', url: 'https://www.cbsnews.com/latest/rss/main' }),
      Object.freeze({ key: 'new-york-times-homepage', name: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' }),
    ]),
  },
  {
    category: 'World News',
    sources: Object.freeze([
      Object.freeze({ key: 'bbc-world', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }),
      Object.freeze({ key: 'al-jazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' }),
      Object.freeze({ key: 'the-guardian', name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' }),
      Object.freeze({ key: 'deutsche-welle', name: 'Deutsche Welle', url: 'https://rss.dw.com/xml/rss-en-all' }),
    ]),
  },
  {
    category: 'Special Categories',
    sources: Object.freeze([
      Object.freeze({ key: 'technology', name: 'Technology', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml' }),
      Object.freeze({ key: 'business', name: 'Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' }),
      Object.freeze({ key: 'politics', name: 'Politics', url: 'https://rss.politico.com/politics-news.xml' }),
    ]),
  },
]);

if (typeof module !== 'undefined' && module.exports) module.exports = IQZodiacDiscoverNewsSources;
if (typeof window !== 'undefined') window.IQZodiacDiscoverNewsSources = IQZodiacDiscoverNewsSources;
