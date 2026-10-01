// Native loading priorities. CSS remains the source of truth for image geometry.
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../frontend/public');
async function main() {
  const invite = path.join(root, 'invite');
  const files = [path.join(invite, 'index.html')];
  for (const entry of await fs.readdir(invite, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const file = path.join(invite, entry.name, 'index.html');
      try { await fs.access(file); files.push(file); } catch {}
    }
  }
  let deferred = 0;
  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    const coverEnd = html.indexOf('</section>');
    let out = ''; let end = 0;
    for (const match of html.matchAll(/<img\b(?=[^>]*\bsrc=["'])[^>]*>/g)) {
      let tag = match[0];
      if (!/\bloading=/.test(tag) && coverEnd !== -1 && match.index > coverEnd) {
        tag = tag.replace('<img', '<img loading="lazy"'); deferred++;
      }
      if (!/\bdecoding=/.test(tag)) tag = tag.replace('<img', '<img decoding="async"');
      out += html.slice(end, match.index) + tag; end = match.index + match[0].length;
    }
    await fs.writeFile(file, out + html.slice(end));
  }
  console.log(`Deferred ${deferred} below-cover images across ${files.length} invitations.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
