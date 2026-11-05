import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

for (const [file, type] of [
  ['first_password_invite.html', 'invite'],
  ['first_password_magic_link.html', 'magiclink'],
]) {
  test(`${type} template keeps its one-time token in the fragment`, async () => {
    const html = await readFile(new URL(`../supabase/templates/${file}`, import.meta.url), 'utf8');
    assert.match(html, new RegExp(`\\{\\{ \\.RedirectTo \\}\\}#token_hash=\\{\\{ \\.TokenHash \\}\\}&amp;type=${type}`));
    assert.doesNotMatch(html, /ConfirmationURL|token_hash=.*\?/);
  });
}
