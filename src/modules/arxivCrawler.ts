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
  private readonly API_BASE_URL = 'http://export.arxiv.org/api/query';

  constructor(private zotero: any) { }

  async searchPapers(options: ArxivSearchOptions): Promise<ArxivPaper[]> {
    const {
      query,
      maxResults = 20,
      sortBy = 'relevance',
      sortOrder = 'descending',
      start = 0
    } = options;

    try {
      const url = this.buildSearchUrl(query, maxResults, sortBy, sortOrder, start);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const xmlText = await response.text();
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
    const query = `id:${arxivId}`;
    const papers = await this.searchPapers({ query, maxResults: 1 });
    return papers.length > 0 ? papers[0] : null;
  }

  async searchByCategory(
    category: string,
    options?: Partial<ArxivSearchOptions>
  ): Promise<ArxivPaper[]> {
    const query = `cat:${category}`;
    return this.searchPapers({ query, ...options });
  }

  async searchByAuthor(author: string, options?: Partial<ArxivSearchOptions>): Promise<ArxivPaper[]> {
    const query = `au:${author}`;
    return this.searchPapers({ query, ...options });
  }

  async searchByKeyword(keyword: string, options?: Partial<ArxivSearchOptions>): Promise<ArxivPaper[]> {
    const query = `all:${keyword}`;
    return this.searchPapers({ query, ...options });
  }

  async getRecentPapers(category: string, days: number = 7): Promise<ArxivPaper[]> {
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
  }
}
