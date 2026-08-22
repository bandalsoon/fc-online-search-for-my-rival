# FC ONLINE Rival Archive — ULTIMATE v4.5 인수인계

이 문서는 다음 버전 작업자가 현재 배포 상태를 보존하면서 바로 이어서 개발하기 위한 기준 문서다. 다음 기능명세서와 이 문서를 먼저 읽고, 실제 수정 전에 현재 `main` 코드 및 배포 화면과 서로 일치하는지 확인한다. 과거 명세 전체를 다시 구현하거나 명세에 없는 리팩터링을 하지 않는다.

## 1. 프로젝트 현재 목적

`새로운성연합`과 `피버슛`을 동등한 라이벌 주체로 두고, Nexon Open API가 현재 반환하는 FC ONLINE 1대1 친선 맞대결을 최대한 오래된 기록까지 찾아 통계·선수 기록·경기 상세·분석으로 보여 주며, 발견한 Match Detail을 영구 보관하는 개인 아카이브다.

- 기본 HOME: `새로운성연합`
- 기본 RIVAL: `피버슛`
- 실제 API 데이터만 사용한다. 가짜 기록, 추정 평점, 임의 득점 시간, 가상 가격을 만들지 않는다.
- “전체 기록”은 Nexon Open API가 현재 반환하는 범위와 D1에 이미 검증·보관된 기록의 합계를 뜻한다.

## 2. 현재 배포 주소

- Production: <https://fc-online-rival-archive.rhrjsals0103.workers.dev/>
- Health: <https://fc-online-rival-archive.rhrjsals0103.workers.dev/api/health>
- Repository: <https://github.com/bandalsoon/fc-online-search-for-my-rival>

## 3. 현재 버전

- 화면/API 버전: `ULTIMATE v4.5`
- 프론트엔드: React 19 + Vite 6 + TypeScript
- 로컬 API: Node.js + Express + TypeScript
- 운영 API/정적 자산: Cloudflare Worker + Workers Assets
- 영구 저장소: Cloudflare D1

## 4. 주요 폴더/파일 역할

- `src/App.tsx`: 탭, 상대전적, 양 팀 BEST XI, 경기 목록·상세, 선수기록, 분석, 진단 UI
- `src/index.css`: 다크 Rival Archive 디자인, 반응형 레이아웃, 선수/포메이션 UI, 나눔바른고딕 적용
- `src/types.ts`: 프론트에서 사용하는 Archive 응답 타입
- `src/formation.ts`: v4.5 고정 포지션 좌표와 3백/4백 윙백 예외, 겹침 시 X축 미세조정
- `server/archive.ts`: Nexon API 호출, 메타데이터·캐시, 양쪽 기록 수집, 맞대결 검증, 통계/BEST XI/분석 조립
- `server/player-salaries.ts`: 공식 FC ONLINE 데이터센터에서 검증한 선수 급여 스냅샷
- `server/index.ts`: 로컬 Express API, `/api/health`, `/api/archive`, `0.0.0.0` 바인딩
- `worker/index.ts`: 운영 Cloudflare Worker 라우팅, Secret/D1 연결, API 오류 응답, 정적 자산 전달
- `worker/d1-store.ts`: D1의 Match Detail 조회·저장·개수 집계 구현
- `migrations/0001_create_rivalry_matches.sql`: 현재 D1 스키마
- `tests/formation.test.ts`: 공격 레이어와 3백/4백 윙백 좌표 회귀 테스트
- `vite.config.ts`: 프론트 빌드와 로컬 `/api` 프록시
- `vite.worker.config.ts`: Worker 번들 생성
- `wrangler.jsonc`: Workers Assets, D1 binding `DB`, 배포 설정
- `README.md`: 사용자용 실행·기능·데이터 한계 안내

## 5. 프론트엔드/백엔드/DB 구조

```text
브라우저 React UI
  └─ 같은 출처의 GET /api/archive?home=...&rival=...
       ├─ 로컬: Vite proxy → Express(3001)
       └─ 운영: Cloudflare Worker
            ├─ Nexon Open API/공식 메타데이터
            ├─ 메모리 캐시
            └─ Cloudflare D1(DB binding)
                 └─ rivalry_matches
```

- 프론트는 API 주소를 특정 `localhost`로 하드코딩하지 않고 상대 경로 `/api/...`를 사용한다.
- 로컬 `npm run dev`는 웹과 API를 함께 실행한다. Vite는 5173, Express는 3001을 사용한다.
- 로컬 Express에는 D1이 연결되지 않으므로 `/api/health`의 `databaseConfigured`는 `false`가 정상이다.
- 운영 Worker는 `/api/*`를 먼저 처리하고 그 외 요청은 SPA 정적 자산으로 전달한다.

## 6. Nexon API 사용 구조

현재 데이터 흐름은 다음과 같다.

```text
닉네임 → 양쪽 OUID 조회
→ 공식 matchtype 메타데이터 검증
→ 양쪽 유저의 대상 친선 Match ID 전체 페이지네이션
→ 합집합 및 matchId 중복 제거
→ D1에 이미 저장된 Match Detail 로드
→ 새 Match ID만 제한된 동시성으로 Match Detail 조회
→ 두 OUID가 함께 있고 대상 친선 Match Type인 경기만 채택
→ D1 저장
→ 전체 통계·선수기록·BEST XI·분석 생성
```

- 현재 포함: 공식 메타데이터 명칭이 정확히 `클래식 1on1`인 타입 40, `공식 친선`인 타입 60
- 명시적 제외: 감독모드 52, 공식경기, 리그, 볼타, AI, 연습, 훈련 및 기타 모드
- Match ID 페이지 크기: 100
- 계정별 안전상한: 10,000 IDs
- Match Detail 동시성: 4
- 요청 시간 제한: 15초
- Match Detail 개별 실패는 전체 Archive 실패로 번지지 않으며, 실패한 Promise는 캐시에서 제거되어 다음 조회 때 재시도된다.
- 메타데이터/상세 캐시는 24시간, Archive 결과 캐시는 10분이다.
- 선수 이름·시즌·시즌 이미지·포지션은 각각 공식 `spid.json`, `seasonid.json`, `spposition.json`을 사용한다.
- 선수 페이스온은 공식 Nexon CDN을 사용하고, 없는 이미지는 UI placeholder로 처리한다.
- 선수 급여는 공식 FC ONLINE 데이터센터 값만 사용한다. 검증 스냅샷에 없는 카드는 공식 `PlayerAbility` 응답을 제한적으로 조회하며 실패 시 `null`로 둔다.

## 7. API Key 보안 원칙

- 환경변수명은 반드시 `NEXON_API_KEY`를 유지한다.
- `.env`, API 키 값, Cloudflare Secret 값은 읽기·출력·복사·수정·삭제·재생성·커밋하지 않는다.
- `.env.example` 및 유사 템플릿 파일을 불필요하게 만들거나 고치지 않는다.
- 실제 키를 README, 이 문서, 소스, 로그, 이슈, 커밋 메시지, 화면 응답에 넣지 않는다.
- 브라우저에서 Nexon API를 직접 호출하지 않는다. 키는 로컬 서버 또는 Worker Secret에서만 읽는다.
- `/api/health`는 키의 존재 여부만 Boolean으로 반환하며 값을 노출하지 않는다.
- 키 관련 문제가 의심돼도 사용자에게 채팅으로 키를 붙여 넣으라고 하지 않는다. 기존 환경/Secret 설정의 존재 여부만 확인한다.

## 8. 영구 DB 저장 방식

- D1 데이터베이스: `fc-online-rival-archive-db`
- Worker binding: `DB`
- 기준 테이블: `rivalry_matches`
- 기본키: `match_id`
- 저장 필드: 경기 ID/날짜/타입, 두 OUID, 검증된 원본 Match Detail JSON, 최초 수집 시각, 마지막 검증 시각
- `(home_ouid, rival_ouid, match_date DESC)` 인덱스로 라이벌 쌍의 기록을 최신순 조회한다.
- `match_id` 충돌 시 원본 JSON과 마지막 검증 시각을 갱신한다.
- 저장은 50개 단위 D1 batch로 처리한다.
- 조회 시작 시 DB 기록을 먼저 불러오고, 현재 양쪽 Match ID 합집합에서 DB에 없는 ID만 Nexon에 요청한다.
- 메모리 캐시는 성능 보조일 뿐 영구 기록의 기준이 아니다.
- 스키마 변경 시 기존 migration을 덮어쓰지 말고 새 번호의 migration을 추가한다. 원격 적용 전 대상 DB와 SQL을 다시 확인한다.

## 9. 현재 구현 완료 기능

- 양쪽 OUID 조회, 양쪽 친선 Match ID 끝까지 페이지네이션, 합집합·중복 제거
- 공식 메타데이터 기반 대상 Match Type 확인 및 감독모드 제외
- Match Detail 두 OUID 참여 재검증, 개별 실패 격리, 캐시, D1 영구 저장
- 총 경기, 승·무·패, 승률, 총 득실, 평균 득실, 최초/최근 확인 경기
- 대칭형 HOME VS RIVAL 상단과 닉네임 선택 상태
- 개요의 양 팀 BEST XI, 대표 포메이션, 실제 평균 `spRating`, 10경기 출전 조건, 동일 선수카드 중복 방지
- 경기 최신순 목록, 20경기씩 더 보기, 경기 클릭 상세
- 경기 상세의 점유율·슈팅·유효슈팅·패스, 득점 타임라인, 실제 평점 최고 선수, 당시 라인업/포메이션
- 양쪽 선수 득점왕·도움왕 TOP 8 선택형 UI(기본 선택: 득점왕)
- 선수 구분키 `spId + spGrade`, 출전/골/도움/공격포인트/경기당 공격포인트
- 선수 이름, 시즌, 시즌 이미지, 페이스온, 강화단계, 공식 급여 및 이미지 fallback
- 분석 탭의 득점·실점·슈팅·패스 지표, 최대 점수차, 최다 득점 경기, 연승·무패·연패, 최빈 스코어, 선수 단일 경기 기록, 이정표
- 접을 수 있는 데이터 진단 영역, 로딩·재시도·오류 메시지
- PC/모바일 반응형 UI, `0.0.0.0` 네트워크 접속, 나눔바른고딕
- `/api/health`, TypeScript 검사, 프론트/Worker 빌드, 포메이션 회귀 테스트

## 10. 미구현/조건부 기능

- Nexon API가 반환하지 않는 옛 경기 복구
- 과거 닉네임·과거 OUID 자동 발견 및 한 사람에 복수 OUID 연결
- 전역 FC ONLINE 경기 DB 역검색
- 공식 근거 없는 실시간 선수 시장가
- 영구 인물/별칭 모델과 사용자 입력형 과거 닉네임 관리
- 연도별·월별·시즌별 역사 화면과 장기 추이
- D1 기록의 정기 재검증/갱신 작업과 신규 경기 증분 동기화 스케줄러
- 포지션별 고급 패스·슈팅 등은 Match Detail에 실제 필드가 있고 검증될 때만 확장 가능
- 선수 급여와 일부 공식 이미지는 외부 공식 리소스 응답 여부에 따라 `null`/placeholder가 될 수 있다.

조건부 기능을 새 명세에서 확정 기능처럼 가정하지 않는다. 먼저 실제 응답과 공식 출처를 검증한다.

## 11. v4.5에서 확정된 UI/포지션 규칙

### 탭 및 개요

- 탭은 `개요 / 경기 / 선수기록 / 분석` 네 개다.
- 독립 `BEST XI` 탭과 개요의 `최근 5경기` 영역은 없다.
- 개요에는 `새로운성연합 BEST XI`와 `피버슛 BEST XI`를 모두 표시한다.
- BEST XI 후보는 라이벌 맞대결 전체에서 10경기 이상 출전한 카드만 사용한다.
- BEST XI 평점은 실제 경기 `spRating` 평균이며 자체·추정 평점을 금지한다.
- 대표 포메이션은 각 팀이 맞대결에서 가장 많이 사용한 실제 포지션 구성이다.
- 동일 선수카드(`spId + spGrade`)가 BEST XI의 두 자리를 차지하면 안 된다.
- BEST XI의 골·도움은 해당 카드의 전체 맞대결 통산값이다.

### 포지션군

- 중앙 미드필더군: `LCM/CM/RCM/LDM/CDM/RDM`
- 측면군: `LAM/RAM/LM/RM/LW/RW`
- 중앙 공격형군: `CF/CAM`
- 후보 선택에는 포지션군을 쓰되 화면 배치는 대표 포메이션의 실제 슬롯 좌표를 쓴다.

### 고정 좌표

- 좌표 기준: X 0=왼쪽, 100=오른쪽 / Y 0=상대 골대, 100=우리 골대
- Y 10: `LS/ST/RS`
- Y 23: `LW/LF/CF/RF/RW`
- Y 35: `LAM/CAM/RAM`
- Y 48: `LM/LCM/CM/RCM/RM`
- Y 61: `LDM/CDM/RDM`
- Y 76: 후방선 `LWB/LB/LCB/CB/SW/RCB/RB/RWB`(4백 기준)
- Y 91: `GK`
- 주요 X: LW/LM 15, LF 32, LS 38, 중앙 50, RS 62, RF 68, RW/RM 85, LB/LWB 12, LCB 35, RCB 65, RB/RWB 88
- CAM 계열을 CF/Wing 레이어로 끌어올리지 않는다. 겹침 시 X축만 미세조정하고 Y축은 바꾸지 않는다.
- 4백의 LWB/RWB는 후방 Y 76이다.
- `LCB/CB/RCB`가 모두 있는 3백의 LWB/RWB만 Y 61, X 10/90으로 올린다. 이때 LWB는 LDM보다 왼쪽, RWB는 RDM보다 오른쪽이어야 한다.
- GK는 항상 최하단 중앙이다.

### 선수 1명 UI

- 반드시 표시 가능한 9개 요소: 평점, 골, 도움, 페이스온, 실제 포지션, 급여, 시즌 스프라이트, 선수 이름, 강화단계
- 배치: 상단 중앙 평점 → 아래에 `⚽ 골`/`👟 도움` → 원형 배경과 페이스온 → 실제 포지션 → 최하단 `급여 → 시즌 스프라이트 → 선수 이름 → 강화단계`
- 0골은 골 영역을, 0도움은 도움 영역을 숨긴다. 둘 다 0이면 공격기록 영역 자체를 렌더링하지 않는다.
- 강화단계는 골·도움과 분리한다.
- 선수기록 탭은 득점왕/도움왕 중 한 종류만 표시하며 기본값은 득점왕이다.

## 12. 첨부 이미지 사용 규칙

- 다음 기능명세서에 `첨부 이미지 N`이 적혀 있으면 작업 시작 전에 모든 해당 이미지를 실제로 열어 확인한다.
- 첫 응답에서 이미지마다 `첨부 이미지 N — 확인한 UI 요소와 배치 용도` 형식으로 한 줄 설명한다.
- 그 다음 `이해한 변경사항 / 유지할 기존 기능 / 애매하거나 충돌하는 사항 / 구현 순서`를 짧게 보고한 뒤 작업한다.
- 이미지가 첨부되지 않았거나 열 수 없으면 추측하거나 비슷하게 만들지 않는다. 사용자에게 해당 이미지를 다시 요청하고 이미지가 필요한 작업을 보류한다.
- 특히 “첨부 이미지 1”이 명세에 등장하면 반드시 먼저 받아 확인한다. 이전 대화나 접근 불가능한 로컬 경로만 믿고 시작하지 않는다.
- v4.5의 첨부 이미지 1은 선수 스탯 아이콘 참고 이미지이며, 평점/골/도움/원형 페이스온/실제 포지션/급여/시즌/선수명/강화단계의 위계와 배치가 기준이다.

## 13. 절대 건드리면 안 되는 기존 기능

다음 기능은 새 명세가 명시적으로 변경을 요구하지 않는 한 재작성·삭제·우회하지 않는다.

- `.env`, `NEXON_API_KEY`, Cloudflare Secret 및 모든 비밀값 처리
- 양쪽 OUID/Match ID 조회, 전체 페이지네이션, 합집합, 중복 제거, 두 OUID 참여 검증
- 대상 Match Type의 공식 메타데이터 검증과 감독모드 제외
- Match Detail 원본 처리, 개별 실패 격리, timeout, 동시성 제한, 실패 캐시 제거
- 메타데이터/Match Detail/Archive 캐시
- D1 `rivalry_matches` 영구 저장 및 기존 데이터
- `/api/health`, `/api/archive`, 상대경로 API 호출, `0.0.0.0` 네트워크 구조
- 경기 상세, 분석 탭, 모바일 반응형, 이미지 fallback
- 현재 배포 설정과 GitHub/Cloudflare 연결

DB 삭제, 테이블 초기화, migration 덮어쓰기, Secret 재등록, API 키 교체, 강제 Git 이력 변경은 금지한다. 불가피한 구조 변경은 먼저 영향과 복구 방법을 사용자에게 설명하고 명시적 승인을 받는다.

## 14. 알려진 문제 및 주의사항

- 현재 실제로 확인되는 맞대결은 17경기다. 이는 UI 제한이 아니라 현재 양쪽 기록 탐색과 D1 보관 결과이며, API가 돌려주지 않는 더 오래된 기록은 복구할 수 없다.
- 최근 경기는 Nexon 데이터 갱신 시점 때문에 늦게 나타날 수 있다.
- 공식 선수 페이스온/시즌 이미지가 없는 카드는 placeholder가 정상 동작이다. 깨진 이미지 아이콘을 노출하지 않는다.
- 공식 데이터센터 급여 조회가 실패하면 `—`가 정상 fallback이다. 임의 숫자로 채우지 않는다.
- 급여 스냅샷은 2026-08-22 검증값이다. 새 카드가 등장하면 공식 출처로 확인하며, 무기한 최신값으로 간주하지 않는다.
- D1에는 원본 JSON이 들어 있으므로 응답 타입을 줄이더라도 향후 경기 상세에 필요한 필드를 저장 단계에서 버리지 않는다.
- OUID는 현재 닉네임 조회 결과 기준이다. 닉네임 변경/과거 OUID 통합은 아직 구현하지 않았다.
- 로컬 Express 실행은 D1 영구 저장 검증을 대체하지 않는다. DB 기능은 운영 Worker 또는 Wrangler 환경에서 별도로 확인한다.
- `FRIENDLY_MATCH_TYPE = 40` 상수 하나만 보고 대상 범위를 판단하지 않는다. 실제 대상 목록은 공식 `matchtype.json`에서 이름으로 검증한 40과 60이다.

## 15. 향후 v5에서 확장 예정인 기능

다음은 방향이며, 실제 구현 범위는 사용자의 다음 v5 기능명세서를 최우선으로 한다.

- 선수기록 선택 UI에 최다 패스·최다 슈팅 등 실제 데이터 기반 기록 추가
- 사람 중심 `displayName / aliases / ouids` 모델과 사용자가 아는 과거 닉네임 등록
- 최초 전체 동기화 후 신규 경기만 찾는 정기 증분 동기화 및 재검증
- 연도별·월별·시즌별 전적, 연승/연패/무패 추이, 주요 맞대결 이정표
- 경기 상세 포메이션/선수 기록의 추가 확장

공식 API 응답에 없는 데이터는 v5에서도 만들지 않는다. 다음 명세와 충돌하면 이 목록보다 다음 명세가 우선한다.

## 16. 배포 및 테스트 방법

### 작업 전

1. 원격 `main` 최신 상태와 작업 폴더 변경사항을 확인한다.
2. 이 문서, 다음 기능명세서, 지정 첨부 이미지를 모두 검토한다.
3. 수정 범위와 보호할 기능을 먼저 사용자에게 보고한다.
4. 사용자 변경사항과 `.env`를 보존한다.

### 로컬 실행

```bash
npm install
npm run dev
```

- Web: `http://localhost:5173`
- API health: `http://localhost:3001/api/health`

### 필수 검증

```bash
npm run typecheck
npm run test:formation
npm run build
```

- 빌드 성공만으로 끝내지 않는다.
- PC와 모바일에서 실제 화면을 열고 다음 명세의 좌표·배치·표시 조건과 직접 대조한다.
- `/api/health`와 `/api/archive`를 확인하되 API 키 값은 출력하지 않는다.
- 경기 수, Match Detail 실패 수, D1 로드/저장 수가 비정상적으로 줄지 않았는지 진단 영역과 API 응답으로 확인한다.

### D1/배포

DB 스키마를 바꾼 경우에만 새 migration을 만든 뒤 다음 순서로 적용한다.

```bash
npx wrangler d1 migrations apply fc-online-rival-archive-db --remote
npx wrangler deploy
```

- 원격 DB 적용 전 SQL과 대상 DB 이름을 재확인한다.
- 기존 데이터 삭제/초기화 명령은 실행하지 않는다.
- 운영 Secret이 이미 있으므로 문서 작업이나 일반 기능 작업에서 다시 만들지 않는다.
- `main` 연동 자동 배포가 실행된 경우 완료 상태와 실제 운영 URL을 확인한다.
- 배포 후 운영 화면, `/api/health`, 실제 Archive 로드, 모바일 화면을 검증한다.
- 완료 보고는 `완료 / 미완료 / 확인 필요` 세 항목으로 간결하게 작성한다.

## 17. 최근 기준 Git commit/tag

- v4.5 구현 기준 커밋: [`2aafe668ca54ca4176028994fc750e4b1e0560af`](https://github.com/bandalsoon/fc-online-search-for-my-rival/commit/2aafe668ca54ca4176028994fc750e4b1e0560af) — `Improve BEST XI player name readability`
- v4.5 주요 구현 시작 커밋: [`4813401ca16e619c01dfb2adaa7fa90622b9f736`](https://github.com/bandalsoon/fc-online-search-for-my-rival/commit/4813401ca16e619c01dfb2adaa7fa90622b9f736) — `Build ULTIMATE v4.5 overview BEST XI`
- v4.5 롤백 기준 브랜치: `rival-archive-v4.5`
- 이전 롤백 브랜치: `rival-archive-v4`, `rival-archive-v3`
- 별도 Git tag는 확인된 것이 없으므로 브랜치와 구현 기준 커밋 SHA를 복구 기준으로 사용한다.

다음 작업자는 문서 작성 이후의 최신 `main` 커밋을 먼저 확인하되, v4.5 동작 비교 기준은 위 구현 기준 커밋과 운영 화면으로 삼는다.

