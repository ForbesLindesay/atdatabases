(function () {
  'use strict';

  var preferences = {};
  var listeners = [];
  function listen(fn) {
    listeners.push(fn);
    fn();
  }
  function getPreference(name, defaultValue) {
    if (name in preferences) {
      return preferences[name];
    }
    var value = defaultValue;
    if (window.localStorage) {
      var stored = window.localStorage.getItem('preference_' + name);
      if (stored) {
        value = stored;
      }
    }
    preferences[name] = value;
    return value;
  }
  function setPreference(name, value) {
    preferences[name] = value;
    if (window.localStorage) {
      window.localStorage.setItem('preference_' + name, value);
    }
    listeners.forEach(function (fn) {
      fn();
    });
  }

  function ready(callback) {
    if (document.readyState !== 'loading') callback();
    else document.addEventListener('DOMContentLoaded', callback);
  }

  ready(function () {
    var e = document.querySelectorAll('pre');
    for (var i = 0; i < e.length; i++) {
      var element = e[i];
      var modes = [element];
      var nextElement = element.nextElementSibling;
      while (nextElement && nextElement.tagName === 'PRE') {
        modes.push(nextElement);
        nextElement = nextElement.nextElementSibling;
      }
      if (modes.length > 1) {
        merge(modes);
      }
      //  else {
      //   var src = element.textContent.trim();
      //   var match = /^yarn add ((?:-D )?)([@a-zA-Z0-9\/\-]*)$/.exec(src);
      //   if (match) {
      //     installable(element, match[2], !!match[1]);
      //   }
      // }
    }
  });
  // function installable(pre, name, isDev) {
  //   var container = document.createElement('div');
  //   pre.parentElement.replaceChild(container, pre);
  //   var code = pre.querySelector('code');
  //   var codeContainer = document.createElement('div');
  //   codeContainer.appendChild(pre);
  //   var buttonContainer = document.createElement('div');
  //   container.className = 'code-language-switcher';
  //   buttonContainer.className = 'code-language-switcher-buttons';

  //   var yarnBtn = document.createElement('button');
  //   yarnBtn.textContent = 'yarn';
  //   yarnBtn.setAttribute('data-mode', 'yarn');
  //   yarnBtn.addEventListener('click', setInstallMode, false);
  //   buttonContainer.appendChild(yarnBtn);

  //   var npmBtn = document.createElement('button');
  //   npmBtn.textContent = 'npm';
  //   npmBtn.setAttribute('data-mode', 'npm');
  //   npmBtn.addEventListener('click', setInstallMode, false);
  //   buttonContainer.appendChild(npmBtn);

  //   container.appendChild(codeContainer);
  //   container.appendChild(buttonContainer);

  //   listen(function () {
  //     var id = getPreference('package_manager', 'yarn');
  //     if (id === 'yarn') {
  //       yarnBtn.className = 'active';
  //       npmBtn.className = '';
  //       code.textContent = 'yarn add ' + (isDev ? '-D ' : '') + name;
  //     } else {
  //       yarnBtn.className = '';
  //       npmBtn.className = 'active';
  //       code.textContent =
  //         'npm install ' + (isDev ? '--save-dev ' : '--save ') + name;
  //     }
  //   });
  // }
  // function setInstallMode(e) {
  //   var mode = e.target.getAttribute('data-mode');
  //   setPreference('package_manager', mode);
  // }
  function merge(modes) {
    var container = document.createElement('div');
    var codeContainer = document.createElement('div');
    var buttonContainer = document.createElement('div');
    container.className = 'code-language-switcher';
    buttonContainer.className = 'code-language-switcher-buttons';
    container.appendChild(codeContainer);
    var parent = modes[0].parentElement;
    parent.replaceChild(container, modes[0]);
    for (var i = 1; i < modes.length; i++) {
      parent.removeChild(modes[i]);
    }
    // container.appendChild(modes[0]);
    var modeIds = [];
    var modesById = {};
    var buttonsById = {};
    var buttons = [];
    for (var i = 0; i < modes.length; i++) {
      var mode = modes[i];
      var id = getID(mode);
      modesById[id] = mode;
      modeIds.push(id);
      var btn = document.createElement('button');
      btn.textContent = id;
      btn.setAttribute('data-mode', id);
      buttons.push(btn);
      buttonsById[id] = btn;
      buttonContainer.appendChild(btn);
    }
    const preferenceKey = modeIds.sort().join('/');
    buttons.forEach(function (button) {
      button.addEventListener('click', setMode(preferenceKey), false);
    });
    container.appendChild(buttonContainer);
    listen(function () {
      var id = getPreference(preferenceKey, modeIds[0]);
      buttons.forEach(function (button) {
        button.className = '';
      });
      buttonsById[id].className = 'active';
      codeContainer.innerHTML = '';
      codeContainer.appendChild(modesById[id]);
    });
  }

  function setMode(key) {
    return function (e) {
      var mode = e.target.getAttribute('data-mode');
      setPreference(key, mode);
    };
  }
  function getID(element) {
    var codeClass = element.querySelector('code').className.split(' ').pop();

    switch (codeClass) {
      case 'language-typescript':
        return 'TypeScript';
      case 'language-javascript':
        return 'JavaScript';
      case 'language-sh':
        if (/yarn/.test(element.textContent)) {
          return 'yarn';
        }
        if (/(?:npm)|(?:npx)/.test(element.textContent)) {
          return 'npm';
        }
        return 'sh';
      default:
        alert('Unknown Language: ' + codeClass);
        throw new Error('Unknown Language: ' + codeClass);
    }
  }
})();
