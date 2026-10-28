import { execFileSync } from 'node:child_process';

const stagedFiles = new Set(process.argv.slice(2));
const unstagedFiles = execFileSync('git', ['diff', '--name-only', '-z'])
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
const partiallyStaged = unstagedFiles.filter((file) => stagedFiles.has(file));

if (partiallyStaged.length > 0) {
    console.error(
        '自動整形すると未ステージの変更もコミットに含まれます。先に全変更をステージするか、別コミットに分けてください:',
    );
    for (const file of partiallyStaged) console.error(`  ${file}`);
    process.exitCode = 1;
}
