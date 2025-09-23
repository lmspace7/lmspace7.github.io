/**
 * White → Green → Blue → Black(다크) 순환 토글
 */

const $toggle = document.getElementById('mode-toggle');

const MODE_KEY = 'mode'; // Theme 클래스와 동일 키 사용 (localStorage로 저장)
const VARIANT_KEY = 'color-variant'; // 변형 키 (localStorage로 저장)
const MODE_ATTR = 'data-mode';
const VARIANT_ATTR = 'data-variant';

// 페이지 진입 시 저장된 모드/변형을 로컬 저장소(localStorage)에서 복원
function restoreFromLocalStorage() {
  const savedMode = localStorage.getItem(MODE_KEY);
  const savedVariant = localStorage.getItem(VARIANT_KEY);

  if (savedMode === Theme.DARK || savedMode === Theme.LIGHT) {
    document.documentElement.setAttribute(MODE_ATTR, savedMode);
  }
  if (savedVariant) {
    document.documentElement.setAttribute(VARIANT_ATTR, savedVariant);
  }

  // 저장값이 전혀 없는 첫 진입 시 기본을 Light Green으로 설정
  if (!savedMode && !savedVariant) {
    setLightWithVariant('light-green');
  }
}

function setLightWithVariant(variant) {
  const $html = document.documentElement;
  $html.setAttribute(MODE_ATTR, Theme.LIGHT);
  localStorage.setItem(MODE_KEY, Theme.LIGHT);

  if (variant) {
    $html.setAttribute(VARIANT_ATTR, variant);
    localStorage.setItem(VARIANT_KEY, variant);
  } else {
    $html.removeAttribute(VARIANT_ATTR);
    localStorage.removeItem(VARIANT_KEY);
  }

  // 시각 상태 변경 알림 (기존 Theme.notify와 동일 이벤트 발행)
  window.postMessage({ id: Theme.ID }, '*');
}

function setDark() {
  const $html = document.documentElement;
  $html.setAttribute(MODE_ATTR, Theme.DARK);
  localStorage.setItem(MODE_KEY, Theme.DARK);

  // 변형 해제
  $html.removeAttribute(VARIANT_ATTR);
  localStorage.removeItem(VARIANT_KEY);

  window.postMessage({ id: Theme.ID }, '*');
}

function getCurrentVariant() {
  const $html = document.documentElement;
  return (
    $html.getAttribute(VARIANT_ATTR) || localStorage.getItem(VARIANT_KEY) || ''
  );
}

function cycleWhiteGreenBlueBlack() {
  const isDark = Theme.visualState === Theme.DARK;
  if (isDark) {
    // Black(다크) → White
    setLightWithVariant('');
    return;
  }

  const v = getCurrentVariant();
  if (v === '') {
    // White → Green
    setLightWithVariant('light-green');
  } else if (v === 'light-green') {
    // Green → Blue
    setLightWithVariant('light-blue');
  } else if (v === 'light-blue') {
    // Blue → Black
    setDark();
  } else {
    // 알 수 없는 값이면 White로 복구
    setLightWithVariant('');
  }
}

export function modeWatcher() {
  if (!$toggle) {
    return;
  }

  // 페이지 진입 시 저장된 모드/변형 복원
  restoreFromLocalStorage();

  // 캡처 단계에서 선처리하여 기존 bubble 단계 Theme.flip() 리스너를 막는다
  $toggle.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      cycleWhiteGreenBlueBlack();
    },
    true
  );
}
