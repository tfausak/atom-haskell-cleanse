const api = require('atom');
const path = require('path');
const process = require('child_process');

module.exports = {
  subscriptions: null,

  activate() {
    this.subscriptions = new api.CompositeDisposable();
    this.subscriptions.add(atom.commands.add('atom-workspace',
      { 'haskell-cleanse:lint': () => this.lint() }));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  lint() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) { return; }

    const file = editor.getPath();
    const directory = file ? path.dirname(file) : null;
    const hlint = process.spawn('stack',
      ['exec', '--', 'hlint', 'lint', '--json', '--no-exit-code', '-'],
      { cwd: directory });

    const stdout = [];
    const stderr = [];
    hlint.stdout.on('data', (chunk) => stdout.push(chunk));
    hlint.stderr.on('data', (chunk) => stderr.push(chunk));

    hlint.on('close', (status) => {
      if (status !== 0) {
        return atom.notifications.addError('Haskell Cleanse',
          { detail: stderr.concat(stdout).join(''), dismissable: true });
      }
      if (stderr.length !== 0) {
        atom.notifications.addWarning('Haskell Cleanse',
          { detail: stderr.join(''), dismissable: true });
      }

      editor.findMarkers({ key: 'haskell-cleanse' })
        .forEach((marker) => marker.destroy());

      JSON.parse(stdout.join('')).forEach((hint) => {
        const marker = editor.markBufferRange(
          [
            [hint.startLine - 1, hint.startColumn - 1],
            [hint.endLine - 1, hint.endColumn - 1],
          ],
          { invalidate: 'touch', key: 'haskell-cleanse' });

        editor.decorateMarker(marker,
          { type: 'highlight', class: 'haskell-cleanse-highlight' });

        const div = document.createElement('div');
        div.className = 'haskell-cleanse-block';
        div.textContent = `${hint.severity}: ${hint.hint}`
          + (hint.to ? ` (${hint.from} => ${hint.to})` : '');
        editor.decorateMarker(marker,
          { type: 'block', position: 'after', item: div });
      });
    });

    hlint.stdin.write(editor.getText());
    hlint.stdin.end();
  },
};
