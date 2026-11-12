// Browser-only GitHub REST client. Credentials never leave memory or reach the repository.
export const EDITOR_REPOSITORY = 'diegosdlc/Turn-Over';
const API = 'https://api.github.com/repos/' + EDITOR_REPOSITORY;

export function validBranchName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 160 &&
    /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(name);
}

function refPath(branch) {
  if (!validBranchName(branch)) throw new Error('Nombre de rama inválido.');
  return branch.split('/').map(encodeURIComponent).join('/');
}

function decodeContent(base64) {
  const bytes = Uint8Array.from(atob(base64.replace(/\s+/g, '')), char => char.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function createGitHubEditorClient(token, request = fetch) {
  if (!token || typeof token !== 'string') throw new Error('Introduce un token de GitHub.');
  const authorization = 'Bearer ' + token.trim();

  async function api(path, method = 'GET', data = null) {
    const response = await request(API + path, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: authorization,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(data == null ? {} : { 'Content-Type': 'application/json' })
      },
      cache: 'no-store',
      ...(data == null ? {} : { body: JSON.stringify(data) })
    });
    let payload = null;
    try { payload = await response.json(); } catch { /* empty/error response */ }
    if (!response.ok) {
      const cause = payload?.message || response.statusText || 'Error de GitHub';
      throw new Error('GitHub ' + response.status + ': ' + cause);
    }
    return payload;
  }

  async function head(branch) {
    const data = await api('/git/ref/heads/' + refPath(branch));
    return data.object.sha;
  }

  return {
    async branches() {
      const result = [];
      for (let page = 1; page <= 10; page++) {
        const entries = await api('/branches?per_page=100&page=' + page);
        result.push(...entries.map(branch => branch.name));
        if (entries.length < 100) break;
      }
      return result;
    },
    head,
    async readCsv(branch, files) {
      const ref = encodeURIComponent(branch);
      const values = await Promise.all(Object.entries(files).map(async ([name, path]) => {
        const data = await api('/contents/' + path + '?ref=' + ref);
        if (data.type !== 'file' || data.encoding !== 'base64') {
          throw new Error('No es un CSV de GitHub: ' + path);
        }
        return [name, decodeContent(data.content)];
      }));
      return { head: await head(branch), csv: Object.fromEntries(values) };
    },
    async createBranch(base, name) {
      if (!validBranchName(name)) {
        throw new Error('Usa letras, números, guiones, guion bajo y / para la nueva rama.');
      }
      const sha = await head(base);
      await api('/git/refs', 'POST', { ref: 'refs/heads/' + name, sha });
      return name;
    },
    async commitCsv(branch, expectedHead, files, message) {
      if (!files.length) throw new Error('No hay cambios para guardar.');
      const currentHead = await head(branch);
      if (currentHead !== expectedHead) {
        throw new Error('La rama ha cambiado en GitHub. Recarga esa rama antes de guardar.');
      }
      const currentCommit = await api('/git/commits/' + encodeURIComponent(currentHead));
      const tree = await api('/git/trees', 'POST', {
        base_tree: currentCommit.tree.sha,
        tree: files.map(file => ({
          path: file.path, mode: '100644', type: 'blob', content: file.content
        }))
      });
      const commit = await api('/git/commits', 'POST', {
        message,
        tree: tree.sha,
        parents: [currentHead]
      });
      // Non-fast-forward updates are refused; the whole change lands in one commit.
      await api('/git/refs/heads/' + refPath(branch), 'PATCH', {
        sha: commit.sha, force: false
      });
      return {
        head: commit.sha,
        url: 'https://github.com/' + EDITOR_REPOSITORY + '/commit/' + commit.sha
      };
    }
  };
}
