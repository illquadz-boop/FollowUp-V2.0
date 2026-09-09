# FollowUp 백엔드 구현·연결·배포 가이드

이 문서는 현재 프론트엔드와 앞서 설명한 통합 계획을 GitHub에서 읽을 수 있도록 정리한 가이드입니다. 예시 설정은 적용되지 않았으며, Spring Boot 서버·MySQL·실제 AI 구현은 이 저장소에 포함하지 않습니다.

먼저 [API 계약](API-CONTRACT.md), [응답 스키마](../lib/contracts.ts), [HTTP 어댑터](../lib/api.ts)를 함께 확인하세요. 이 문서의 권장 확장과 현재 구현을 구분해야 합니다.

## 1. 권장 구조

화면과 API를 같은 출처로 제공합니다. 운영 도메인의 `/`는 현재 정적 프론트엔드, `/api/...`는 Spring Boot로 전달합니다. Spring Boot만 MySQL과 AI 서비스에 접근합니다.

현재 Sites 배포는 정적 프론트엔드입니다. Java JAR를 정적 폴더에 넣어도 실행되지 않습니다. 별도의 Java 실행 환경이 필요합니다. 기존 Sites 주소를 유지하려면 외부 API 직접 연결 또는 서버 측 HTTP 중계 계층을 별도로 설계해야 합니다.

서로 다른 사이트 사이에서 쿠키 인증을 사용하면 타사 쿠키 제한을 받을 수 있습니다. CORS 허용 또는 `SameSite=None; Secure`만으로 모든 브라우저에서 로그인이 유지된다고 보장할 수 없습니다. 같은 출처 `/api` 구조가 통합에 유리합니다. [쿠키 정책](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies)

## 2. 백엔드 준비

권장 기반은 Java 21, Spring Boot, Spring Security, Spring Data JPA, MySQL, Flyway입니다. Spring Initializr에서 유지보수되는 안정 릴리스를 선택하고, Spring Security 버전은 Boot가 관리하는 조합을 사용하세요. [Spring Boot 요구사항](https://docs.spring.io/spring-boot/system-requirements.html)

필요 의존성은 Spring Web, Security, Data JPA, Validation, MySQL Driver, Flyway Migration, Actuator입니다. Flyway의 MySQL 지원 모듈도 포함합니다. 테스트에는 JUnit, Spring Security Test, Testcontainers를 사용합니다.

기능별 패키지는 `auth`, `user`, `workspace`, `project`, `meeting`, `analysis`, `task`, `common`으로 나누세요. 각 기능에서 Controller는 요청·입력 검증, Service는 권한·업무 규칙·트랜잭션, Repository는 DB 접근을 담당합니다. JPA Entity를 직접 JSON으로 반환하지 말고 계약에 맞는 DTO를 만드세요.

초기에는 단일 서버로 시작할 수 있습니다. 서버 여러 대에서 세션을 공유하거나 재시작 후 로그인 상태를 유지하려면 Spring Session과 별도 세션 저장소를 함께 구성해야 합니다.

## 3. 데이터베이스 설계

| 테이블 제안 | 역할 |
| --- | --- |
| users | 정규화 이메일, 비밀번호 해시, 이름, 표시용 직무 |
| workspaces / workspace_members | 작업 공간과 멤버십 |
| projects / project_members | 프로젝트, 소유자, 참여 구성원 |
| meetings / meeting_participants | 회의 원문, 날짜, 상태, 참여자 |
| meeting_drafts | 분석 결과 JSON, 원문 버전, 초안 버전 |
| tasks | 확정된 실제 업무와 수동 생성 업무 |
| meeting_carryovers | 이전 미완료 업무 ID 연결 |
| meeting_confirmations | 확정 요청의 멱등 처리 기록 |

이메일, 프로젝트 구성원 조합, 회의·이전 업무 조합에는 중복 방지 제약을 둡니다. 같은 회의·초안의 확정 기록과 같은 초안 항목의 업무 생성도 DB 고유 제약으로 보호하세요.

회의록은 최대 10만 자입니다. 다국어를 고려해 MEDIUMTEXT 등 충분한 컬럼을 사용합니다. 마감일은 DATE/Java LocalDate, 시각은 UTC 기준으로 저장하고 ISO 8601로 응답합니다. 업무 조회를 위해 프로젝트·상태·담당자·기한, 회의 조회를 위해 프로젝트·날짜 인덱스를 검토하세요.

참조하는 업무·회의·담당자가 같은 프로젝트에 속하는지 서버에서 검사합니다. 외래 키만 존재하고 프로젝트 범위 검사가 빠지면 다른 프로젝트의 항목이 연결될 수 있습니다.

## 4. 응답 계약

- ID는 문자열입니다. DB 숫자 ID를 사용하더라도 DTO에서 계약에 맞게 변환합니다.
- 업무 상태는 TODO / IN_PROGRESS / DONE입니다.
- 우선순위는 HIGH / MEDIUM / LOW입니다.
- 회의 상태는 DRAFT / REVIEW / CONFIRMED입니다.
- 날짜는 YYYY-MM-DD, 시각은 시간대가 포함된 ISO 문자열입니다.
- 미지정 값은 null, 빈 목록은 배열로 반환합니다.
- 현재 어댑터는 본문 객체 또는 `{ "data": ... }` 형태를 허용합니다.
- 목록은 배열을 기대합니다. Spring Page 객체를 그대로 반환하려면 어댑터와 화면을 함께 수정해야 합니다.
- analyze/saveDraft/confirm의 응답은 Draft 단독이 아니라 draft가 포함된 Meeting 전체입니다.
- API 오류는 HTML 리다이렉트 대신 HTTP 상태와 `{ "code": "...", "message": "..." }` JSON을 사용합니다.

전체 엔드포인트와 DTO는 [API 계약](API-CONTRACT.md)을 기준으로 구현하세요.

## 5. 인증과 권한

현재 프론트는 HttpOnly 세션 쿠키 인증을 기대하며 JWT를 localStorage에 저장하지 않습니다. 회원가입은 계정 생성만 수행하고 로그인 화면으로 이동합니다. 가입 시 개인 작업 공간과 본인 멤버십을 같은 트랜잭션에서 생성하면 체험 모드와 같은 시작 흐름이 됩니다.

비밀번호는 Spring Security의 검증된 PasswordEncoder로 해시하고 입력 길이 정책을 알고리즘과 맞춥니다. 인증 시도 제한도 적용하세요. [비밀번호 저장](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html)

JSON 로그인은 사용자 DTO를 반환하는 것만으로 완료되지 않습니다. AuthenticationManager 인증 후 세션 인증 전략을 실행하고, 인증된 SecurityContext를 SecurityContextRepository에 저장해야 다음 요청에서도 로그인 상태가 유지됩니다. 세션 고정 공격 방지와 CSRF 수명도 함께 처리합니다. [인증 저장](https://docs.spring.io/spring-security/reference/servlet/authentication/persistence.html)

**User.role은 화면에서 편집 가능한 표시용 직무입니다. 관리자 권한으로 사용하면 안 됩니다.** 프로젝트 소유자와 멤버십으로 실제 권한을 판단합니다.

- 소유자: 프로젝트 설정, 구성원 변경, 프로젝트 삭제.
- 구성원: 회의와 업무 관리.
- 비구성원: 접근 차단.

모든 ID 기반 조회·수정·삭제에서 서버가 권한을 재검사합니다. 사용자 목록은 팀이나 작업 공간 범위로 제한하세요. 현재 `/users`는 배열 전체를 받아 검색하므로 범위를 넓히기 전에 사용자 검색 계약과 화면을 함께 조정해야 합니다.

## 6. CSRF 초기화 — 현재 코드에 추가 구현 필요

Axios는 `XSRF-TOKEN` 쿠키와 `X-XSRF-TOKEN` 헤더를 사용합니다. 아래는 같은 출처 쿠키 방식의 통합 예시입니다.

Spring Security 7의 SPA 설정 핵심:

```java
http.csrf(csrf -> csrf.spa());
```

이것은 전체 SecurityFilterChain이 아닙니다. 인증 경로, 보호 경로, JSON 오류 처리, 로그인·로그아웃 처리를 별도로 구성합니다. Boot 3/Security 6에 그대로 복사하지 말고 해당 버전의 SPA CSRF 설정을 사용하세요. [SPA CSRF 공식 안내](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)

CSRF 토큰을 초기화할 GET 엔드포인트를 추가합니다. 비로그인 상태에서도 호출 가능해야 합니다.

```java
@GetMapping("/api/auth/csrf")
public ResponseEntity<Void> csrf(CsrfToken token) {
    token.getToken();
    return ResponseEntity.noContent()
        .header("Cache-Control", "no-store")
        .build();
}
```

프론트 공통 `request()`의 try 블록에서 실제 변경 요청 전에 다음 처리를 추가할 수 있습니다.

```ts
if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
  await client.get('/auth/csrf');
}
```

현재 배포 코드에는 이 초기화가 없습니다. 위 예시는 같은 출처에서 쿠키가 프론트 경로에서도 읽히는 설정을 전제로 합니다. 첫 통합은 변경 요청마다 초기화하고, 안정화 후 초기 진입·로그인·로그아웃 직후로 최적화할 수 있습니다. 토큰 실패를 이유로 모든 변경 요청을 무조건 자동 재전송하지 마세요.

외부 API 직접 연결에서는 API 출처의 CSRF 쿠키를 프론트가 읽을 수 없습니다. JSON 또는 헤더로 토큰을 전달하는 계약과 Spring의 토큰 해석 방식을 별도로 맞춰야 합니다. 허용 출처와 credentials, OPTIONS, Content-Type, X-XSRF-TOKEN, Idempotency-Key 등의 CORS 설정도 필요합니다. CORS와 CSRF는 서로 대체하지 않습니다. [Spring CORS](https://docs.spring.io/spring-security/reference/servlet/integrations/cors.html)

## 7. 업무 규칙

1. 프로젝트 생성자는 소유자와 구성원에 포함합니다.
2. 구성원 제거 시 현재 업무의 담당자를 null로 바꾸고 과거 회의 참여 기록은 보존합니다.
3. 회의 생성 시 같은 프로젝트의 이전 회의 중 새 회의 날짜 이하의 미완료 업무를 ID로 연결합니다. 업무를 복제하지 않습니다.
4. 회의 삭제 시 기존 업무는 유지하고 meetingId만 null로 바꿉니다.
5. 업무 삭제 시 carryover 연결을 제거합니다.
6. 프로젝트 삭제 시 해당 프로젝트의 회의와 업무만 함께 삭제합니다.
7. 미완료에서 DONE으로 변경할 때 completedAt을 기록합니다. 완료 취소 시 null로 바꾸고, DONE 상태의 제목 수정만으로 완료 시각을 덮어쓰지 않습니다.
8. 현재 PATCH는 입력 객체 전체를 전송합니다. ownerId·source·생성 시각처럼 서버가 관리하는 필드를 클라이언트 값으로 덮어쓰지 않습니다.

현재 대시보드는 받은 회의와 업무로 계산하므로 초기에는 별도 통계 API가 필수는 아닙니다.

## 8. AI 분석과 초안

회의 원문 조회·권한 검사 → 원문 버전 확보 → 외부 AI 호출 → 결과 검증 → 원문 버전 재확인 → 초안 저장 → REVIEW 상태의 Meeting 반환 순서로 구현합니다.

외부 응답을 기다리는 동안 DB 행 잠금을 유지하지 마세요. 결과 저장 직전에 원문이 변경되지 않았는지 검사합니다. 분석 실패 시 원문과 기존 저장 결과를 유지하고, 분석 성공만으로 tasks를 생성하지 않습니다.

AI에는 회의 원문, 회의 날짜·시간대, 프로젝트 구성원의 ID·이름, 기존 미완료 업무, 출력 스키마를 전달합니다. 결과는 decisions, schedule, tasks로 나누고, 명확하지 않은 담당자나 기한은 null로 둡니다. 서버가 ID·분석 시각·source를 확정하며 source는 AI입니다.

OpenAI를 선택한다면 Structured Outputs로 JSON 구조를 제한할 수 있습니다. 그래도 내용의 정확성, 허용 구성원 ID, 날짜, 거절·미완성 응답은 별도로 검사해야 합니다. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

회의록은 분석할 데이터이지 서버에 명령할 권한이 아닙니다. AI에는 DB 수정 도구를 제공하지 않고 사용자의 검토·확정 단계를 유지합니다. 비밀키는 서버 환경변수나 비밀값 저장소에 두고 VITE_ 변수로 공개하지 않습니다. [운영 보안](https://developers.openai.com/api/docs/guides/production-best-practices)

현재 HTTP 제한 시간은 45초입니다. AI·서버 처리는 이보다 짧게 제한하거나, 분석 작업 ID를 반환하는 비동기 API와 폴링/SSE 처리를 프론트에 함께 추가합니다. 원문 최대 길이와 별개로 모델의 토큰 한도·요청 비용도 검사하세요.

## 9. 확정 트랜잭션과 동시 수정

확정 요청의 Idempotency-Key는 `<meetingId>:<draftId>`입니다. 서버는 이 값을 신뢰하는 대신 실제 회의·초안·사용자 권한과 대조해야 합니다.

한 트랜잭션에서 회의 잠금 → 권한 검사 → 기존 확정 기록 확인 → 초안 ID·버전 검사 → 담당자·기한 검증 → 업무 일괄 생성 → CONFIRMED 상태 변경 → 확정 기록 저장을 수행합니다.

같은 초안의 재요청은 중복 업무 없이 처리합니다. 같은 키에 다른 내용은 충돌로 거절하고, 오래된 초안은 409로 응답합니다. DB 고유 제약을 함께 사용하며 일부 업무 생성이 실패하면 전체 확정을 취소합니다. 결정·일정만 있는 결과는 확정할 수 있지만 완전히 빈 결과는 거절합니다.

일반 업무·회의·프로젝트 수정에는 현재 프론트가 version/If-Match를 전달하지 않습니다. 운영에서는 응답 DTO·Zod 스키마·수정 입력에 버전을 추가하고, 사용자가 읽었던 버전과 서버 버전을 비교해야 합니다. DB의 @Version만 추가하고 클라이언트 버전을 전달하지 않으면 오래 열린 편집 화면의 덮어쓰기까지 막지 못할 수 있습니다.

팀원 변경 사항의 즉시 반영도 아직 없습니다. 활성 프로젝트의 주기적 재조회부터 시작하고 필요할 때 SSE/WebSocket으로 확장하세요.

## 10. 로컬 연결

MySQL과 DB 사용자를 먼저 생성한 뒤 백엔드 설정을 구성합니다. 아래는 적용 전 예시입니다.

```yaml
spring:
  datasource:
    url: ${DB_URL}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate
  flyway:
    enabled: true
server:
  port: 8080
  servlet:
    session:
      timeout: 30m
      cookie:
        http-only: true
        same-site: lax
        secure: ${SESSION_COOKIE_SECURE:true}
```

로컬 HTTP 개발에서만 SESSION_COOKIE_SECURE=false를 사용합니다. 운영은 HTTPS와 true를 사용합니다. 운영 DB에 ddl-auto=create를 사용하지 말고 Flyway로 변경 이력을 관리하세요.

프론트 `.env.local`:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api
```

기존 vite.config.ts의 server 설정에 다음 프록시를 병합합니다. 기존 플러그인 전체를 교체하지 않습니다.

```ts
server: {
  ...(isCodexSeatbeltSandbox
    ? { watch: { useFsEvents: false, usePolling: true } }
    : {}),
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
},
```

백엔드 경로가 /api/...이므로 /api를 제거하는 rewrite를 넣지 않습니다. MySQL → 백엔드 → 프론트 순으로 실행하고 프론트 주소에서 가입·로그인·저장을 검사하세요. 체험 데이터는 실제 DB로 자동 이관되지 않습니다.

Vite 프록시는 개발 전용입니다. VITE_ 값은 빌드 시 반영되므로 운영 정적 파일을 바꾸려면 재빌드해야 합니다. [개발 프록시](https://vite.dev/config/server-options.html#server-proxy), [환경변수](https://vite.dev/guide/env-and-mode)

## 11. 운영 배포

HTTPS가 구성된 Nginx 서버 블록 안에서 사용할 수 있는 경로 분리 예시입니다. 실제 디렉터리·내부 서버 주소·시간 제한은 운영 환경에 맞춥니다.

```nginx
root /srv/followup/frontend;
index index.html;

location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_connect_timeout 5s;
    proxy_read_timeout 40s;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

proxy_pass에서 경로를 바꾸지 않아 /api가 유지됩니다. API 오류가 index.html로 대체되지 않게 하세요. 신뢰한 프록시의 전달 헤더만 사용하고, DB와 내부 Java 포트는 불필요하게 외부 공개하지 않습니다. [Nginx 프록시](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass)

DB 배포·백업 → 백엔드 배포 → 마이그레이션 → HTTPS·API 라우팅 → API 모드 프론트 빌드 → dist/client 배포 → 실제 도메인 통합 검사 순서로 진행합니다. 세션·개인 데이터 응답은 공용 캐시를 피하고 로그에 비밀값과 회의 원문을 불필요하게 남기지 마세요.

GitHub 코드 공개 범위, Sites 페이지 열람 범위, FollowUp 내부 프로젝트 권한은 각각 별개의 설정입니다.

## 12. 통합 완료 점검표

- [ ] 실제 DB 회원가입, 중복 이메일·틀린 비밀번호 거절.
- [ ] 로그인 후 새로고침 유지, 로그아웃 후 이전 세션 거절.
- [ ] 비구성원의 임의 프로젝트·회의·업무 ID 접근 차단.
- [ ] 표시용 role 변경으로 권한 상승 불가.
- [ ] 회의 저장 후 서버 재시작해도 원문 유지.
- [ ] 분석만으로 실제 업무가 생성되지 않음.
- [ ] 초안 저장·재조회·수정 결과 유지.
- [ ] 확정 중복 클릭·병렬 요청·응답 유실에도 업무 중복 없음.
- [ ] 오래된 초안과 동시 수정 충돌을 명시적으로 안내.
- [ ] AI 실패·거절·시간 초과·네트워크 오류 시 원문 보존.
- [ ] 완료·재개 시각과 다음 회의 미완료 업무 연결 정상.
- [ ] 구성원·회의·업무·프로젝트 삭제의 참조 일관성 유지.
- [ ] Chrome·Safari·모바일의 실제 HTTPS 쿠키·CSRF 검증.
- [ ] DB 백업 복원, AI 사용량 제한, 비밀값·로그 점검.
- [ ] 기존 의존성 보안 경고의 호환 패치 적용 및 재검사.

이 저장소의 10개 자동 검사는 체험 저장소와 HTTP 모의 응답 검사입니다. 위 실제 서버 통합 검사를 대신하지 않습니다. 첫 목표는 가입 → 로그인 → 프로젝트 생성 → 회의 저장 → 새로고침 후 유지이며, 그다음 실제 AI를 연결하세요.
