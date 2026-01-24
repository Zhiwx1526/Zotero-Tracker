import { LiteratureItem } from './literatureReader';

// 向量类型定义
export interface VectorData {
  id: number;
  literatureId: number;
  vector: number[];
  metadata: any;
  createdAt: Date;
}

/**
 * 向量存储模块
 * 使用Zotero内置的SQLite实现向量的存储和查询
 */
export class VectorStore {
  private dbPath: string;
  private db: any = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * 初始化数据库
   */
  public async initialize(): Promise<void> {
    try {
      const zotero = ztoolkit.getGlobal("Zotero");

      // 使用Zotero.DB直接操作
      this.db = zotero.DB;

      // 创建表结构
      await this.createTables();
    } catch (error) {
      ztoolkit.log(`Error initializing vector store: ${error}`);
      throw error;
    }
  }

  /**
   * 创建设表结构
   */
  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // 创建文献表
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS literature_tracker_literatures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        literature_id INTEGER UNIQUE,
        title TEXT,
        abstract TEXT,
        authors TEXT,
        publication_title TEXT,
        date TEXT,
        doi TEXT,
        url TEXT,
        tags TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 创建向量表
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS literature_tracker_vectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        literature_id INTEGER UNIQUE,
        vector TEXT,  -- 向量以JSON字符串形式存储
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 创建配置表
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS literature_tracker_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 创建索引
    await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_literatures_literature_id ON literature_tracker_literatures(literature_id);
      CREATE INDEX IF NOT EXISTS idx_vectors_literature_id ON literature_tracker_vectors(literature_id);
    `);
  }

  /**
   * 插入文献向量
   * @param literature 文献对象
   * @param vector 向量数据
   */
  public async insertVector(literature: LiteratureItem, vector: number[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const metadata = JSON.stringify({
      authors: literature.authors,
      publicationTitle: literature.publicationTitle,
      date: literature.date,
      doi: literature.doi,
      tags: literature.tags
    });

    // 插入文献数据
    await this.db.execute(
      `
      INSERT OR REPLACE INTO literature_tracker_literatures (
        literature_id, title, abstract, authors, publication_title, date, doi, url, tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        literature.id,
        literature.title,
        literature.abstract,
        JSON.stringify(literature.authors),
        literature.publicationTitle,
        literature.date,
        literature.doi,
        literature.url,
        JSON.stringify(literature.tags),
        metadata
      ]
    );

    // 插入向量数据
    await this.db.execute(
      `
      INSERT OR REPLACE INTO literature_tracker_vectors (literature_id, vector, created_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      `,
      [literature.id, JSON.stringify(vector)]
    );
  }

  /**
   * 批量插入文献向量
   * @param items 文献和向量的数组
   */
  public async batchInsertVectors(items: Array<{
    literature: LiteratureItem;
    vector: number[];
  }>): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // 开始事务
    await this.db.execute('BEGIN TRANSACTION');

    try {
      for (const item of items) {
        await this.insertVector(item.literature, item.vector);
      }
      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      throw error;
    }
  }

  /**
   * 搜索相似向量
   * @param queryVector 查询向量
   * @param limit 返回数量限制
   * @param threshold 相似度阈值
   */
  public async searchSimilarVectors(
    queryVector: number[],
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Array<{
    literatureId: number;
    similarity: number;
    metadata: any;
  }>> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // 获取所有向量
    const vectors = await this.db.queryAsync(
      `
      SELECT 
        v.literature_id,
        v.vector,
        l.metadata
      FROM literature_tracker_vectors v
      JOIN literature_tracker_literatures l ON v.literature_id = l.literature_id
      `
    );

    // 计算相似度
    const results: Array<{
      literatureId: number;
      similarity: number;
      metadata: any;
    }> = [];

    for (const row of vectors) {
      try {
        const vector = JSON.parse(row.vector);
        const similarity = this.cosineSimilarity(queryVector, vector);

        if (similarity >= threshold) {
          results.push({
            literatureId: row.literature_id,
            similarity,
            metadata: JSON.parse(row.metadata)
          });
        }
      } catch (error) {
        ztoolkit.log(`Error processing vector: ${error}`);
      }
    }

    // 按相似度排序并限制返回数量
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  /**
   * 计算余弦相似度
   * @param vec1 向量1
   * @param vec2 向量2
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * 根据文献ID获取向量
   * @param literatureId 文献ID
   */
  public async getVectorByLiteratureId(literatureId: number): Promise<VectorData | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const row = await this.db.queryAsync(
      `
      SELECT 
        v.id,
        v.literature_id,
        v.vector,
        l.metadata,
        v.created_at
      FROM literature_tracker_vectors v
      JOIN literature_tracker_literatures l ON v.literature_id = l.literature_id
      WHERE v.literature_id = ?
      `,
      [literatureId]
    );

    if (!row || row.length === 0) {
      return null;
    }

    const data = row[0];

    return {
      id: data.id,
      literatureId: data.literature_id,
      vector: JSON.parse(data.vector),
      metadata: JSON.parse(data.metadata),
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * 删除文献向量
   * @param literatureId 文献ID
   */
  public async deleteVector(literatureId: number): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.execute(
      'DELETE FROM literature_tracker_vectors WHERE literature_id = ?',
      [literatureId]
    );

    await this.db.execute(
      'DELETE FROM literature_tracker_literatures WHERE literature_id = ?',
      [literatureId]
    );
  }

  /**
   * 清空向量存储
   */
  public async clear(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.execute('DELETE FROM literature_tracker_vectors');
    await this.db.execute('DELETE FROM literature_tracker_literatures');
  }

  /**
   * 获取向量存储的统计信息
   */
  public async getStats(): Promise<{
    totalVectors: number;
    totalLiteratures: number;
  }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const vectorCount = await this.db.queryAsync(
      'SELECT COUNT(*) as count FROM literature_tracker_vectors'
    );

    const literatureCount = await this.db.queryAsync(
      'SELECT COUNT(*) as count FROM literature_tracker_literatures'
    );

    return {
      totalVectors: vectorCount[0].count,
      totalLiteratures: literatureCount[0].count
    };
  }

  /**
   * 设置配置项
   * @param key 配置键
   * @param value 配置值
   */
  public async setConfig(key: string, value: any): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.execute(
      `
      INSERT OR REPLACE INTO literature_tracker_config (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      `,
      [key, JSON.stringify(value)]
    );
  }

  /**
   * 获取配置项
   * @param key 配置键
   * @param defaultValue 默认值
   */
  public async getConfig(key: string, defaultValue: any = null): Promise<any> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const row = await this.db.queryAsync(
      'SELECT value FROM literature_tracker_config WHERE key = ?',
      [key]
    );

    if (!row || row.length === 0) {
      return defaultValue;
    }

    try {
      return JSON.parse(row[0].value);
    } catch {
      return defaultValue;
    }
  }

  /**
   * 关闭数据库连接
   */
  public async close(): Promise<void> {
    // Zotero内置的数据库连接不需要手动关闭
    // 这里可以添加其他清理逻辑
  }
}
