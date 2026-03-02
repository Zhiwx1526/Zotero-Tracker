export interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  updated: string;
  categories: string[];
  pdfUrl: string;
  doi?: string;
  journalRef?: string;
}

export interface ArxivSearchOptions {
  query: string;
  maxResults?: number;
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  sortOrder?: 'ascending' | 'descending';
  start?: number;
}

export class ArxivCrawler {
  // 使用本地Python服务器获取文献
  private readonly API_BASE_URL = 'http://api.wlai.vip/arxiv';
  private readonly PYTHON_API_URL = 'http://localhost:5000';

  constructor(private zotero: any) { }

  // 生成5-10秒的随机延迟
  private async delay(): Promise<void> {
    const delayMs = Math.floor(Math.random() * 5000) + 5000; // 5-10秒
    this.zotero.debug(`Waiting ${delayMs}ms before next request`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  async searchPapers(options: ArxivSearchOptions): Promise<ArxivPaper[]> {
    const {
      query,
      maxResults = 20,
      sortBy = 'relevance',
      sortOrder = 'descending',
      start = 0
    } = options;

    try {
      // 尝试使用Python服务器
      try {
        const pythonUrl = `${this.PYTHON_API_URL}/search?query=${encodeURIComponent(query)}&maxResults=${maxResults}&sortBy=${sortBy}&sortOrder=${sortOrder}&start=${start}`;

        const response = await fetch(pythonUrl, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const papers = await response.json();
          this.zotero.debug(`Successfully fetched ${papers.length} papers from Python API`);
          return papers as ArxivPaper[];
        }
      } catch (pythonError) {
        this.zotero.debug(`Python API error: ${pythonError}, falling back to default API`);
      }

      // 回退到默认API
      const url = this.buildSearchUrl(query, maxResults, sortBy, sortOrder, start);

      // 使用完整的请求头模拟浏览器请求
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9'
        }
        // 移除 AbortSignal，因为 Zotero 环境可能不支持
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const xmlText = await response.text();

      // 请求完成后添加延迟
      await this.delay();

      return this.parseArxivResponse(xmlText);
    } catch (error) {
      this.zotero.debug(`Error searching arXiv: ${error}`);
      throw error;
    }
  }

  private buildSearchUrl(
    query: string,
    maxResults: number,
    sortBy: string,
    sortOrder: string,
    start: number
  ): string {
    const params = new URLSearchParams({
      search_query: query,
      start: start.toString(),
      max_results: maxResults.toString(),
      sortBy: sortBy,
      sortOrder: sortOrder
    });

    return `${this.API_BASE_URL}?${params.toString()}`;
  }

  private parseArxivResponse(xmlText: string): ArxivPaper[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const entries = xmlDoc.getElementsByTagName('entry');
    const papers: ArxivPaper[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const paper = this.parseEntry(entry);
      if (paper) {
        papers.push(paper);
      }
    }

    return papers;
  }

  private parseEntry(entry: Element): ArxivPaper | null {
    try {
      const id = this.getTextContent(entry, 'id');
      const arxivId = this.extractArxivId(id);

      const title = this.getTextContent(entry, 'title');
      const summary = this.getTextContent(entry, 'summary');
      const published = this.getTextContent(entry, 'published');
      const updated = this.getTextContent(entry, 'updated');

      const authors = this.parseAuthors(entry);
      const categories = this.parseCategories(entry);

      const links = entry.getElementsByTagName('link');
      let pdfUrl = '';
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const type = link.getAttribute('type');
        const href = link.getAttribute('href');
        if (type === 'application/pdf' && href) {
          pdfUrl = href;
          break;
        }
      }

      const doi = this.getTextContent(entry, 'arxiv:doi') || undefined;
      const journalRef = this.getTextContent(entry, 'arxiv:journal_ref') || undefined;

      return {
        id: arxivId,
        title: title.trim(),
        authors,
        abstract: summary.trim(),
        published,
        updated,
        categories,
        pdfUrl,
        doi,
        journalRef
      };
    } catch (error) {
      this.zotero.debug(`Error parsing entry: ${error}`);
      return null;
    }
  }

  private parseAuthors(entry: Element): string[] {
    const authors: string[] = [];
    const authorElements = entry.getElementsByTagName('author');

    for (let i = 0; i < authorElements.length; i++) {
      const authorElement = authorElements[i];
      const nameElement = authorElement.getElementsByTagName('name')[0];
      if (nameElement) {
        authors.push(nameElement.textContent || '');
      }
    }

    return authors;
  }

  private parseCategories(entry: Element): string[] {
    const categories: string[] = [];
    const categoryElements = entry.getElementsByTagName('category');

    for (let i = 0; i < categoryElements.length; i++) {
      const categoryElement = categoryElements[i];
      const term = categoryElement.getAttribute('term');
      if (term) {
        categories.push(term);
      }
    }

    return categories;
  }

  private getTextContent(element: Element, tagName: string): string {
    const elements = element.getElementsByTagName(tagName);
    return elements[0]?.textContent || '';
  }

  private extractArxivId(url: string): string {
    const match = url.match(/arxiv\.org\/abs\/(\d+\.\d+)/);
    return match ? match[1] : url;
  }

  async getPaperById(arxivId: string): Promise<ArxivPaper | null> {
    try {
      // 尝试使用Python服务器
      try {
        const pythonUrl = `${this.PYTHON_API_URL}/paper/${arxivId}`;

        const response = await fetch(pythonUrl, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const paper = await response.json();
          this.zotero.debug(`Successfully fetched paper ${arxivId} from Python API`);
          return paper as ArxivPaper | null;
        }
      } catch (pythonError) {
        this.zotero.debug(`Python API error: ${pythonError}, falling back to default API`);
      }

      // 回退到默认API
      const query = `id:${arxivId}`;
      const papers = await this.searchPapers({ query, maxResults: 1 });
      return papers.length > 0 ? papers[0] : null;
    } catch (error) {
      this.zotero.debug(`Error getting paper by ID: ${error}`);
      return null;
    }
  }

  async searchByCategory(
    category: string,
    options?: Partial<ArxivSearchOptions>
  ): Promise<ArxivPaper[]> {
    try {
      // 尝试使用Python服务器
      try {
        const {
          maxResults = 20,
          sortBy = 'relevance',
          sortOrder = 'descending',
          start = 0
        } = options || {};

        const pythonUrl = `${this.PYTHON_API_URL}/search/category?category=${encodeURIComponent(category)}&maxResults=${maxResults}&sortBy=${sortBy}&sortOrder=${sortOrder}&start=${start}`;

        const response = await fetch(pythonUrl, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const papers = await response.json();
          this.zotero.debug(`Successfully fetched papers from category ${category} from Python API`);
          return papers as ArxivPaper[];
        }
      } catch (pythonError) {
        this.zotero.debug(`Python API error: ${pythonError}, falling back to default API`);
      }

      // 回退到默认API
      const query = `cat:${category}`;
      return this.searchPapers({ query, ...options });
    } catch (error) {
      this.zotero.debug(`Error searching by category: ${error}`);
      throw error;
    }
  }

  async searchByAuthor(author: string, options?: Partial<ArxivSearchOptions>): Promise<ArxivPaper[]> {
    try {
      // 尝试使用Python服务器
      try {
        const {
          maxResults = 20,
          sortBy = 'relevance',
          sortOrder = 'descending',
          start = 0
        } = options || {};

        const pythonUrl = `${this.PYTHON_API_URL}/search/author?author=${encodeURIComponent(author)}&maxResults=${maxResults}&sortBy=${sortBy}&sortOrder=${sortOrder}&start=${start}`;

        const response = await fetch(pythonUrl, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const papers = await response.json();
          this.zotero.debug(`Successfully fetched papers by author ${author} from Python API`);
          return papers as ArxivPaper[];
        }
      } catch (pythonError) {
        this.zotero.debug(`Python API error: ${pythonError}, falling back to default API`);
      }

      // 回退到默认API
      const query = `au:${author}`;
      return this.searchPapers({ query, ...options });
    } catch (error) {
      this.zotero.debug(`Error searching by author: ${error}`);
      throw error;
    }
  }

  async searchByKeyword(keyword: string, options?: Partial<ArxivSearchOptions>): Promise<ArxivPaper[]> {
    try {
      // 尝试使用Python服务器
      try {
        const {
          maxResults = 20,
          sortBy = 'relevance',
          sortOrder = 'descending',
          start = 0
        } = options || {};

        const pythonUrl = `${this.PYTHON_API_URL}/search/keyword?keyword=${encodeURIComponent(keyword)}&maxResults=${maxResults}&sortBy=${sortBy}&sortOrder=${sortOrder}&start=${start}`;

        const response = await fetch(pythonUrl, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const papers = await response.json();
          this.zotero.debug(`Successfully fetched papers by keyword ${keyword} from Python API`);
          return papers as ArxivPaper[];
        }
      } catch (pythonError) {
        this.zotero.debug(`Python API error: ${pythonError}, falling back to default API`);
      }

      // 回退到默认API
      const query = `all:${keyword}`;
      return this.searchPapers({ query, ...options });
    } catch (error) {
      this.zotero.debug(`Error searching by keyword: ${error}`);
      throw error;
    }
  }

  async getRecentPapers(category: string, days: number = 7): Promise<ArxivPaper[]> {
    try {
      // 尝试使用Python服务器
      try {
        const pythonUrl = `${this.PYTHON_API_URL}/recent?category=${encodeURIComponent(category)}&days=${days}`;

        const response = await fetch(pythonUrl, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const papers = await response.json();
          this.zotero.debug(`Successfully fetched recent papers from category ${category} from Python API`);
          return papers as ArxivPaper[];
        }
      } catch (pythonError) {
        this.zotero.debug(`Python API error: ${pythonError}, falling back to default API`);
      }

      // 回退到默认API
      const date = new Date();
      date.setDate(date.getDate() - days);
      const dateStr = date.toISOString().split('T')[0];

      const query = `cat:${category} AND submittedDate:[${dateStr} TO *]`;
      return this.searchPapers({
        query,
        maxResults: 100,
        sortBy: 'submittedDate',
        sortOrder: 'descending'
      });
    } catch (error) {
      this.zotero.debug(`Error getting recent papers: ${error}`);
      throw error;
    }
  }
}
