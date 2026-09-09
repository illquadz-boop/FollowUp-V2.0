# FollowUp API 연결 계약

이 문서는 구현된 프론트엔드가 기대하는 계약입니다. 기존 백엔드 API가 제공되지 않아 정의한 형태이며, 실제 서버가 다르면 `lib/api.ts`에서 매핑하면 됩니다. UI는 `Repository` 인터페이스에만 의존합니다.

## 연결·인증

- `VITE_DATA_MODE=api`, `VITE_API_BASE_URL=<HTTPS API 주소>`로 빌드합니다.
- Axios는 `withCredentials: true`를 사용합니다. 서버는 세션을 HttpOnly·Secure 쿠키로 발급하고 로그인/로그아웃/만료를 처리해야 합니다. 토큰을 localStorage에 저장하는 구현은 없습니다.
- CSRF 쿠키 이름은 `XSRF-TOKEN`, 요청 헤더는 `X-XSRF-TOKEN`입니다. 세션 쿠키와 달리 CSRF 쿠키는 프론트가 읽을 수 있어야 합니다. 서버 도메인만의 쿠키는 다른 출처의 프론트에서 읽지 못하므로 동일 출처 프록시 구성이 권장됩니다. 교차 출처 구조에서는 CSRF 토큰 전달 계약을 별도로 맞추세요.
- 교차 출처 배포 시 서버 CORS에 정확한 프론트 출처, credentials, 필요한 메서드와 헤더를 허용해야 합니다. `*`와 credentials를 함께 사용하지 마세요.
- 기본 요청 제한 시간은 45초입니다. 분석이 오래 걸리는 서버는 작업 ID·폴링/SSE 계약으로 API 어댑터를 확장해야 합니다. 현재 구현은 분석 결과를 한 응답으로 받습니다.
- 응답은 본문 객체 또는 `{ "data": <객체> }`를 허용합니다. 목록은 배열을 반환합니다. 페이지네이션 객체를 반환하려면 어댑터 수정이 필요합니다.
- 오류는 HTTP 상태 코드와 `{ "code": "...", "message": "사용자에게 보여줄 메시지" }`를 권장합니다. 401/403/404/409/429/5xx/네트워크·타임아웃을 처리합니다.
- `GET /auth/me`의 401은 비로그인으로 처리합니다. 보호된 API의 401은 현재 캐시를 지우고 로그인 화면으로 이동합니다.

## 엔드포인트

아래 경로는 `VITE_API_BASE_URL` 기준입니다. 구체적인 입력 및 응답 스키마는 `lib/contracts.ts`가 기준입니다.

| 메서드·경로 | 요청 | 응답 |
| --- | --- | --- |
| GET `/auth/me` | 없음 | User 또는 null |
| POST `/auth/signup` | name, email, password | User; 자동 로그인하지 않음 |
| POST `/auth/login` | email, password | User + 세션 쿠키 |
| POST `/auth/logout` | 없음 | 204 또는 빈 응답 |
| PATCH `/users/me` | name, role | User |
| GET `/users` | 없음 | 접근 가능한 사용자 User[] |
| GET `/workspaces` | 없음 | Workspace[] |
| POST `/workspaces` | name | Workspace |
| GET `/workspaces/:id/projects` | 없음 | Project[] |
| POST `/workspaces/:id/projects` | ProjectInput | Project |
| GET `/projects/:id` | 없음 | Project |
| PATCH `/projects/:id` | ProjectInput | Project |
| DELETE `/projects/:id` | 없음 | 204 |
| POST `/projects/:id/members` | memberIds: string[] | Project |
| DELETE `/projects/:id/members/:userId` | 없음 | Project |
| GET `/projects/:id/meetings` | 없음 | Meeting[] |
| POST `/projects/:id/meetings` | MeetingInput | Meeting |
| PATCH `/meetings/:id` | MeetingInput | Meeting |
| DELETE `/meetings/:id` | 없음 | 204 |
| POST `/meetings/:id/analyze` | 없음; 서버에 저장된 원문 사용 | draft가 포함된 Meeting |
| PUT `/meetings/:id/draft` | Draft 전체 | Meeting |
| POST `/meetings/:id/confirm` | Draft 전체 | 확정된 Meeting |
| GET `/projects/:id/action-items` | 없음 | Task[] |
| POST `/projects/:id/action-items` | TaskInput | Task |
| PATCH `/action-items/:id` | TaskInput 전체 | Task |
| DELETE `/action-items/:id` | 없음 | 204 |

구성원 추가는 기존 사용자 선택입니다. 아직 가입하지 않은 이메일로 초대장을 전송하지 않습니다. `/users`는 서비스 정책에 맞는 디렉터리만 반환하고 개인정보를 무제한 공개하지 않아야 합니다.

## 데이터 형태

ID는 불투명한 문자열입니다. 날짜는 시간대 없는 `YYYY-MM-DD`, 시각은 시간대가 포함된 ISO 8601 문자열을 반환하세요. 화면의 오늘/임박/지연 계산은 사용자 기기의 현지 날짜 기준입니다.

```ts
type User = { id: string; name: string; email: string; role: string };
type Workspace = {
  id: string; name: string; ownerId: string; createdAt: string;
};
type Project = {
  id: string; workspaceId: string; name: string; description: string;
  memberIds: string[]; ownerId: string;
  createdAt: string; updatedAt: string; dueSoonDays: number;
};
type ProjectInput = {
  name: string; description: string; memberIds: string[]; dueSoonDays?: number;
};
type MeetingInput = {
  title: string; date: string; participantIds: string[]; notes: string;
};
type DraftTask = {
  id: string; title: string; description: string;
  assigneeId: string | null; dueDate: string | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW'; reason: string;
};
type Draft = {
  id: string; decisions: string[];
  schedule: { id: string; title: string; date: string | null }[];
  tasks: DraftTask[]; analyzedAt: string; source: 'AI' | 'LOCAL_DEMO';
};
type Meeting = {
  id: string; projectId: string; title: string; date: string;
  participantIds: string[]; notes: string;
  status: 'DRAFT' | 'REVIEW' | 'CONFIRMED'; draft: Draft | null;
  carryoverTaskIds: string[];
  createdAt: string; updatedAt: string; confirmedAt: string | null;
};
type Task = DraftTask & {
  projectId: string; meetingId: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  createdAt: string; updatedAt: string; completedAt: string | null;
};
type TaskInput = Omit<DraftTask, 'id'> & {
  status: Task['status']; meetingId?: string | null;
};
```

## 확정 처리의 필수 조건

1. 분석은 `REVIEW` 상태의 초안만 저장합니다. 실제 업무는 생성하지 않습니다.
2. 분석 실패 시 원문과 이전 저장 데이터를 유지합니다. 원문 변경 시 아직 확정하지 않은 분석 초안은 무효화합니다.
3. 확정 요청에 `Idempotency-Key: <meetingId>:<draftId>`가 전달됩니다. 서버는 해당 키와 사용자·프로젝트 범위를 검증하고 같은 초안의 재요청에서 업무를 중복 생성하지 않아야 합니다.
4. 초안 ID가 바뀌었으면 409로 거절합니다. 모든 업무의 제목·담당자·마감일과 프로젝트 멤버십을 검사합니다.
5. 회의 확정과 업무 일괄 생성을 한 트랜잭션으로 처리합니다. 신규 업무는 TODO이고 원본 회의 ID를 참조합니다. 결정/일정만 존재하는 확정은 가능하지만 완전히 빈 결과는 거절합니다.
6. 확정한 회의는 재분석하지 않습니다. 원본·기본 정보 수정과 이미 생성된 업무 수정은 별도 작업입니다.
7. 완료 전환 시 completedAt을 기록하고, 완료를 취소하면 null로 되돌립니다.

## 관계와 권한

- 서버가 모든 프로젝트·회의·업무 접근 권한을 검증해야 합니다. UI의 메뉴 숨김이나 로컬 체험의 검사만을 보안 경계로 사용하지 마세요.
- 프론트의 기본 정책은 프로젝트 생성자가 설정·삭제·구성원 변경을 관리하고, 구성원은 회의와 업무를 관리하는 단순 모델입니다. 별도 Admin 계층은 없습니다.
- 다음 회의 생성 시 같은 프로젝트의 이전 회의(날짜가 새 회의 날짜 이하)에서 아직 완료하지 않은 업무 ID를 `carryoverTaskIds`에 저장합니다. 업무를 복제하지 않습니다.
- 구성원 제거 시 그 사용자의 현재 업무 담당자를 null로 해제합니다. 과거 회의 참여자 기록은 보존합니다.
- 회의 삭제 시 기존 업무를 보존하고 meetingId를 null로 변경합니다.
- 업무 삭제 시 다른 회의의 carryoverTaskIds에서 해당 ID를 제거합니다.
- 프로젝트 삭제 시 해당 프로젝트의 회의와 업무를 함께 삭제합니다. 다른 프로젝트에는 영향을 주지 않습니다.
- 동시 수정 충돌은 서버 책임입니다. 현 계약에는 일반 PATCH의 버전/ETag 선조건이 없으므로 실서비스 다중 사용자 운영 전에 updatedAt 또는 revision/If-Match 검사를 추가하세요. 초안 확정 중복 방지와 일반 동시 수정은 별개입니다.

## 파일과 AI

- `.txt`와 `.md` 파일은 브라우저에서 UTF-8 텍스트로 읽으며, 1MB 및 원문 10만 자 제한이 있습니다. 서버에는 notes 문자열을 전송합니다. 파일 자체를 보관하거나 PDF/DOCX를 추출하지 않습니다.
- 체험 모드는 한국어 키워드와 날짜 표현을 이용한 규칙 기반 분석이며 LLM이 아닙니다. 불명확한 담당자와 기한은 비워 사용자가 검토하도록 합니다.
- 실제 LLM 호출·비밀키·요청 제한·비용 통제·로그 보안은 서버에서 구현하세요. 결과는 JSON 스키마를 검증해 `source: 'AI'`로 반환합니다.
- 불완전한 서버 응답은 UI로 전달하지 않고 오류로 처리합니다.

## 체험 저장소

`followup.demo.v1`은 localStorage, `followup.demo.session.v1`과 회의 편집 버퍼는 sessionStorage를 사용합니다. 등록 비밀번호는 salt와 PBKDF2 결과로 저장하지만 이것은 실제 인증 서버가 아니며 기기 사용자가 데이터를 수정할 수 있습니다. 실제 계정은 서버에서 비밀번호 정책·해싱·인증 시도 제한을 구현해야 합니다.

API 모드에서도 아직 제출하지 않은 회의 편집 내용은 탭의 sessionStorage에 임시 보관합니다. 민감 정보 정책에 따라 이 기능을 비활성화하거나 보관 기간을 제한하세요. 로그아웃은 세션을 종료하지만 로컬 프로젝트 데이터와 편집 버퍼를 일괄 삭제하지 않습니다.
