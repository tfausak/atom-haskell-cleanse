const api = require('atom');
const path = require('path');
const process = require('child_process');

const addErrorNotification = (stderr, stdout) => atom.notifications.addError(
  'Haskell Cleanse',
  { detail: stderr.concat(stdout).join(''), dismissable: true }
);

const addWarningNotification = (stderr) => atom.notifications.addWarning(
  'Haskell Cleanse',
  { detail: stderr.join(''), dismissable: true }
);

const destroyMarkers = (editor) => editor
  .findMarkers({ key: 'haskell-cleanse' })
  .forEach((marker) => marker.destroy());

const addMarker = (editor, hint) => {
  const marker = editor.markBufferRange(
    [
      [hint.startLine - 1, hint.startColumn - 1],
      [hint.endLine - 1, hint.endColumn - 1],
    ],
    { invalidate: 'touch', key: 'haskell-cleanse' }
  );

  editor.decorateMarker(
    marker,
    { class: 'haskell-cleanse-highlight', type: 'highlight' }
  );

  const item = document.createElement('div');
  item.className = 'haskell-cleanse-block';
  const conversion = hint.to ? ` (${hint.from} => ${hint.to})` : '';
  item.textContent = `${hint.severity}: ${hint.hint}${conversion}`;
  editor.decorateMarker(marker, { item, position: 'after', type: 'block' });
};

const addMarkers = (editor, hints) => hints
  .forEach((hint) => addMarker(editor, hint));

const callHlint = (editor, done) => {
  const file = editor.getPath();
  const hlint = process.spawn(
    'stack',
    ['exec', '--', 'hlint', 'lint', '--json', '--no-exit-code', '-'],
    { cwd: file ? path.dirname(file) : null }
  );

  const stdout = [];
  const stderr = [];
  hlint.stdout.on('data', (chunk) => stdout.push(chunk));
  hlint.stderr.on('data', (chunk) => stderr.push(chunk));

  const stdin = editor.getText();
  hlint.on('close', (status) => done({ status, stderr, stdin, stdout }));

  hlint.stdin.write(stdin);
  hlint.stdin.end();
};

module.exports = {
  activate () {
    this.subscriptions = new api.CompositeDisposable();
    this.subscriptions.add(atom.commands.add(
      'atom-workspace',
      { 'haskell-cleanse:lint': () => this.lint() }
    ));
  },

  deactivate () {
    this.subscriptions.dispose();
  },

  lint () {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor) {
      callHlint(editor, ({ status, stderr, stdout }) => {
        if (status === 0) {
          if (stderr.length !== 0) {
            addWarningNotification(stderr);
          }

          destroyMarkers(editor);

          addMarkers(JSON.parse(stdout.join('')));
        } else {
          addErrorNotification(stderr, stdout);
        }
      });
    }
  },

  subscriptions: null,
};
