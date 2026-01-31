import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  // 初始化插件
  await addon.initialize();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: -1,
  })
    .createLine({
      text: getString("startup-begin"),
      type: "default",
      progress: 0,
    })
    .show();

  await Zotero.Promise.delay(500);

  popupWin.changeLine({
    progress: 100,
    text: `[100%] ${getString("startup-finish")}`,
  });
  popupWin.startCloseTimer(2000);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
}

async function onShutdown(): Promise<void> {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();

  // 卸载插件
  await addon.unload();

  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * This function is just an example of dispatcher for Notify events.
 * Any operations should be placed in a function to keep this funcion clear.
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  // You can add your code to the corresponding notify type
  ztoolkit.log("notify", event, type, ids, extraData);
}

/**
 * This function is just an example of dispatcher for Preference UI events.
 * Any operations should be placed in a function to keep this funcion clear.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

/**
 * 处理快捷键事件
 */
function onShortcutKey() {
  ztoolkit.log("Shortcut key pressed!");
  // 这里可以添加快捷键触发的逻辑
  // 例如：手动触发文献追踪和推送
  addon.hooks.triggerLiteratureTracking();
}

/**
 * 打开设置窗口
 */
function openSettingsWindow() {
  ztoolkit.log("Opening settings window...");
  try {
    // 直接打开设置窗口
    const win = Zotero.getMainWindow().open(
      "chrome://literature-tracker/content/preferences.xhtml",
      "literature-tracker-preferences",
      "chrome,centerscreen,width=800,height=600"
    );
    if (win) {
      ztoolkit.log("Settings window opened successfully");
    } else {
      ztoolkit.log("Failed to open settings window");
    }
  } catch (error) {
    ztoolkit.log(`Error opening settings window: ${error}`);
  }
}

/**
 * 触发文献追踪
 */
async function triggerLiteratureTracking() {
  try {
    const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
      closeOnClick: true,
      closeTime: -1,
    })
      .createLine({
        text: "开始追踪arXiv文献...",
        type: "default",
        progress: 0,
      })
      .show();

    // 使用文献追踪服务获取文献
    if (addon.data.literatureTrackingService) {
      await Zotero.Promise.delay(500);
      
      popupWin.changeLine({
        progress: 30,
        text: "正在从arXiv获取最新文献...",
      });

      const papers = await addon.data.literatureTrackingService.fetchRecentPapers(7);
      
      await Zotero.Promise.delay(500);
      
      popupWin.changeLine({
        progress: 70,
        text: `找到 ${papers.length} 篇新文献`,
      });

      await Zotero.Promise.delay(500);

      popupWin.changeLine({
        progress: 100,
        text: `文献追踪完成！共获取 ${papers.length} 篇文献`,
      });
      
      ztoolkit.log(`Fetched ${papers.length} papers from arXiv`);
      
      // 可以在这里添加将文献保存到Zotero的逻辑
      // 或者显示文献列表供用户选择
    } else {
      throw new Error("Literature tracking service not initialized");
    }

    popupWin.startCloseTimer(3000);
  } catch (error) {
    ztoolkit.log(`Error triggering literature tracking: ${error}`);
    new ztoolkit.ProgressWindow(addon.data.config.addonName, {
      closeOnClick: true,
      closeTime: -1,
    })
      .createLine({
        text: `追踪失败: ${error}`,
        type: "error",
        progress: 100,
      })
      .show()
      .startCloseTimer(3000);
  }
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcutKey,
  openSettingsWindow,
  triggerLiteratureTracking,
};
