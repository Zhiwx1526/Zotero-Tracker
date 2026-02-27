import { LiteratureItem } from './literatureReader';

/**
 * OpenAI API 响应类型
 */
interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}

/**
 * 向量生成模块
 * 用于将文献转换为向量表示
 */
export class VectorGenerator {
  private apiKey: string | null = null;
  private apiEndpoint: string = 'https://api.openai.com/v1/embeddings';
  private model: string = 'text-embedding-3-small';

  /**
   * 初始化向量生成器
   * @param apiKey API密钥
   */
  constructor(apiKey: string | null = null) {
    this.apiKey = apiKey;
  }

  /**
   * 设置API配置
   * @param apiKey API密钥
   * @param apiEndpoint API端点
   * @param model 模型名称
   */
  public setApiConfig(apiKey: string | null, apiEndpoint: string = 'https://api.openai.com/v1/embeddings', model: string = 'text-embedding-3-small') {
    this.apiKey = apiKey;
    this.apiEndpoint = apiEndpoint;
    this.model = model;
  }

  /**
   * 生成文献向量
   * @param literature 文献对象
   * @returns 向量数组
   */
  public async generateVector(literature: LiteratureItem): Promise<number[]> {
    try {
      // 构建用于生成向量的文本
      const text = this.buildVectorText(literature);

      // 使用OpenAI API生成向量
      if (this.apiKey) {
        return this.generateVectorWithApi(text);
      } else {
        // 使用本地方法生成简单向量（仅用于测试）
        return this.generateDummyVector(text);
      }
    } catch (error) {
      ztoolkit.log(`Error generating vector: ${error}`);
      // 返回空向量作为 fallback
      return this.generateDummyVector('');
    }
  }

  /**
   * 批量生成文献向量
   * @param literatures 文献对象数组
   * @returns 向量数组
   */
  public async generateVectors(literatures: LiteratureItem[]): Promise<Array<{ literature: LiteratureItem; vector: number[] }>> {
    const results: Array<{ literature: LiteratureItem; vector: number[] }> = [];

    for (const literature of literatures) {
      try {
        const vector = await this.generateVector(literature);
        results.push({ literature, vector });
      } catch (error) {
        ztoolkit.log(`Error generating vector for literature ${literature.id}: ${error}`);
        // 为失败的文献生成一个空向量
        results.push({ literature, vector: this.generateDummyVector('') });
      }
    }

    return results;
  }

  /**
   * 构建用于生成向量的文本
   * @param literature 文献对象
   * @returns 组合文本
   */
  private buildVectorText(literature: LiteratureItem): string {
    let text = `${literature.title}\n`;
    if (literature.abstract) {
      text += `${literature.abstract}\n`;
    }
    if (literature.authors && literature.authors.length > 0) {
      text += `Authors: ${literature.authors.join(', ')}\n`;
    }
    if (literature.publicationTitle) {
      text += `Publication: ${literature.publicationTitle}\n`;
    }
    if (literature.tags && literature.tags.length > 0) {
      text += `Tags: ${literature.tags.join(', ')}\n`;
    }
    return text;
  }

  /**
   * 使用API生成向量
   * @param text 文本
   * @returns 向量数组
   */
  private async generateVectorWithApi(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('API key not set');
    }

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json() as unknown as EmbeddingResponse;
    return data.data[0].embedding;
  }

  /**
   * 生成简单的测试向量（仅用于开发和测试）
   * @param text 文本
   * @returns 向量数组
   */
  private generateDummyVector(text: string): number[] {
    // 生成一个固定长度的简单向量
    const vectorLength = 1536; // 与 text-embedding-3-small 模型的向量长度匹配
    const vector: number[] = [];

    // 基于文本内容生成一些简单的特征
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }

    // 生成伪随机向量
    for (let i = 0; i < vectorLength; i++) {
      // 使用简单的哈希函数生成值
      const value = Math.sin(i + hash) * 0.5 + 0.5;
      vector.push(value);
    }

    return vector;
  }
}
