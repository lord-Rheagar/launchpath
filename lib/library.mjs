import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const library = [
  {id:'github',name:'GitHub',aliases:['github.com'],domain:'github.com',mark:'GH',description:'Repository access, app registration, and organization approval.',audience:'personal',capability:'Read issues from a private repository',file:'github.md'},
  {id:'slack',name:'Slack',aliases:['slack.com'],domain:'slack.com',mark:'Sl',description:'Bot permissions, workspace installation, and customer distribution.',audience:'internal',capability:'Post updates as a bot in a selected channel',file:'slack.md'},
  {id:'gmail',name:'Gmail',aliases:['google','google.com','gmail.com','google drive','google calendar'],domain:'google.com',mark:'G',description:'Google client setup and separate Gmail, Drive, and Calendar permission paths.',audience:'external',capability:'Read Gmail mailbox messages',file:'google.md'},
];
export async function getPreparedGuide(id) {
  const entry=library.find(p=>p.id===id);if(!entry)return null;
  const markdown=await readFile(fileURLToPath(new URL(`../guides/${entry.file}`,import.meta.url)),'utf8');
  return {...entry,markdown,status:'documentation_draft',sourcesChecked:'2026-10-30',notice:'Prepared documentation draft. Authenticated setup and acceptance tests have not been performed. Research the app to create a current guide covering OAuth setup, testing, approval, effort, and blockers.'};
}
