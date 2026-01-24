import { config } from "../package.json";
import { DialogHelper } from "zotero-plugin-toolkit";
import hooks from "./hooks";
import { createZToolkit } from "./utils/ztoolkit";
import { LiteratureReader } from "./modules/literatureReader";
import { VectorStore } from "./modules/vectorStore";

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
