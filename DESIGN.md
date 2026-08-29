# FC Rival — Design v1.1

> FC ONLINE Rival Archive의 Fey 기반 리디자인 시스템  
> Version: Design v1.1
> Status: Approved baseline  
> Updated: 2026-08-30

## 1. 디자인 방향

FC Rival의 정보 구조와 기능은 유지하면서 시각 언어를 Fey 디자인 시스템으로 교체한다.

- 제품 성격: FC ONLINE 1대1 라이벌 기록 아카이브
- 핵심 인상: 야간 스포츠 데이터 터미널, 절제된 색상 신호, 정돈된 고밀도 정보
- 기반 스타일: Refero의 Fey design system
- 적용 범위: 개요, 경기, 선수기록, 분석, BEST XI, 경기 상세, 데이터 정보
- 서체: 나눔바른고딕 단일 사용
- 기본 배경: Fey Obsidian #131313
- HOME 식별색: Fey Signal #479FFA
- RIVAL 식별색: Fey Ember #FFA16C
- 보조 강조색: Fey Growth #4EBE96

현재 사이트의 컴포넌트 구조만 계승한다. 기존 민트, 핑크, 보라, 금색 컬러웨이는 계승하지 않는다.

## 2. 핵심 원칙

1. 색은 장식이 아니라 의미를 전달하는 신호로만 사용한다.
2. HOME과 RIVAL은 텍스트, 보더, 수치와 작은 인디케이터로 구분한다.
3. 넓은 면적은 Obsidian, Charcoal, Ink의 무채색 표면으로 구성한다.
4. Growth는 선택, 포커스, 진행 상태와 보조 강조에만 사용한다.
5. 제목과 핵심 수치는 흰색, 설명과 메타데이터는 Graphite를 사용한다.
6. 콘텐츠 카드는 16px, 내부 카드는 10–12px 반경을 기본으로 한다.
7. 인터랙션 컨트롤은 고스트 스타일을 사용하며 큰 유색 버튼을 만들지 않는다.
8. 모든 한글과 영문 UI는 나눔바른고딕으로 통일한다.

## 3. 컬러 토큰

| 토큰 | 값 | 역할 |
|---|---:|---|
| Fey Obsidian | #131313 | 전체 페이지와 Style Tile의 기본 배경 |
| Fey Charcoal | #191919 | 카드, 패널, 탭 컨테이너 |
| Fey Ink | #0B0B0B | 내부 웰, 경기 상세, 피치, 깊은 컨트롤 |
| Fey Abyss | #000000 | 단일 깊은 그림자와 오버레이 |
| Fey White | #FFFFFF | 제목, 핵심 수치, 선택된 주요 텍스트 |
| Fey Mist | #CCCCCC | 아이콘, 보조 링크, 강조 보더 |
| Fey Graphite | #868F97 | 본문 설명, 메타데이터, 비활성 상태 |
| Fey Smoke | #525252 | 디바이더, 피치 라인, 낮은 강조 보더 |
| Fey Signal | #479FFA | HOME 전용 식별색 |
| Fey Ember | #FFA16C | RIVAL 전용 식별색 |
| Fey Growth | #4EBE96 | 포커스, 활성선, 진행 상태, 보조 강조 |

### 색상 역할 규칙

#### HOME — Fey Signal

Fey Signal은 HOME 진영을 나타내는 데 사용한다.

- HOME 라벨
- HOME 카드 보더
- HOME 핵심 수치
- HOME 선수 마커 외곽선
- HOME 분석 데이터 선과 점
- HOME 선택 인디케이터

큰 배경 전체를 파란색으로 채우지 않는다.

#### RIVAL — Fey Ember

Fey Ember는 RIVAL 진영을 나타내는 데 사용한다.

- RIVAL 라벨
- RIVAL 카드 보더
- RIVAL 핵심 수치
- RIVAL 선수 마커 외곽선
- RIVAL 분석 데이터 선과 점
- RIVAL 선택 인디케이터

큰 배경 전체를 주황색으로 채우지 않는다.

#### Supporting — Fey Growth

Fey Growth는 HOME 또는 RIVAL의 소유색이 아니다.

- 활성 탭의 얇은 하단선
- 키보드 포커스 링
- 선택된 중립 필터
- 로딩 또는 진행 상태
- 구분선과 작은 데이터 강조
- 한 컴포넌트 안에서 한 번만 사용하는 긍정적 강조

승리 배지 전체나 큰 카드 배경에는 사용하지 않는다.

## 4. 타이포그래피

### Font family

나눔바른고딕을 모든 역할에 사용한다.

~~~css
font-family:
  "NanumBarunGothic",
  "Nanum Barun Gothic",
  "Nanum Gothic",
  ui-sans-serif,
  system-ui,
  -apple-system,
  sans-serif;
~~~

### 타입 스케일

| 역할 | 크기 | 굵기 | 줄높이 | 자간 |
|---|---:|---:|---:|---:|
| Display | 54px | 700 | 1.05 | -0.04em |
| Display small | 48px | 700 | 1.10 | -0.04em |
| Heading large | 26px | 600 | 1.20 | -0.02em |
| Heading | 24px | 700 | 1.25 | -0.02em |
| Heading small | 18px | 600 | 1.32 | -0.01em |
| Body | 14px | 400 | 1.50 | 0 |
| Label | 12px | 600 | 1.30 | 0 |
| Caption | 10px | 500 | 1.50 | 0 |

타입 표본은 가 A를 사용한다.

숫자 데이터에는 tabular numbers를 활성화한다.

~~~css
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum" 1;
~~~

## 5. 간격과 형태

### Spacing

4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 64px을 사용한다.

- 페이지 최대 폭: 1200px
- 섹션 간격: 64px
- 카드 패딩: 18–24px
- 컴포넌트 간격: 10–16px
- 모바일 페이지 여백: 10px 이상

### Radius

| 요소 | 반경 |
|---|---:|
| 주요 카드와 패널 | 16px |
| 내부 카드와 데이터 웰 | 10–12px |
| 아이콘 버튼 | 6px |
| 결과 배지 | 8px |
| 탭 컨테이너 | 14–16px |
| 필터와 고스트 버튼 | 99px |
| 원형 선수 마커 | 50% |

### Border

- 기본: 1px solid #525252
- 낮은 강조: 1px solid rgba(134, 143, 151, 0.24)
- 강조: 1px solid #CCCCCC
- HOME: 1px solid #479FFA
- RIVAL: 1px solid #FFA16C
- Focus: 1px solid #4EBE96

### Shadow

한 표면에는 하나의 깊은 그림자만 사용한다.

~~~css
box-shadow: 0 0 44px rgba(0, 0, 0, 0.80);
~~~

고스트 액션에는 필요한 경우에만 약한 흰색 광원을 사용한다.

~~~css
box-shadow:
  0 1px 0 rgba(0, 0, 0, 0.85),
  0 0 14px rgba(255, 255, 255, 0.18);
~~~

## 6. 컴포넌트 규칙

### 6.1 Header

- 배경은 투명 또는 Obsidian
- 아이콘은 Mist 단색 모노라인
- 제목은 White 14px 700
- 부제는 Graphite 10px
- 새로고침은 Ink 배경의 고스트 버튼
- 새로고침 버튼에 HOME 또는 RIVAL 색을 사용하지 않는다

### 6.2 Primary navigation

탭은 개요, 경기, 선수기록, 분석의 4개 구조를 유지한다.

- 컨테이너: Charcoal, 16px 반경
- 비활성: Graphite
- 활성: White
- 활성선과 포커스: Growth
- 색이 없는 아이콘과 텍스트 중심
- 큰 유색 탭 배경 금지

### 6.3 Rivalry duel card

두 카드와 중앙 VS 구조를 유지한다.

#### HOME card

- 표면: Charcoal 또는 Ink
- 보더, HOME 라벨, 핵심 전적: Signal
- 일반 지표와 설명: White 또는 Graphite

#### RIVAL card

- 표면: Charcoal 또는 Ink
- 보더, RIVAL 라벨, 핵심 전적: Ember
- 일반 지표와 설명: White 또는 Graphite

#### VS block

- 표면: Ink
- 텍스트: White와 Graphite
- HOME 또는 RIVAL 색을 사용하지 않는다

### 6.4 Milestone bar

ULTIMATE v5 FINAL부터 `확인된 첫 맞대결`과 `최근 경기`의 2분할 구조를 사용한다.

- 표면: Ink
- 구분선: Smoke
- 라벨: Graphite
- 값: White
- 작은 진행 또는 활성 표시에만 Growth 사용

### 6.5 BEST XI and pitch

기존 녹색 경기장은 제거한다.

- 피치 배경: Ink
- 피치 스트라이프: Ink와 Charcoal의 미세한 명도 차이
- 필드 라인: Smoke
- HOME 선수: Signal 외곽선
- RIVAL 선수: Ember 외곽선
- 선택 선수: Growth 포커스 링
- 선수 사진은 원형 또는 둥근 사각형 크롭
- 평점과 강화 등급은 유색 대형 칩 대신 중립 웰과 작은 텍스트로 표시한다

### 6.6 Match list

- 행 배경: 투명 또는 Charcoal
- 행 디바이더: Smoke
- 날짜와 메타: Graphite
- 팀명: White
- HOME 팀 강조: Signal
- RIVAL 팀 강조: Ember
- 점수: White, tabular numbers
- 펼침 아이콘: Mist

결과 배지 승, 무, 패는 중립 고스트 스타일을 기본으로 한다. 색만으로 결과를 전달하지 않고 반드시 글자를 함께 표시한다.

### 6.7 Match detail

- 외부 패널: Charcoal
- 내부 웰: Ink
- 비교 수치 왼쪽 HOME: Signal
- 비교 수치 오른쪽 RIVAL: Ember
- 중앙 지표명: Graphite
- 포커스와 선택: Growth
- 타임라인, MVP, 포메이션을 동일한 색상 역할로 유지한다

#### 경기 지표 비교

- 순서: 유효 슈팅, 슈팅, 점유율, 패스, 패스 성공률
- 유효 슈팅, 슈팅, 패스는 두 팀 합계 대비 비율을 사용한다
- 두 값이 모두 0이면 우세 그래프를 표시하지 않고 수치만 표시한다
- 점유율과 패스 성공률은 각 팀의 독립적인 0–100 범위를 사용한다
- 패스 시도 0회는 0%가 아니라 `데이터 없음`으로 표시한다
- HOME 막대는 왼쪽에서 중앙 방향, RIVAL 막대는 오른쪽에서 중앙 방향으로 배치한다

#### 득점 타임라인과 팀별 MOM

- 득점 이벤트는 시간순 수직 중앙축을 사용한다
- HOME 이벤트는 왼쪽, RIVAL 이벤트는 오른쪽에 배치한다
- 득점 시간, 득점 후 스코어, 득점자, 실제 도움 선수를 표시한다
- 도움 데이터가 없으면 도움 행을 렌더링하지 않는다
- 팀별 MOM은 실제 평점, 골, 도움, 라인업 순서로 각 팀 1명을 정한다
- 평점이 없는 팀은 MOM을 표시하지 않는다
- 경기 상세 피치의 MOM만 평점 앞 별과 Growth의 낮은 강도 외곽선을 사용한다
- BEST XI에는 MOM 강조를 적용하지 않는다

### 6.8 Side switch and record switch

- 컨테이너: Ink
- HOME 선택: Signal 보더 또는 얇은 하단선
- RIVAL 선택: Ember 보더 또는 얇은 하단선
- 득점왕/도움왕처럼 진영과 무관한 선택: Growth 하단선
- 큰 유색 면 채우기 금지

### 6.9 Player ranking

- 카드: Charcoal
- 순위, 선수명, 주요 기록: White
- 메타데이터: Graphite
- 프로필 프레임: Smoke 또는 Mist
- 현재 포커스 행: Growth 보더
- HOME/RIVAL 소속을 표시할 때만 Signal 또는 Ember 사용

### 6.10 Analysis metrics

3열 비교 구조를 유지한다.

- 왼쪽 HOME 값: Signal
- 중앙 지표명: Graphite
- 오른쪽 RIVAL 값: Ember
- 행 구분선: Smoke
- 배경은 Charcoal 또는 Ink
- 승패 우세를 별도의 빨강/초록으로 다시 표현하지 않는다

### 6.11 Record cards

- 4열 카드 그리드 유지
- 카드: Ink
- 라벨: Graphite
- 핵심 값: White
- 소유자가 HOME이면 Signal
- 소유자가 RIVAL이면 Ember
- 선택된 카드의 포커스만 Growth

### 6.12 Diagnostics and footer

- 기본 상태에서는 시각적 우선순위를 낮춘다
- 배경: Obsidian 또는 Ink
- 텍스트: Graphite
- 펼침 상태의 포커스: Growth
- 기술 정보가 핵심 경기 콘텐츠보다 밝아지지 않도록 한다

## 7. 아이콘

- Lucide 계열의 1.5–2px 모노라인 아이콘 사용
- 기본 아이콘: Mist
- 비활성 아이콘: Graphite
- HOME 맥락: Signal
- RIVAL 맥락: Ember
- 포커스: Growth
- 채워진 아이콘과 다색 아이콘은 사용하지 않는다

## 8. 접근성

- White on Obsidian/Charcoal 조합을 핵심 정보에 사용한다
- 색만으로 HOME과 RIVAL을 구분하지 않는다
- HOME, RIVAL, 팀명과 위치를 항상 텍스트로 병기한다
- 승, 무, 패 배지는 글자를 반드시 유지한다
- 키보드 포커스는 2px Growth 외곽선으로 표시한다
- 작은 캡션은 10px 미만으로 줄이지 않는다
- 인터랙션 터치 영역은 최소 40×40px을 권장한다

## 9. 금지사항

- 기존 HOME 민트 #60DBC2 사용 금지
- 기존 RIVAL 핑크 #F28AA0 사용 금지
- 기존 평점 금색 #F6A52C 사용 금지
- 기존 강화 보라 #B78CDB 사용 금지
- 녹색 축구장 배경 사용 금지
- HOME을 Growth로 표현하지 않는다
- RIVAL을 임의의 빨강이나 핑크로 표현하지 않는다
- Accent 컬러로 큰 카드 전체를 채우지 않는다
- 유색 그라디언트를 주요 카드 배경으로 사용하지 않는다
- 나눔바른고딕 외의 보조 서체를 추가하지 않는다
- 다중 그림자, 글래스모피즘, 네온 발광을 사용하지 않는다
- 순수 검정 #000000을 전체 페이지 배경으로 사용하지 않는다

## 10. CSS 토큰

~~~css
:root {
  color-scheme: dark;

  --fey-obsidian: #131313;
  --fey-charcoal: #191919;
  --fey-ink: #0b0b0b;
  --fey-abyss: #000000;

  --fey-white: #ffffff;
  --fey-mist: #cccccc;
  --fey-graphite: #868f97;
  --fey-smoke: #525252;

  --home-signal: #479ffa;
  --rival-ember: #ffa16c;
  --focus-growth: #4ebe96;

  --surface-canvas: var(--fey-obsidian);
  --surface-card: var(--fey-charcoal);
  --surface-well: var(--fey-ink);

  --text-primary: var(--fey-white);
  --text-secondary: var(--fey-graphite);
  --icon-default: var(--fey-mist);
  --border-default: rgba(134, 143, 151, 0.24);

  --font-ui:
    "NanumBarunGothic",
    "Nanum Barun Gothic",
    "Nanum Gothic",
    ui-sans-serif,
    system-ui,
    -apple-system,
    sans-serif;

  --radius-card: 16px;
  --radius-well: 10px;
  --radius-icon: 6px;
  --radius-control: 99px;

  --shadow-card: 0 0 44px rgba(0, 0, 0, 0.80);
}
~~~

## 11. 기존 CSS 마이그레이션

| 현재 값 또는 역할 | Design v1 |
|---|---|
| #080A0E 페이지 배경 | #131313 Fey Obsidian |
| #11151B 패널 | #191919 Fey Charcoal |
| #0D1015 / #0C1015 내부 영역 | #0B0B0B Fey Ink |
| #60DBC2 계열 HOME 민트 | #479FFA Fey Signal |
| #F28AA0 계열 RIVAL 핑크 | #FFA16C Fey Ember |
| #F6A52C 평점 금색 | White/Graphite 중립 웰 |
| #B78CDB 강화 보라 | White/Graphite 중립 웰 |
| 녹색 피치 | Ink/Charcoal 무채색 피치 |
| 민트 활성 탭 | #4EBE96 Growth 얇은 활성선 |
| NanumBarunGothic 기존 선언 | 유지 및 전역 단일 서체화 |

현재 색상 문자열을 기계적으로 일괄 치환하지 않는다. 각 색의 의미를 HOME, RIVAL, Focus, Surface 역할로 먼저 분류한 뒤 토큰으로 교체한다.

## 12. 반응형 원칙

### Desktop

- 최대 폭 1200px
- 대결 카드: HOME / VS / RIVAL 3열
- BEST XI: 2열
- 기록 카드: 4열

### Tablet

- 대결 카드의 VS 폭을 줄인다
- BEST XI는 필요하면 1열로 전환한다
- 기록 카드는 2열
- 주요 탭은 4열 유지

### Mobile

- 페이지 좌우 여백 10px
- 탭은 아이콘 위, 라벨 아래 구조 허용
- HOME / VS / RIVAL 비율을 유지하되 텍스트 크기를 축소한다
- 경기 상세의 포메이션은 1열
- 기록 카드는 2열
- 핵심 터치 영역 최소 40px

## 13. 포메이션 좌표와 표기

BEST XI와 경기 상세는 `src/formation.ts`의 한 좌표 함수를 함께 사용한다.

| 레이어 | Y | 포지션과 기본 X |
|---|---:|---|
| 최전방 | 10 | LS 38, ST 50, RS 62 |
| 윙/포워드 | 23 | LW 15, LF 32, CF 50, RF 68, RW 85 |
| 공격형 미드필더 | 35 | LAM 34, CAM 50, RAM 66 |
| 중앙/측면 미드필더 | 48 | LM 15, LCM 35, CM 50, RCM 65, RM 85 |
| 수비형 미드필더 | 61 | LDM 34, CDM 50, RDM 66 |
| 수비 | 76 | LWB/LB 12, LCB 35, CB/SW 50, RCB 65, RB/RWB 88 |
| 골키퍼 | 91 | GK 50 |

- 3백은 LCB, CB, RCB가 모두 있는 경우다
- 3백의 LWB/RWB만 Y 61, X 8/92를 사용한다
- 3백에서는 `LWB < LDM < CDM < RDM < RWB`의 좌우 순서를 유지한다
- 같은 Y 레이어의 선수 전체 UI 묶음은 최소 20% 간격을 확보하도록 X만 재배치한다
- 포메이션 표기는 수비, 수비형 미드필더, 중앙 미드필더, 공격형 미드필더, 공격수의 5개 구간을 사용하고 0명인 구간은 생략한다
- LWB/RWB는 포메이션 표기에서 항상 수비 구간에 포함하고 GK는 제외한다

포메이션 표기 구간:

- 수비: LWB, LB, LCB, CB, SW, RCB, RB, RWB
- 수비형 미드필더: LDM, CDM, RDM
- 중앙 미드필더: LCM, CM, RCM
- 공격형 미드필더: LM, LAM, CAM, RAM, RM
- 공격수: LW, LF, LS, ST, RS, RF, RW, CF

## 14. Design v1.1 완료 조건

- 전체 배경이 #131313으로 적용되어 있다
- HOME이 #479FFA로 일관되게 표시된다
- RIVAL이 #FFA16C로 일관되게 표시된다
- #4EBE96이 포커스와 보조 강조에만 사용된다
- 기존 민트, 핑크, 금색, 보라 컬러가 제거되어 있다
- 경기장이 녹색이 아닌 Ink/Charcoal로 구성되어 있다
- 모든 화면이 나눔바른고딕을 사용한다
- 모든 핵심 컴포넌트가 16px 카드 체계를 따른다
- 색만으로 팀과 결과를 구분하지 않는다
- 데스크톱과 모바일에서 정보 계층이 유지된다

## 15. 버전 정책

- Design v1: 승인된 최초 기준
- Design v1.1: ULTIMATE v5 FINAL의 포메이션, 타임라인, MOM, 경기 지표 규칙
- 작은 토큰 또는 컴포넌트 조정: v1.2 이후
- 레이아웃 구조 변경: v2
- 각 변경은 문서 하단 변경 이력에 기록한다

## 16. 변경 이력

### Design v1.1 — 2026-08-30

- 개요 대결 카드를 비상호작용 HOME/RIVAL 고정 영역으로 변경
- 이정표를 확인된 첫 맞대결과 최근 경기 2개로 축소
- BEST XI와 경기 상세의 공통 좌표 및 5구간 포메이션 표기 확정
- 선수 전체 UI 묶음을 기준으로 같은 레이어의 X 간격 보정
- 경기 상세 지표 5개의 비교 그래프 규칙 확정
- 득점 타임라인을 중앙축 기반 세로 구조로 변경
- 팀별 MOM 선정 순서와 경기 상세 전용 Growth 강조 규칙 확정
- PC 1440×900, 모바일 390×844 검증 크기 명시

### Design v1 — 2026-08-26

- Fey 기반 컬러 시스템 정의
- HOME을 Fey Signal로 지정
- RIVAL을 Fey Ember로 지정
- Fey Growth를 포커스와 보조 강조로 지정
- 배경을 Fey Obsidian #131313으로 지정
- 전역 서체를 나눔바른고딕으로 지정
- FC Rival의 기존 컴포넌트에 새 토큰 역할을 매핑
- 기존 민트, 핑크, 금색, 보라와 녹색 경기장 제거 규칙 확정

