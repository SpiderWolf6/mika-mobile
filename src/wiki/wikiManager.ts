import RNFS from 'react-native-fs';
import {WikiFile} from '../types';
import {WIKI_DIR, MAX_WIKI_CONTEXT_FILES} from '../config';

export async function ensureWikiDir(): Promise<void> {
  const exists = await RNFS.exists(WIKI_DIR);
  if (!exists) {
    await RNFS.mkdir(WIKI_DIR);
    await writeWikiFile('about-me.md', '# About Me\n\n<!-- MIKA will fill this in -->\n');
    await writeWikiFile('preferences.md', '# Preferences\n\n<!-- MIKA will fill this in -->\n');
  }
}

export async function listWikiFiles(): Promise<WikiFile[]> {
  await ensureWikiDir();
  const items = await RNFS.readDir(WIKI_DIR);
  const mdFiles = items.filter(f => f.name.endsWith('.md'));

  return Promise.all(
    mdFiles.map(async f => ({
      name: f.name,
      path: f.path,
      content: await RNFS.readFile(f.path, 'utf8'),
      lastModified: f.mtime?.getTime() ?? 0,
    })),
  );
}

export async function readWikiFile(fileName: string): Promise<string | null> {
  const path = `${WIKI_DIR}/${fileName}`;
  const exists = await RNFS.exists(path);
  if (!exists) {
    return null;
  }
  return RNFS.readFile(path, 'utf8');
}

export async function writeWikiFile(
  fileName: string,
  content: string,
): Promise<void> {
  await ensureWikiDir();
  const path = `${WIKI_DIR}/${fileName}`;
  await RNFS.writeFile(path, content, 'utf8');
}

export async function appendWikiFile(
  fileName: string,
  content: string,
): Promise<void> {
  const existing = (await readWikiFile(fileName)) ?? '';
  await writeWikiFile(fileName, existing + '\n' + content);
}

// Returns the most recently modified wiki files as context snippets for the SLM
export async function getRelevantWikiContext(query: string): Promise<string[]> {
  const files = await listWikiFiles();

  // Simple relevance: sort by recency, take top N
  // TODO: replace with keyword/embedding search
  const PLACEHOLDER = '<!-- MIKA will fill this in -->';
  const meaningful = files.filter(f => !f.content.includes(PLACEHOLDER) && f.content.trim().length > 30);
  const sorted = meaningful.sort((a, b) => b.lastModified - a.lastModified);
  return sorted.slice(0, MAX_WIKI_CONTEXT_FILES).map(f => `### ${f.name}\n${f.content}`);
}
