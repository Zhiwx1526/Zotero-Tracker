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
      this.data.literatureReader = new LiteratureReader();

      // 初始化向量存储
      const zotero = this.data.ztoolkit.getGlobal("Zotero");
      const dbPath = (zotero as any).ProfD + "/literature-tracker.sqlite";
      this.data.vectorStore = new VectorStore(dbPath);
      await this.data.vectorStore.initialize();

      // 初始化向量生成器
      const apiKey = zotero.Prefs.get("extensions.zotero.literature-tracker.apiKey") as string | null;
      this.data.vectorGenerator = new VectorGenerator(apiKey);

      // 初始化文献追踪服务
      this.data.literatureTrackingService = new LiteratureTrackingService(zotero as any);

      // 初始化用户画像管理器
      this.data.userProfileManager = new UserProfileManager(this.data.vectorStore!, this.data.vectorGenerator!);

      // 加载快捷键设置
      this.loadShortcutKey();

      // 注册快捷键
      this.registerShortcut();

      this.data.initialized = true;
      ztoolkit.log("Literature Tracker plugin initialized successfully!");
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
