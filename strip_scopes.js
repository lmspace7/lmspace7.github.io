#!/usr/bin/env node
/**
 * 스코프 마커(Mine/None/Check/Copy, 그리고 @Mine/@None/@Check/@Copy 변형)와
 * 대괄호 블록을 제거하는 스크립트. 마커와 감싼 블록 전체를 삭제한다.
 *
 * - 대상: lmspace7.github.io/_posts/**/*.md
 * - 규칙: 마커 단독 라인 + 다음 라인이 여는 대괄호 '[' 이고, 매칭되는 ']' 까지 제거
 * - 마커 형태: "Mine" | "None" | "Check" | "Copy" 또는 앞에 '@' 가 붙은 형태
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, 'lmspace7.github.io', '_posts');

/**
 * 재귀적으로 디렉터리 내 파일 목록을 수집
 */
function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}

/**
 * 마커 라인인지 확인
 */
function isMarkerLine(line) {
  const trimmed = line.trim();
  // 허용 마커: Mine/None/Check/Copy, 앞에 '@' 허용
  return /^@?(Mine|None|Check|Copy)$/.test(trimmed);
}

/**
 * 파일에서 스코프 블록 제거
 */
function stripScopesFromContent(content) {
  const lines = content.split(/\r?\n/);
  const output = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isMarkerLine(line)) {
      const next = lines[i + 1] ?? '';
      if (next.trim() === '[') {
        // 블록 시작. 매칭되는 ']'를 찾는다(단일 레벨만 가정)
        i += 2; // 마커, '[' 건너뜀
        let found = false;
        while (i < lines.length) {
          const cur = lines[i];
          if (cur.trim() === ']') {
            found = true;
            i += 1; // 닫는 대괄호까지 소비
            break;
          }
          i += 1;
        }
        if (!found) {
          // 닫는 괄호를 못 찾으면, 안전하게 종료
          break;
        }
        continue; // 제거 완료, 다음 라인 진행
      }
      // 마커 단독인데 '['가 바로 오지 않으면, 마커만 제거
      i += 1;
      continue;
    }
    output.push(line);
    i += 1;
  }
  return output.join('\n');
}

function main() {
  if (!fs.existsSync(POSTS_DIR)) return;
  const files = listFiles(POSTS_DIR).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const after = stripScopesFromContent(before);
    if (after !== before) {
      fs.writeFileSync(file, after, 'utf8');
      console.log(`stripped: ${path.relative(ROOT, file)}`);
    }
  }
}

main();


