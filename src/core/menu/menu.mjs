/**
 * notion-enhancer
 * (c) 2023 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://notion-enhancer.github.io/) under the MIT license
 */

import { getState, setState, useState } from "./state.mjs";
import {
  Sidebar,
  SidebarSection,
  SidebarButton,
  Footer,
  View,
  List,
  Mod,
  Button,
  Option,
} from "./components.mjs";

const compatibleMods = (mods) => {
  const { platform } = globalThis.__enhancerApi;
  return mods.filter((mod) => {
    const required =
        mod.id &&
        mod.name &&
        mod.version &&
        mod.description &&
        mod.thumbnail &&
        mod.authors,
      compatible = !mod.platforms || mod.platforms.includes(platform);
    return required && compatible;
  });
};

const renderSidebar = (items, categories) => {
    const { html, isEnabled } = globalThis.__enhancerApi,
      $sidebar = html`<${Sidebar}>
        ${items.map((item) => {
          if (typeof item === "object") {
            const { title, ...props } = item;
            return html`<${SidebarButton} ...${props}>${title}<//>`;
          } else return html`<${SidebarSection}>${item}<//>`;
        })}
      <//>`;
    for (const { title, mods } of categories) {
      const $title = html`<${SidebarSection}>${title}<//>`,
        $mods = mods.map((mod) => [
          mod.id,
          html`<${SidebarButton} id=${mod.id}>${mod.name}<//>`,
        ]);
      $sidebar.append($title, ...$mods.map(([, $btn]) => $btn));
      useState(["rerender"], async () => {
        let sectionVisible = false;
        for (const [id, $btn] of $mods) {
          if (await isEnabled(id)) {
            $btn.style.display = "";
            sectionVisible = true;
          } else $btn.style.display = "none";
        }
        $title.style.display = sectionVisible ? "" : "none";
      });
    }
    return $sidebar;
  },
  renderList = async (id, mods, description) => {
    const { html, getProfile, initDatabase } = globalThis.__enhancerApi,
      enabledMods = initDatabase([await getProfile(), "enabledMods"]);
    mods = mods.map(async (mod) => {
      const _get = () => enabledMods.get(mod.id),
        _set = async (enabled) => {
          await enabledMods.set(mod.id, enabled);
          setState({ rerender: true, databaseUpdated: true });
        };
      return html`<${Mod} ...${{ ...mod, _get, _set }} />`;
    });
    return html`<${List} ...${{ id, description }}>
      ${await Promise.all(mods)}
    <//>`;
  },
  renderOptions = async (mod) => {
    const { html, platform, getProfile } = globalThis.__enhancerApi,
      { optionDefaults, initDatabase } = globalThis.__enhancerApi,
      profile = await getProfile();
    const db = initDatabase([profile, mod.id], await optionDefaults(mod.id));
    let options = mod.options.reduce((options, opt, i) => {
      if (!opt.key && (opt.type !== "heading" || !opt.label)) return options;
      if (opt.platforms && !opt.platforms.includes(platform)) return options;
      const prevOpt = options[options.length - 1];
      // no consective headings
      if (opt.type === "heading" && prevOpt?.type === opt.type) {
        options[options.length - 1] = opt;
      } else options.push(opt);
      return options;
    }, []);
    // no empty/end headings e.g. if section is platform-specific
    if (options[options.length - 1]?.type === "heading") options.pop();
    options = options.map(async (opt) => {
      if (opt.type === "heading") return html`<${Option} ...${opt} />`;
      const _get = () => db.get(opt.key),
        _set = async (value) => {
          await db.set(opt.key, value);
          setState({ rerender: true, databaseUpdated: true });
        };
      return html`<${Option} ...${{ ...opt, _get, _set }} />`;
    });
    return Promise.all(options);
  },
  renderMods = async (category, mods) => {
    const { html, getProfile, initDatabase } = globalThis.__enhancerApi,
      enabledMods = initDatabase([await getProfile(), "enabledMods"]);
    mods = mods
      .filter((mod) => {
        return mod.options?.filter((opt) => opt.type !== "heading").length;
      })
      .map(async (mod) => {
        const _get = () => enabledMods.get(mod.id),
          _set = async (enabled) => {
            await enabledMods.set(mod.id, enabled);
            setState({ rerender: true, databaseUpdated: true });
          };
        return html`<${View} id=${mod.id}>
          <${Mod} ...${{ ...mod, options: [], _get, _set }} />
          ${await renderOptions(mod)}
        <//>`;
      });
    return Promise.all(mods);
  };

const render = async () => {
  const { html, reloadApp, getCore } = globalThis.__enhancerApi,
    { getThemes, getExtensions, getIntegrations } = globalThis.__enhancerApi,
    [icon, renderStarted] = getState(["icon", "renderStarted"]);
  if (!html || !getCore || !icon || renderStarted) return;
  setState({ renderStarted: true });

  const categories = [
      {
        icon: "palette",
        id: "themes",
        title: "Themes",
        description: `Themes override Notion's colour schemes. To switch between
        dark mode and light mode, go to <mark>Settings & members → My notifications
        & settings → My settings → Appearance</mark>.`,
        mods: compatibleMods(await getThemes()),
      },
      {
        icon: "zap",
        id: "extensions",
        title: "Extensions",
        description: `Extensions add to the functionality and layout of the Notion
        client, interacting with and modifying existing interfaces.`,
        mods: compatibleMods(await getExtensions()),
      },
      {
        icon: "plug",
        id: "integrations",
        title: "Integrations",
        description: `<span class="text-[color:var(--theme--fg-red)]">
        Integrations access and modify Notion content. They interact directly with
        <mark>https://www.notion.so/api/v3</mark>. Use at your own risk.</span>`,
        mods: compatibleMods(await getIntegrations()),
      },
    ],
    sidebar = [
      "notion-enhancer",
      {
        id: "welcome",
        title: "Welcome",
        icon: `notion-enhancer${icon === "Monochrome" ? "?mask" : ""}`,
      },
      {
        icon: "message-circle",
        title: "Community",
        href: "https://discord.gg/sFWPXtA",
      },
      {
        icon: "clock",
        title: "Changelog",
        href: "https://notion-enhancer.github.io/about/changelog/",
      },
      {
        icon: "book",
        title: "Documentation",
        href: "https://notion-enhancer.github.io/",
      },
      {
        icon: "github",
        title: "Source Code",
        href: "https://github.com/notion-enhancer",
      },
      {
        icon: "coffee",
        title: "Sponsor",
        href: "https://github.com/sponsors/dragonwocky",
      },
      "Settings",
      {
        id: "core",
        title: "Core",
        icon: "sliders-horizontal",
      },
      ...categories.map((c) => ({ id: c.id, title: c.title, icon: c.icon })),
    ];

  // view wrapper necessary for transitions
  const $views = html`<div class="grow relative overflow-hidden">
    <${View} id="welcome">welcome<//>
    <${View} id="core">${await renderOptions(await getCore())}<//>
  </div>`;
  for (const { id, title, description, mods } of categories) {
    const $list = await renderList(id, mods, description),
      $mods = await renderMods({ id, title }, mods);
    $views.append(html`<${View} id=${id}>${$list}<//>`, ...$mods);
  }

  categories.forEach((c) => {
    c.button = html`<${Button}
      icon="chevron-left"
      onclick=${() => setState({ transition: "slide-to-left", view: c.id })}
    >
      ${c.title}
    <//>`;
  });
  const $reload = html`<${Button}
      primary
      class="ml-auto"
      icon="refresh-cw"
      onclick=${() => reloadApp()}
      style="display: none"
    >
      Reload & Apply Changes
    <//>`,
    $footer = html`<${Footer}>${categories.map((c) => c.button)}${$reload}<//>`,
    $main = html`<div class="flex flex-col overflow-hidden transition-[height]">
      ${$views} ${$footer}
    </div>`,
    updateFooter = () => {
      const buttons = [...$footer.children],
        renderFooter = buttons.some(($el) => $el.style.display === "");
      $main.style.height = renderFooter ? "100%" : "calc(100% + 65px)";
    };
  useState(["view"], ([view]) => {
    for (const { mods, button } of categories) {
      const renderButton = mods.some((mod) => mod.id === view);
      button.style.display = renderButton ? "" : "none";
      updateFooter();
    }
  });
  useState(["databaseUpdated"], ([databaseUpdated]) => {
    if (!databaseUpdated) return;
    $reload.style.display = "";
    updateFooter();
  });

  const $skeleton = document.querySelector("#skeleton");
  $skeleton.replaceWith(renderSidebar(sidebar, categories), $main);
};

window.addEventListener("focus", () => setState({ rerender: true }));
window.addEventListener("message", (event) => {
  if (event.data?.namespace !== "notion-enhancer") return;
  const [hotkey, theme, icon] = getState(["hotkey", "theme", "icon"]);
  setState({
    rerender: true,
    hotkey: event.data?.hotkey ?? hotkey,
    theme: event.data?.theme ?? theme,
    icon: event.data?.icon ?? icon,
  });
});
useState(["hotkey"], ([hotkey]) => {
  const { addKeyListener } = globalThis.__enhancerApi ?? {},
    [hotkeyRegistered] = getState(["hotkeyRegistered"]);
  if (!hotkey || !addKeyListener || hotkeyRegistered) return;
  setState({ hotkeyRegistered: true });
  addKeyListener(hotkey, (event) => {
    event.preventDefault();
    const msg = { namespace: "notion-enhancer", action: "open-menu" };
    parent?.postMessage(msg, "*");
  });
  addKeyListener("Escape", () => {
    const [popupOpen] = getState(["popupOpen"]);
    if (!popupOpen) {
      const msg = { namespace: "notion-enhancer", action: "close-menu" };
      parent?.postMessage(msg, "*");
    } else setState({ rerender: true });
  });
});

useState(["theme"], ([theme]) => {
  if (theme === "dark") document.body.classList.add("dark");
  if (theme === "light") document.body.classList.remove("dark");
});
useState(["rerender"], async () => {
  const [theme, icon] = getState(["theme", "icon"]);
  if (!theme || !icon) return;
  // chrome extensions run in an isolated execution context
  // but extension:// pages can access chrome apis
  // ∴ notion-enhancer api is imported directly
  if (typeof globalThis.__enhancerApi === "undefined") {
    await import("../../api/browser.js");
    // in electron this isn't necessary, as a) scripts are
    // not running in an isolated execution context and b)
    // the notion:// protocol csp bypass allows scripts to
    // set iframe globals via $iframe.contentWindow
  }
  // load stylesheets from enabled themes
  await import("../../load.mjs");
  // wait for api globals to be available
  requestIdleCallback(() => render());
});
