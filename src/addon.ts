import { config } from "../package.json";
import { DialogHelper } from "zotero-plugin-toolkit";
import hooks from "./hooks";
import { createZToolkit } from "./utils/ztoolkit";
import { LiteratureReader } from "./modules/literatureReader";
import { VectorStore } from "./modules/vectorStore";
import { VectorGenerator } from "./modules/vectorGenerator";
import { LiteratureTrackingService } from "./modules/literatureTrackingService";
import { UserProfileManager } from "./modules/userProfile";

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    // Env type, see build.js
    env: "development" | "production";
    initialized?: boolean;
    ztoolkit: ZToolkit;
    locale?: {
      current: any;
    };
    prefs?: {
      window: Window;
    };
    dialog?: DialogHelper;
    literatureReader?: LiteratureReader;
    vectorStore?: VectorStore;
    vectorGenerator?: VectorGenerator;
    literatureTrackingService?: LiteratureTrackingService;
    userProfileManager?: UserProfileManager;
    shortcutKey?: string;
  };
  // Lifecycle hooks
  public hooks: typeof hooks;
  // APIs
  public api: object;

  constructor() {
    this.data = {
      alive: true,
      config,
      env: __env__,
      initialized: false,
      ztoolkit: createZToolkit(),
    };
    this.hooks = hooks;
    this.api = {};
  }

  /**
   * 初始化插件
   */
  public async initialize(): Promise<void> {
    try {
      ztoolkit.log("Initializing Literature Tracker plugin...");

      // 初始化文献读取器
      try {
        this.data.literatureReader = new LiteratureReader();
        ztoolkit.log("Literature reader initialized");
      } catch (error) {
        ztoolkit.log(`Error initializing literature reader: ${error}`);
      }

      // 初始化向量存储
      try {
        const zotero = this.data.ztoolkit.getGlobal("Zotero");
        const dbPath = (zotero as any).ProfD + "/literature-tracker.sqlite";
        this.data.vectorStore = new VectorStore(dbPath);
        await this.data.vectorStore.initialize();
        ztoolkit.log("Vector store initialized");
      } catch (error) {
        ztoolkit.log(`Error initializing vector store: ${error}`);
      }

      // 初始化向量生成器
      try {
        const zotero = this.data.ztoolkit.getGlobal("Zotero");
        const apiKey = zotero.Prefs.get("extensions.zotero.literature-tracker.apiKey") as string | null;
        this.data.vectorGenerator = new VectorGenerator(apiKey);
        ztoolkit.log("Vector generator initialized");
      } catch (error) {
        ztoolkit.log(`Error initializing vector generator: ${error}`);
      }

      // 初始化文献追踪服务
      try {
        const zotero = this.data.ztoolkit.getGlobal("Zotero");
        this.data.literatureTrackingService = new LiteratureTrackingService(zotero as any);
        ztoolkit.log("Literature tracking service initialized");
      } catch (error) {
        ztoolkit.log(`Error initializing literature tracking service: ${error}`);
      }

      // 初始化用户画像管理器
      try {
        if (this.data.vectorStore && this.data.vectorGenerator) {
          this.data.userProfileManager = new UserProfileManager(this.data.vectorStore, this.data.vectorGenerator);
          ztoolkit.log("User profile manager initialized");
        } else {
          ztoolkit.log("Cannot initialize user profile manager: vector store or vector generator not initialized");
        }
      } catch (error) {
        ztoolkit.log(`Error initializing user profile manager: ${error}`);
      }

      // 加载快捷键设置
      try {
        this.loadShortcutKey();
        ztoolkit.log("Shortcut key loaded");
      } catch (error) {
        ztoolkit.log(`Error loading shortcut key: ${error}`);
      }

      // 注册快捷键
      try {
        this.registerShortcut();
        ztoolkit.log("Shortcut key registered");
      } catch (error) {
        ztoolkit.log(`Error registering shortcut key: ${error}`);
      }

      // 检查今日是否已推送
      try {
        await this.checkAndPushTodayPapers();
        ztoolkit.log("Push check completed");
      } catch (error) {
        ztoolkit.log(`Error checking push status: ${error}`);
      }

      // 检查是否所有必要组件都已初始化
      const allComponentsInitialized = !!(this.data.literatureReader &&
        this.data.vectorStore &&
        this.data.vectorGenerator &&
        this.data.literatureTrackingService &&
        this.data.userProfileManager);

      this.data.initialized = allComponentsInitialized;

      if (allComponentsInitialized) {
        ztoolkit.log("Literature Tracker plugin initialized successfully!");
      } else {
        ztoolkit.log("Literature Tracker plugin initialized with some components missing");
      }
    } catch (error) {
      ztoolkit.log(`Error initializing plugin: ${error}`);
      this.data.initialized = false;
    }
  }

  /**
   * 加载快捷键设置
   */
  private loadShortcutKey(): void {
    const shortcutKey = this.data.ztoolkit.getGlobal("Zotero").Prefs.get("extensions.zotero.literature-tracker.shortcutKey") || " ";
    this.data.shortcutKey = shortcutKey as string;
  }

  /**
   * 注册快捷键
   */
  private registerShortcut(): void {
    if (!this.data.shortcutKey) return;

    const zotero = this.data.ztoolkit.getGlobal("Zotero");
    const overlayManager = (zotero as any).OverlayManager;

    if (overlayManager) {
      // 注册快捷键
      overlayManager.add({
        "": [{
          tag: "key",
          attributes: {
            id: "literature-tracker-shortcut",
            key: this.data.shortcutKey,
            oncommand: "Zotero.LiteratureTracker.hooks.onShortcutKey()"
          }
        }]
      });
    }
  }

  /**
   * 生成选中文献的向量
   */
  public async generateSelectedLiteratureVectors(): Promise<void> {
    try {
      ztoolkit.log("Generating vectors for selected literature...");

      // 检查必要的组件是否初始化
      if (!this.data.literatureReader || !this.data.vectorGenerator || !this.data.vectorStore) {
        ztoolkit.log("Required components not initialized");
        return;
      }

      // 获取选中的文献
      const selectedLiterature = await this.data.literatureReader.getSelectedLiterature();

      if (selectedLiterature.length === 0) {
        ztoolkit.log("No literature selected");
        return;
      }

      ztoolkit.log(`Generating vectors for ${selectedLiterature.length} selected items`);

      // 生成向量
      const vectors = await this.data.vectorGenerator.generateVectors(selectedLiterature);

      // 存储向量
      for (const item of vectors) {
        await this.data.vectorStore.insertVector(item.literature, item.vector);
      }

      ztoolkit.log(`Successfully generated and stored vectors for ${vectors.length} items`);

      // 显示通知
      const zotero = this.data.ztoolkit.getGlobal("Zotero");
      // 使用 Zotero 的通知系统
      new ztoolkit.ProgressWindow(addon.data.config.addonName, {
        closeOnClick: true,
        closeTime: -1,
      })
        .createLine({
          text: `Successfully generated vectors for ${vectors.length} items`,
          type: "default",
          progress: 100,
        })
        .show()
        .startCloseTimer(3000);

    } catch (error) {
      ztoolkit.log(`Error generating vectors for selected literature: ${error}`);
    }
  }

  /**
   * 构建用户画像
   */
  public async buildUserProfile(): Promise<void> {
    try {
      ztoolkit.log("Building user profile...");

      // 检查必要的组件是否初始化
      if (!this.data.literatureReader || !this.data.userProfileManager) {
        ztoolkit.log("Required components not initialized");
        return;
      }

      // 获取所有文献
      const allLiterature = await this.data.literatureReader.getAllLiterature();

      if (allLiterature.length === 0) {
        ztoolkit.log("No literature found in library");
        return;
      }

      ztoolkit.log(`Building profile based on ${allLiterature.length} literature items`);

      // 构建用户画像
      const userID = "default"; // 默认为默认用户
      const profile = await this.data.userProfileManager.buildUserProfile(userID, allLiterature);

      ztoolkit.log(`Successfully built user profile with ${profile.coreThemes.length} core themes and ${profile.keywords.length} keywords`);

      // 显示通知
      new ztoolkit.ProgressWindow(addon.data.config.addonName, {
        closeOnClick: true,
        closeTime: -1,
      })
        .createLine({
          text: `Successfully built user profile with ${profile.coreThemes.length} core themes`,
          type: "default",
          progress: 100,
        })
        .show()
        .startCloseTimer(3000);

    } catch (error) {
      ztoolkit.log(`Error building user profile: ${error}`);
    }
  }

  /**
   * 更新用户画像
   */
  public async updateUserProfile(): Promise<void> {
    try {
      ztoolkit.log("Updating user profile...");

      // 检查必要的组件是否初始化
      if (!this.data.literatureReader || !this.data.userProfileManager) {
        ztoolkit.log("Required components not initialized");
        return;
      }

      // 获取所有文献
      const allLiterature = await this.data.literatureReader.getAllLiterature();

      if (allLiterature.length === 0) {
        ztoolkit.log("No literature found in library");
        return;
      }

      ztoolkit.log(`Updating profile based on ${allLiterature.length} literature items`);

      // 更新用户画像
      const userID = "default"; // 默认为默认用户
      const profile = await this.data.userProfileManager.rebuildUserProfile(userID, allLiterature);

      ztoolkit.log(`Successfully updated user profile with ${profile.coreThemes.length} core themes and ${profile.keywords.length} keywords`);

      // 显示通知
      new ztoolkit.ProgressWindow(addon.data.config.addonName, {
        closeOnClick: true,
        closeTime: -1,
      })
        .createLine({
          text: `Successfully updated user profile with ${profile.coreThemes.length} core themes`,
          type: "default",
          progress: 100,
        })
        .show()
        .startCloseTimer(3000);

    } catch (error) {
      ztoolkit.log(`Error updating user profile: ${error}`);
    }
  }

  /**
   * 获取用户画像
   */
  public async getUserProfile(): Promise<any> {
    try {
      ztoolkit.log("Getting user profile...");

      // 检查必要的组件是否初始化
      if (!this.data.userProfileManager) {
        ztoolkit.log("User profile manager not initialized");
        return null;
      }

      // 获取用户画像
      const userID = "default"; // 默认为默认用户
      const profile = await this.data.userProfileManager.getUserProfile(userID);

      if (profile) {
        ztoolkit.log(`Retrieved user profile with ${profile.coreThemes.length} core themes`);
      } else {
        ztoolkit.log("No user profile found");
      }

      return profile;
    } catch (error) {
      ztoolkit.log(`Error getting user profile: ${error}`);
      return null;
    }
  }

  /**
   * 检查今日是否已推送并执行推送
   */
  public async checkAndPushTodayPapers(): Promise<void> {
    try {
      // 检查所有必要的组件是否初始化
      if (!this.data.literatureTrackingService || !this.data.vectorStore || !this.data.userProfileManager || !this.data.vectorGenerator || !this.data.literatureReader) {
        ztoolkit.log("Required components not initialized, skipping push check");
        return;
      }

      const lastPushDate = await this.data.vectorStore.getLastPushDate();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 检查是否今日已推送
      if (!lastPushDate || lastPushDate < today) {
        ztoolkit.log("Today's papers not pushed yet, starting push process...");
        await this.fetchAndPushTodayPapers();
      } else {
        ztoolkit.log("Today's papers already pushed, skipping...");
      }
    } catch (error) {
      ztoolkit.log(`Error checking push status: ${error}`);
    }
  }

  /**
   * 获取并推送今日文献
   */
  public async fetchAndPushTodayPapers(): Promise<number> {
    try {
      ztoolkit.log("Fetching and pushing today's papers...");

      // 检查必要的组件是否初始化
      const uninitializedComponents: string[] = [];
      if (!this.data.literatureTrackingService) uninitializedComponents.push("Literature Tracking Service");
      if (!this.data.vectorStore) uninitializedComponents.push("Vector Store");
      if (!this.data.userProfileManager) uninitializedComponents.push("User Profile Manager");
      if (!this.data.vectorGenerator) uninitializedComponents.push("Vector Generator");
      if (!this.data.literatureReader) uninitializedComponents.push("Literature Reader");

      if (uninitializedComponents.length > 0) {
        const errorMessage = `插件组件未初始化: ${uninitializedComponents.join(", ")}，请重启Zotero`;
        ztoolkit.log(`Required components not initialized: ${uninitializedComponents.join(", ")}`);
        // 显示通知
        new ztoolkit.ProgressWindow(this.data.config.addonName, {
          closeOnClick: true,
          closeTime: -1,
        })
          .createLine({
            text: errorMessage,
            type: "error",
            progress: 100,
          })
          .show()
          .startCloseTimer(5000);
        return 0;
      }

      // 1. 获取今日新增文献
      const papers = await this.data.literatureTrackingService.fetchTodayPapers();
      if (papers.length === 0) {
        ztoolkit.log("No new papers found today");
        // 显示通知
        new ztoolkit.ProgressWindow(this.data.config.addonName, {
          closeOnClick: true,
          closeTime: -1,
        })
          .createLine({
            text: "今日没有发现新文献",
            type: "default",
            progress: 100,
          })
          .show()
          .startCloseTimer(5000);
        // 更新推送状态
        await this.data.vectorStore.setLastPushDate(new Date());
        return 0;
      }

      // 2. 基于关键词初步筛选
      const keywordFilteredPapers = await this.filterPapersByKeywords(papers);
      if (keywordFilteredPapers.length === 0) {
        ztoolkit.log("No papers matched keywords");
        // 显示通知
        new ztoolkit.ProgressWindow(this.data.config.addonName, {
          closeOnClick: true,
          closeTime: -1,
        })
          .createLine({
            text: "没有找到与您兴趣相关的文献",
            type: "default",
            progress: 100,
          })
          .show()
          .startCloseTimer(5000);
        // 更新推送状态
        await this.data.vectorStore.setLastPushDate(new Date());
        return 0;
      }

      // 3. 计算相关度
      const relevanceResults = await this.calculateRelevance(keywordFilteredPapers);

      // 4. 筛选相关文献
      const relevantPapers = await this.filterRelevantPapers(relevanceResults);

      // 5. 推送文献
      await this.pushPapers(relevantPapers);

      // 6. 更新推送状态
      await this.data.vectorStore.setLastPushDate(new Date());

      ztoolkit.log(`Successfully pushed ${relevantPapers.length} relevant papers`);
      return relevantPapers.length;
    } catch (error) {
      ztoolkit.log(`Error fetching and pushing papers: ${error}`);
      // 显示错误通知
      new ztoolkit.ProgressWindow(this.data.config.addonName, {
        closeOnClick: true,
        closeTime: -1,
      })
        .createLine({
          text: `推送失败: ${error}`,
          type: "error",
          progress: 100,
        })
        .show()
        .startCloseTimer(5000);
      return 0;
    }
  }

  /**
   * 基于关键词筛选文献
   */
  private async filterPapersByKeywords(papers: any[]): Promise<any[]> {
    // 获取用户画像
    const userProfile = await this.data.userProfileManager?.getUserProfile("default");
    if (!userProfile) {
      ztoolkit.log("User profile not found, skipping keyword filtering");
      return papers;
    }

    // 提取高频关键词
    const keywords = userProfile.keywords
      .filter((item: any) => item.weight >= 3) // 只使用权重较高的关键词
      .map((item: any) => item.keyword)
      .slice(0, 10); // 取前10个关键词

    if (keywords.length === 0) {
      ztoolkit.log("No keywords found in user profile, skipping keyword filtering");
      return papers;
    }

    // 筛选包含关键词的文献
    const filteredPapers = papers.filter((paper: any) => {
      const text = `${paper.title} ${paper.summary}`.toLowerCase();
      return keywords.some((keyword: string) => text.includes(keyword.toLowerCase()));
    });

    ztoolkit.log(`Filtered papers by keywords: ${filteredPapers.length} out of ${papers.length}`);
    return filteredPapers;
  }

  /**
   * 计算文献与用户兴趣的相关度
   */
  private async calculateRelevance(papers: any[]): Promise<Array<{ paper: any; relevance: number }>> {
    // 获取用户画像
    const userProfile = await this.data.userProfileManager?.getUserProfile("default");
    if (!userProfile) {
      ztoolkit.log("User profile not found, assigning default relevance");
      // 当用户画像不存在时，为所有文献分配默认相关度
      return papers.map(paper => ({
        paper,
        relevance: 0.5 // 默认相关度
      }));
    }

    const results: Array<{ paper: any; relevance: number }> = [];

    // 批量生成向量
    const literatureItems = papers.map((paper: any) => ({
      id: paper.id,
      title: paper.title,
      abstract: paper.summary,
      authors: paper.authors,
      publicationTitle: "arXiv",
      date: paper.published,
      doi: paper.doi,
      url: paper.pdf_url,
      tags: []
    }));

    const vectors = await this.data.vectorGenerator?.generateVectors(literatureItems);
    if (!vectors) {
      ztoolkit.log("Failed to generate vectors, assigning default relevance");
      // 当向量生成失败时，为所有文献分配默认相关度
      return papers.map(paper => ({
        paper,
        relevance: 0.5 // 默认相关度
      }));
    }

    // 计算相关度
    for (let i = 0; i < papers.length; i++) {
      const vector = vectors[i].vector;
      const relevance = this.cosineSimilarity(userProfile.interestVector, vector);
      results.push({ paper: papers[i], relevance });
    }

    // 按相关度排序
    results.sort((a, b) => b.relevance - a.relevance);

    return results;
  }

  /**
   * 筛选相关文献
   */
  private async filterRelevantPapers(relevanceResults: Array<{ paper: any; relevance: number }>): Promise<any[]> {
    const threshold = 0.5;
    const maxPapers = 5;

    // 过滤出相关度高的文献
    const filtered = relevanceResults
      .filter(item => item.relevance >= threshold)
      .slice(0, maxPapers)
      .map(item => item.paper);

    // 过滤掉用户已有的文献
    let finalPapers = filtered;
    if (this.data.literatureReader) {
      const existingLiterature = await this.data.literatureReader.getAllLiterature();
      const existingDOIs = new Set(existingLiterature.map((item: any) => item.doi).filter(Boolean));

      finalPapers = filtered.filter((paper: any) => !existingDOIs.has(paper.doi));
    }

    // 如果没有相关文献，显示通知
    if (finalPapers.length === 0) {
      ztoolkit.log("No relevant papers found after filtering");
      // 显示通知
      new ztoolkit.ProgressWindow(this.data.config.addonName, {
        closeOnClick: true,
        closeTime: -1,
      })
        .createLine({
          text: "没有找到与您兴趣高度相关的文献",
          type: "default",
          progress: 100,
        })
        .show()
        .startCloseTimer(5000);
    }

    return finalPapers;
  }

  /**
   * 推送文献
   */
  private async pushPapers(papers: any[]) {
    if (papers.length === 0) {
      return;
    }

    // 创建通知
    const notification = new ztoolkit.ProgressWindow(this.data.config.addonName, {
      closeOnClick: true,
      closeTime: -1,
    });

    notification.createLine({
      text: `发现 ${papers.length} 篇您可能感兴趣的新文献`,
      type: "default",
      progress: 100,
    });

    // 添加每篇文献的信息
    for (const paper of papers) {
      notification.createLine({
        text: `${paper.title} - ${paper.authors.join(", ")}`,
        type: "default",
        progress: 100,
      });
    }

    notification.show().startCloseTimer(10000);
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error("Vectors must have the same length");
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
   * 卸载插件
   */
  public async unload(): Promise<void> {
    try {
      ztoolkit.log("Unloading Literature Tracker plugin...");

      this.data.alive = false;
      ztoolkit.log("Literature Tracker plugin unloaded successfully!");
    } catch (error) {
      ztoolkit.log(`Error unloading plugin: ${error}`);
    }
  }
}

export default Addon;
