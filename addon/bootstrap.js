/**
 * Most of this code is from Zotero team's official Make It Red example[1]
 * or the Zotero 7 documentation[2].
 * [1] https://github.com/zotero/make-it-red
 * [2] https://www.zotero.org/support/dev/zotero_7_for_developers
 */

var chromeHandle;

function install(data, reason) { }

async function startup({ id, version, resourceURI, rootURI }, reason) {
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "__addonRef__", rootURI + "content/"],
  ]);

  /**
   * Global variables for plugin code.
   * The `_globalThis` is the global root variable of the plugin sandbox environment
   * and all child variables assigned to it is globally accessible.
   * See `src/index.ts` for details.
   */
  const ctx = { rootURI };
  ctx._globalThis = ctx;

  Services.scriptloader.loadSubScript(
    `${rootURI}/content/scripts/__addonRef__.js`,
    ctx,
  );

  // 直接向错误控制台输出信息
  function log(message) {
    try {
      // 方式1：Components.utils.reportError
      Components.utils.reportError(`Literature Tracker: ${message}`);

      // 方式2：Zotero.debug
      if (typeof Zotero !== 'undefined' && Zotero.debug) {
        Zotero.debug(`Literature Tracker: ${message}`);
      }

      // 方式3：console.log (如果可用)
      if (typeof console !== 'undefined' && console.log) {
        console.log(`Literature Tracker: ${message}`);
      }
    } catch (e) {
      // 忽略日志错误
    }
  }

  // 添加调试日志
  log("Starting up...");
  log(`Plugin ID: ${id}`);
  log(`Root URI: ${rootURI}`);
  log(`Zotero object available: ${typeof Zotero !== 'undefined'}`);

  if (typeof Zotero !== 'undefined') {
    log(`Zotero version: ${Zotero.version}`);
    log(`Zotero.PreferencePanes available: ${typeof Zotero.PreferencePanes !== 'undefined'}`);

    if (typeof Zotero.PreferencePanes !== 'undefined') {
      log(`Zotero.PreferencePanes methods: ${Object.keys(Zotero.PreferencePanes)}`);

      // 注册首选项面板（使用更明确的方式）
      try {
        log("Registering preference pane...");

        // 准备面板信息
        const paneInfo = {
          pluginID: id,
          src: "chrome://literature-tracker/content/preferences.xhtml",
          label: "Literature Tracker",
          icon: "chrome://literature-tracker/content/icons/favicon.png"
        };

        log(`Registering with info: ${JSON.stringify(paneInfo)}`);

        // 尝试注册
        Zotero.PreferencePanes.register(paneInfo);
        log("Preference pane registered successfully");

        // 检查pluginPanes
        if (Zotero.PreferencePanes.pluginPanes) {
          log(`Plugin panes count after register: ${Object.keys(Zotero.PreferencePanes.pluginPanes).length}`);
          log(`Plugin panes after register: ${JSON.stringify(Object.keys(Zotero.PreferencePanes.pluginPanes))}`);
        }

        // 尝试手动添加到pluginPanes
        if (Zotero.PreferencePanes.pluginPanes && Object.keys(Zotero.PreferencePanes.pluginPanes).length === 0) {
          log("Attempting to manually add pane to pluginPanes...");
          try {
            // 使用插件ID作为键
            Zotero.PreferencePanes.pluginPanes[id] = paneInfo;
            log(`Manually added pane to pluginPanes`);
            log(`Plugin panes count after manual add: ${Object.keys(Zotero.PreferencePanes.pluginPanes).length}`);
          } catch (e) {
            log(`Error adding manually: ${e.message}`);
          }
        }

        // 刷新首选项
        if (Zotero.PreferencePanes._refreshPreferences) {
          log("Refreshing preferences...");
          Zotero.PreferencePanes._refreshPreferences();
          log("Preferences refreshed");
        }

        // 尝试创建一个直接访问设置的菜单项
        log("Adding menu item for settings...");
        try {
          if (typeof Zotero.MenuItems !== 'undefined') {
            Zotero.MenuItems.register({
              id: 'literature-tracker-settings',
              label: 'Literature Tracker Settings',
              tooltiptext: 'Open Literature Tracker settings',
              onClick: function () {
                // 直接打开设置窗口
                window.open(
                  'chrome://literature-tracker/content/preferences.xhtml',
                  'literature-tracker-preferences',
                  'chrome,centerscreen,width=800,height=600'
                );
              },
              parent: 'menu_Tools',
              insertAfter: 'menu_tools_addons'
            });
            log("Menu item added successfully");
          } else {
            log("Zotero.MenuItems not available");
          }
        } catch (e) {
          log(`Error adding menu item: ${e.message}`);
        }

      } catch (e) {
        log(`Error registering preference pane: ${e.message}`);
        if (e.stack) {
          log(`Error stack: ${e.stack}`);
        }
      }
    } else {
      log("Zotero.PreferencePanes not available");
    }

    // 注册数字"0"键快捷键，用于打开设置窗口
    log("Registering shortcut key '0' for settings...");
    try {
      if (typeof Zotero.OverlayManager !== 'undefined') {
        Zotero.OverlayManager.add({
          "": [{
            tag: "key",
            attributes: {
              id: "literature-tracker-settings-key",
              key: "0",
              oncommand: "Zotero.LiteratureTracker.hooks.openSettingsWindow()"
            }
          }]
        });
        log("Shortcut key '0' registered successfully");
      } else if (typeof Zotero.getMainWindows !== 'undefined') {
        // 备用方案：为每个主窗口添加键盘监听器
        const mainWindows = Zotero.getMainWindows();
        log(`Found ${mainWindows.length} main windows`);

        mainWindows.forEach(function (win) {
          try {
            win.addEventListener('keypress', function (event) {
              // 检查是否按了数字"0"键
              if (event.key === '0' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
                // 直接打开设置窗口
                win.open(
                  'chrome://literature-tracker/content/preferences.xhtml',
                  'literature-tracker-preferences',
                  'chrome,centerscreen,width=800,height=600'
                );
              }
            }, false);
            log("Added keypress listener to main window");
          } catch (e) {
            log(`Error adding keypress listener: ${e.message}`);
          }
        });
      }
    } catch (e) {
      log(`Error registering shortcut key: ${e.message}`);
      if (e.stack) {
        log(`Error stack: ${e.stack}`);
      }
    }
  }

  try {
    if (typeof Zotero !== 'undefined' && Zotero.__addonInstance__ && Zotero.__addonInstance__.hooks) {
      await Zotero.__addonInstance__.hooks.onStartup();
      log("onStartup completed successfully");
    } else {
      log("Zotero.__addonInstance__ or hooks not available");
    }
  } catch (e) {
    log(`Error in onStartup: ${e.message}`);
    if (e.stack) {
      log(`Error stack: ${e.stack}`);
    }
  }
}

async function onMainWindowLoad({ window }, reason) {
  try {
    if (typeof Zotero !== 'undefined' && Zotero.__addonInstance__ && Zotero.__addonInstance__.hooks) {
      await Zotero.__addonInstance__.hooks.onMainWindowLoad(window);
    }

    // 为新窗口添加键盘监听器
    try {
      window.addEventListener('keypress', function (event) {
        // 检查是否按了数字"0"键
        if (event.key === '0' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
          // 直接打开设置窗口
          window.open(
            'chrome://literature-tracker/content/preferences.xhtml',
            'literature-tracker-preferences',
            'chrome,centerscreen,width=800,height=600'
          );
        }
      }, false);
    } catch (e) {
      // 忽略错误
    }
  } catch (e) {
    try {
      Components.utils.reportError(`Literature Tracker ERROR in onMainWindowLoad: ${e.message}`);
    } catch (ignore) { }
  }
}

async function onMainWindowUnload({ window }, reason) {
  try {
    if (typeof Zotero !== 'undefined' && Zotero.__addonInstance__ && Zotero.__addonInstance__.hooks) {
      await Zotero.__addonInstance__.hooks.onMainWindowUnload(window);
    }
  } catch (e) {
    try {
      Components.utils.reportError(`Literature Tracker ERROR in onMainWindowUnload: ${e.message}`);
    } catch (ignore) { }
  }
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  try {
    if (typeof Zotero !== 'undefined' && Zotero.__addonInstance__ && Zotero.__addonInstance__.hooks) {
      await Zotero.__addonInstance__.hooks.onShutdown();
    }
  } catch (e) {
    try {
      Components.utils.reportError(`Literature Tracker ERROR in shutdown: ${e.message}`);
    } catch (ignore) { }
  }

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

async function uninstall(data, reason) { }
