# FC ONLINE Rival Archive

FC ONLINE Rival Archive는 `새로운성연합`과 `피버슛`이 플레이한 1대1 친선경기를 Nexon Open API에서 현재 조회 가능한 범위까지 복원해, 맞대결과 선수 통계를 보여주는 개인 아카이브입니다.

## 기본 라이벌

- HOME: `새로운성연합`
- RIVAL: `피버슛`
- 대상 경기: `matchType 40 · 클래식 1on1`

## 주요 기능

- 두 닉네임의 OUID와 양쪽 친선 Match ID 전체 조회
- 양쪽 Match ID 병합 및 `matchId` 기준 중복 제거
- Match Detail에서 두 OUID의 동시 참여를 재검증
- 총 맞대결, 양쪽 승률, 승·무·패, 총 득점, 평균 득점·실점
- 닉네임 클릭으로 `새로운성연합`·`피버슛` 선수 통계 전환
- 양쪽 각각 득점왕·도움왕 TOP 8
- 선수 시즌 클래스, 강화 단계, 득점·도움·공격포인트·출전 수
- Nexon 공식 `spId` 페이스온 이미지와 이미지 실패 fallback
- 최근 경기부터 20경기씩 표시하는 더 보기
- Match ID와 상세 조회 성공·실패 수 진단 정보
- 모바일 반응형 다크 Rival Archive UI

선수의 실시간 거래시장 가격은 현재 사용하는 공식 API에서 신뢰할 수 있게 제공되지 않으므로 표시하지 않으며, 임의 가격도 만들지 않습니다.

## 데이터 조회 구조

1. 두 닉네임의 OUID를 조회합니다.
2. 두 계정의 클래식 1on1 친선경기를 빈 페이지가 나올 때까지 조회합니다.
3. 양쪽 Match ID를 합치고 중복을 제거합니다.
4. Match Detail을 제한된 동시 요청으로 조회합니다.
5. 두 OUID가 함께 참여한 친선경기만 채택합니다.
6. 채택된 전체 기록으로 양쪽 전적과 선수 통계를 계산합니다.

Open API 호출 안정성을 위해 계정별 최대 10,000개의 친선 Match ID를 안전 상한으로 사용합니다. Match Detail과 완성된 아카이브는 서버 메모리에 캐시됩니다.

## 실행

Node.js 20 이상에서 다음 명령을 실행합니다.

```bash
npm install
npm run dev
```

기존 `.env` 파일과 `NEXON_API_KEY` 설정은 그대로 사용하면 됩니다. API 키는 서버에서만 읽으며 프론트엔드와 GitHub 코드에 포함되지 않습니다.

- Local: 현재 PC에서 `http://localhost:5173`으로 접속
- Network: 같은 Wi-Fi/LAN에서는 개발 서버가 표시하는 Network 주소로 접속
- Codespaces: `PORTS`에서 `5173` 포트를 브라우저로 열기

프론트와 API 서버 모두 `0.0.0.0`에 바인딩되어 네트워크 접속을 지원합니다.

## 데이터 한계

이 프로젝트의 “전체 기록”은 Nexon Open API가 현재 반환하는 범위 내의 최대 기록입니다. API가 반환하지 않는 오래된 경기, 과거 닉네임이나 과거 OUID의 경기는 코드만으로 복구할 수 없습니다. 데이터 갱신 시점에 따라 최근 경기도 늦게 표시될 수 있습니다.

## Cloudflare 배포

Cloudflare Workers에서 프론트엔드 정적 파일과 `/api` 백엔드를 같은 HTTPS 주소로 제공합니다. 배포 환경에는 암호화된 Secret으로 `NEXON_API_KEY`를 설정하고, 빌드 명령은 `npm run build`, 배포 명령은 `npx wrangler deploy`를 사용합니다. API 키는 React 번들에 포함되지 않습니다.

## 향후 v2

- 과거 닉네임 수동 등록과 기록 통합
- 발견한 경기의 데이터베이스 영구 저장
- 연도·시즌별 HISTORY
- 최장 연승·연패와 최대 점수차
- 첫 번째·100번째·500번째 맞대결
- 선수별 라이벌전 상세 기록과 스쿼드 역사

Data based on NEXON Open API
