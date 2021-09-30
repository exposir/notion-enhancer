/*
 * notion-enhancer core: menu
 * (c) 2021 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://notion-enhancer.github.io/) under the MIT license
 */

'use strict';

import { env, fs, storage, registry, web } from '../../api/_.mjs';
const db = await registry.db('a6621988-551d-495a-97d8-3c568bca2e9e');

import './styles.mjs';
import { notifications } from './notifications.mjs';
import { components, options } from './components.mjs';

web.addHotkeyListener(await db.get(['hotkey']), env.focusNotion);

for (const mod of await registry.list((mod) => registry.enabled(mod.id))) {
  for (const sheet of mod.css?.menu || []) {
    web.loadStylesheet(`repo/${mod._dir}/${sheet}`);
  }
}

const loadTheme = async () => {
  document.documentElement.className =
    (await db.get(['theme'], 'light')) === 'dark' ? 'dark' : '';
};
document.addEventListener('visibilitychange', loadTheme);
loadTheme();

window.addEventListener('beforeunload', (event) => {
  // trigger input save
  document.activeElement.blur();
});

const $main = web.html`<main class="main"></main>`,
  $sidebar = web.html`<article class="sidebar"></article>`,
  $profile = web.html`<button class="profile-button">
    Profile: ${web.escape(registry.profileName)}
  </button>`,
  $options = web.html`<div class="options-container">
    <p class="options-placeholder">Select a mod to view and configure its options.</p>
  </div>`;

let _$profileConfig;
$profile.addEventListener('click', async (event) => {
  for (const $selected of document.querySelectorAll('.mod-selected')) {
    $selected.className = 'mod';
  }
  if (!_$profileConfig) {
    const profileNames = [
        ...new Set([
          ...Object.keys(await storage.get(['profiles'], { default: {} })),
          registry.profileName,
        ]),
      ],
      $options = profileNames.map(
        (profile) => web.raw`<option
          class="select-option"
          value="${web.escape(profile)}"
          ${profile === registry.profileName ? 'selected' : ''}
        >${web.escape(profile)}</option>`
      ),
      $select = web.html`<select class="input">
        <option class="select-option" value="--">-- new --</option>
        ${$options.join('')}
      </select>`,
      $edit = web.html`<input
        type="text"
        class="input"
        value="${web.escape(registry.profileName)}"
        pattern="/^[A-Za-z0-9_-]+$/"
      >`,
      $save = web.html`<button class="profile-save">
        ${web.icon('save', { class: 'button-icon' })} Save
      </button>`,
      $delete = web.html`<button class="profile-delete">
        ${web.icon('trash-2', { class: 'button-icon' })} Delete
      </button>`,
      $error = web.html`<p class="profile-error"></p>`;
    $select.addEventListener('change', async (event) => {
      if ($select.value === '--') {
        $edit.value = '';
      } else $edit.value = $select.value;
    });
    $save.addEventListener('click', async (event) => {
      if (profileNames.includes($edit.value) && $select.value !== $edit.value) {
        web.render(
          web.empty($error),
          `The profile "${web.escape($edit.value)}" already exists.`
        );
        return false;
      }
      if (!$edit.value.match(/^[A-Za-z0-9_-]+$/)) {
        web.render(
          web.empty($error),
          'Profile names can only contain letters, numbers, dashes and underscores.'
        );
        return false;
      }
      await storage.set(['currentprofile'], $edit.value);
      if ($select.value === '--') {
        await storage.set(['profiles', $edit.value], {});
      } else if ($select.value !== $edit.value) {
        await storage.set(
          ['profiles', $edit.value],
          await storage.get(['profiles', $select.value], {})
        );
        await storage.set(['profiles', $select.value], undefined);
      }
      location.reload();
    });
    $delete.addEventListener('click', async (event) => {
      await storage.set(['profiles', $select.value], undefined);
      await storage.set(
        ['currentprofile'],
        profileNames.find((profile) => profile !== $select.value) || 'default'
      );
      location.reload();
    });

    _$profileConfig = web.render(
      web.html`<div></div>`,
      web.html`<p class="options-placeholder">
        Profiles are used to switch entire configurations.
        Here they can be selected, renamed or deleted.
        Profile names can only contain letters, numbers,
        dashes and underscores. <br>
        Be careful - deleting a profile deletes all configuration
        related to it. 
      </p>`,
      web.render(
        web.html`<label class="input-label"></label>`,
        $select,
        web.html`${web.icon('chevron-down', { class: 'input-icon' })}`
      ),
      web.render(
        web.html`<label class="input-label"></label>`,
        $edit,
        web.html`${web.icon('type', { class: 'input-icon' })}`
      ),
      web.render(web.html`<p></p>`, $save, $delete),
      $error
    );
  }
  web.render(web.empty($options), _$profileConfig);
});

const _$modListCache = {},
  generators = {
    options: async (mod) => {
      const $fragment = document.createDocumentFragment();
      for (const opt of mod.options) {
        web.render($fragment, await options[opt.type](mod, opt));
      }
      if (!mod.options.length) {
        web.render($fragment, web.html`<p class="options-placeholder">No options.</p>`);
      }
      return $fragment;
    },
    mod: async (mod) => {
      const $mod = web.html`<div class="mod"></div>`,
        $toggle = components.toggle('', await registry.enabled(mod.id));
      $toggle.addEventListener('change', (event) => {
        registry.profileDB.set(['_mods', mod.id], event.target.checked);
        notifications.onChange();
      });
      $mod.addEventListener('click', async (event) => {
        if ($mod.className === 'mod-selected') return;
        for (const $selected of document.querySelectorAll('.mod-selected')) {
          $selected.className = 'mod';
        }
        $mod.className = 'mod-selected';
        const fragment = [
          web.render(components.title(mod.name), components.version(mod.version)),
          components.tags(mod.tags),
          await generators.options(mod),
        ];
        web.render(web.empty($options), ...fragment);
      });
      return web.render(
        web.html`<article class="mod-container"></article>`,
        web.render(
          $mod,
          mod.preview
            ? components.preview(
                mod.preview.startsWith('http')
                  ? mod.preview
                  : fs.localPath(`repo/${mod._dir}/${mod.preview}`)
              )
            : '',
          web.render(
            web.html`<div class="mod-body"></div>`,
            web.render(components.title(mod.name), components.version(mod.version)),
            components.tags(mod.tags),
            components.description(mod.description),
            components.authors(mod.authors),
            mod.environments.includes(env.name) && !registry.core.includes(mod.id)
              ? $toggle
              : ''
          )
        )
      );
    },
    modList: async (category) => {
      if (!_$modListCache[category]) {
        const $search = web.html`<input type="search" class="search"
          placeholder="Search ('/' to focus)">`,
          $list = web.html`<div class="mods-list"></div>`,
          mods = await registry.list(
            (mod) => mod.environments.includes(env.name) && mod.tags.includes(category)
          );
        web.addHotkeyListener(['/'], () => $search.focus());
        $search.addEventListener('input', (event) => {
          const query = $search.value.toLowerCase();
          for (const $mod of $list.children) {
            const matches = !query || $mod.innerText.toLowerCase().includes(query);
            $mod.classList[matches ? 'remove' : 'add']('hidden');
          }
        });
        for (const mod of mods) {
          mod.tags = mod.tags.filter((tag) => tag !== category);
          web.render($list, await generators.mod(mod));
          mod.tags.unshift(category);
        }
        _$modListCache[category] = web.render(
          web.html`<div></div>`,
          web.render(
            web.html`<label class="search-container"></label>`,
            $search,
            web.html`${web.icon('search', { class: 'input-icon' })}`
          ),
          $list
        );
      }
      return _$modListCache[category];
    },
  };

const $notionNavItem = web.html`<h1 class="nav-notion">
    ${(await fs.getText('icon/colour.svg')).replace(
      /width="\d+" height="\d+"/,
      `class="nav-notion-icon"`
    )}
    <a href="https://notion-enhancer.github.io/" target="_blank">notion-enhancer</a>
  </h1>`;
$notionNavItem.children[0].addEventListener('click', env.focusNotion);

const $coreNavItem = web.html`<a href="?view=core" class="nav-item">core</a>`,
  $extensionsNavItem = web.html`<a href="?view=extensions" class="nav-item">extensions</a>`,
  $themesNavItem = web.html`<a href="?view=themes" class="nav-item">themes</a>`,
  $communityNavItem = web.html`<a href="https://discord.gg/sFWPXtA" class="nav-item">community</a>`;

web.render(
  document.body,
  web.render(
    web.html`<div class="body-container"></div>`,
    web.render(
      web.html`<div class="content-container"></div>`,
      web.render(
        web.html`<nav class="nav"></nav>`,
        $notionNavItem,
        $coreNavItem,
        $extensionsNavItem,
        $themesNavItem,
        $communityNavItem
      ),
      $main
    ),
    web.render($sidebar, $profile, $options)
  )
);

function selectNavItem($item) {
  for (const $selected of document.querySelectorAll('.nav-item-selected')) {
    $selected.className = 'nav-item';
  }
  $item.className = 'nav-item-selected';
}

import * as router from './router.mjs';

router.addView('core', async () => {
  web.empty($main);
  selectNavItem($coreNavItem);
  return web.render($main, await generators.modList('core'));
});

router.addView('extensions', async () => {
  web.empty($main);
  selectNavItem($extensionsNavItem);
  return web.render($main, await generators.modList('extension'));
});

router.addView('themes', async () => {
  web.empty($main);
  selectNavItem($themesNavItem);
  return web.render($main, await generators.modList('theme'));
});

router.loadView('extensions', $main);
