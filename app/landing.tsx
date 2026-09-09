'use client';
import type { MouseEvent } from 'react';
import {
  ArrowUpRight,
  Check,
  CheckSquare,
  ChevronRight,
  FileText,
  Sparkles,
  RefreshCw,
  Users,
  ArrowRight,
  CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Logo({
  white = false,
  symbol = false,
}: {
  white?: boolean;
  symbol?: boolean;
}) {
  return (
    // Original supplied brand bitmap; this static export has no image server.
    // oxlint-disable-next-line next/no-img-element
    <img
      className={symbol ? 'brand-symbol' : 'brand-logo'}
      src={`/brand/logo-${symbol ? 'symbol' : white ? 'full-white' : 'full'}.png`}
      alt="FollowUp"
    />
  );
}
export function BoardPreview({ onOpen }: { onOpen?: () => void }) {
  return (
    <div className="browser-frame">
      <div className="browser-bar">
        <span />
        <span />
        <span />
        <div>
          <span className="tiny-lock">●</span> followup.workspace
        </div>
        <ArrowUpRight size={14} />
      </div>
      <div className="preview-content">
        <div className="preview-nav">
          <Logo symbol />
          <div className="preview-tabs">
            <span>대시보드</span>
            <span>회의</span>
            <span className="active">후속 업무</span>
          </div>
          <span className="avatar">반</span>
        </div>
        <div className="preview-heading">
          <div>
            <span className="eyebrow">FOLLOWUP 팀 프로젝트</span>
            <h3>아이디어가, 실행이 되는 곳.</h3>
          </div>
          <span className="preview-count">
            전체 업무 <b>4</b>
          </span>
        </div>
        <div className="preview-board">
          {[
            {
              name: '예정',
              status: 'todo',
              cards: [
                {
                  title: '회원가입 UI',
                  who: '김',
                  priority: 'MEDIUM',
                  date: '09.12',
                },
                {
                  title: 'DB 설계',
                  who: '최',
                  priority: 'MEDIUM',
                  date: '09.11',
                },
              ],
            },
            {
              name: '진행 중',
              status: 'progress',
              cards: [
                {
                  title: '로그인 오류 수정',
                  who: '반',
                  priority: 'HIGH',
                  date: '09.10',
                },
              ],
            },
            {
              name: '완료',
              status: 'done',
              cards: [
                {
                  title: 'ERD 작성',
                  who: '최',
                  priority: 'LOW',
                  date: '09.01',
                },
              ],
            },
          ].map((col, i) => (
            <div
              className={`preview-column column-${col.status}`}
              key={col.name}
            >
              <header>
                <i className={`status-dot ${col.status}`} />
                {col.name}
                <span>{col.cards.length}</span>
              </header>
              {col.cards.map((t, j) => (
                <button onClick={onOpen} className="preview-task" key={t.title}>
                  <div className="task-key">
                    <CheckSquare size={14} /> FU-{101 + i * 2 + j}
                  </div>
                  <h4>{t.title}</h4>
                  <span className={`priority ${t.priority.toLowerCase()}`}>
                    {t.priority}
                  </span>
                  <footer>
                    <span>
                      <CalendarClock size={12} />
                      {t.date}
                    </span>
                    <span className={`avatar avatar-${t.who}`}>{t.who}</span>
                  </footer>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="preview-bottom">
          <span>
            <span className="live-dot" /> 팀의 다음 행동이 연결되고 있어요
          </span>
          <span>
            회의에서 다음 회의까지 <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </div>
  );
}
export function Landing({
  onLogin,
  onSignup,
  onDemo,
}: {
  onLogin: () => void;
  onSignup: () => void;
  onDemo: () => void;
}) {
  function scrollSection(event: MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(event.currentTarget.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }
  return (
    <div className="landing">
      <header className="marketing-nav">
        <a href="#top" onClick={scrollSection} aria-label="FollowUp 홈">
          <Logo />
        </a>
        <nav>
          <a href="#features" onClick={scrollSection}>
            기능
          </a>
          <a href="#pricing" onClick={scrollSection}>
            요금제
          </a>
          <button onClick={onLogin}>로그인</button>
          <Button className="fu-button small" onClick={onSignup}>
            무료로 시작하기 <ArrowUpRight size={14} />
          </Button>
        </nav>
      </header>
      <main id="top">
        <section className="hero">
          <div className="hero-light" aria-hidden="true" />
          <div className="hero-copy">
            <div className="hero-label">
              <Sparkles size={13} /> 모든 회의를, 다음 행동으로{' '}
              <ChevronRight size={12} />
            </div>
            <h1>
              회의는 끝나도,
              <br />
              <span>할 일은 남아있어요.</span>
            </h1>
            <p>
              흩어진 회의의 조각을, 명확한 다음 행동으로.
              <br />
              FollowUp이 팀의 일을 다음 회의까지 이어줍니다.
            </p>
            <div className="hero-actions">
              <Button className="fu-button" onClick={onSignup}>
                무료로 시작하기 <ArrowUpRight size={16} />
              </Button>
              <Button
                variant="outline"
                className="fu-button secondary"
                onClick={onDemo}
              >
                직접 둘러보기 <ArrowRight size={16} />
              </Button>
            </div>
            <span className="hero-note">
              카드 등록 없이 · 팀과 함께 · 바로 시작
            </span>
          </div>
          <div className="hero-product">
            <div className="product-halo" />
            <BoardPreview onOpen={onDemo} />
            <div className="floating-confirm">
              <span>
                <Check size={14} />
              </span>
              <div>
                회의가 다음 행동으로<b>후속 업무 3개가 만들어졌어요</b>
              </div>
              <Sparkles size={17} />
            </div>
          </div>
        </section>
        <section className="how-section section-wrap">
          <div className="how-grid">
            {[
              {
                icon: FileText,
                title: '회의록을 붙여넣어요',
                desc: '형식 걱정 없이, 편하게 적은 회의 메모 그대로.',
              },
              {
                icon: Sparkles,
                title: 'AI가 정리해요',
                desc: '결정 사항부터 담당자, 기한, 우선순위까지.',
              },
              {
                icon: CheckSquare,
                title: '검토하고 확정해요',
                desc: '필요한 부분만 수정하면 실제 업무로 반영돼요.',
              },
            ].map((s, i) => (
              <div key={s.title} className="how-step">
                <span className="step-number">0{i + 1}</span>
                <div className="step-icon">
                  <s.icon size={21} />
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="features section-wrap" id="features">
          <div className="section-title">
            <span className="eyebrow">LESS MEETING. MORE DOING.</span>
            <h2>
              회의 하나로
              <br />
              <span>끝나지 않게 만들어요.</span>
            </h2>
            <p>회의와 실행 사이. FollowUp이 그 빈틈을 메웁니다.</p>
          </div>
          <div className="feature-grid">
            {[
              {
                icon: Sparkles,
                title: '결정 사항만, 선명하게.',
                desc: '긴 회의 메모에서 단순한 의견과 결정된 내용을 구분해 정리해요.',
                class: 'feature-ai',
              },
              {
                icon: CheckSquare,
                title: '다음 행동은 이미 준비 완료.',
                desc: '담당자, 기한, 우선순위까지. AI 초안을 검토하고 업무로 확정하세요.',
                class: 'feature-tasks',
              },
              {
                icon: Users,
                title: '같은 방향으로, 함께.',
                desc: '누가 무엇을 맡았는지, 얼마나 끝냈는지. 팀의 진행 상황을 한눈에 확인해요.',
                class: 'feature-people',
              },
              {
                icon: RefreshCw,
                title: '지난 회의에서, 다음 회의로.',
                desc: '끝내지 못한 업무가 다음 회의에 연결돼요. 다시 묻지 않아도, 놓치지 않도록.',
                class: 'feature-loop',
              },
            ].map((f, i) => (
              <article className={`feature-card ${f.class}`} key={f.title}>
                <div className="feature-icon">
                  <f.icon size={21} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <div className="feature-example">
                  {i === 0 ? (
                    <>
                      <span className="muted">
                        검색 기능은 다음 버전에 넣으면 어떨까요?
                      </span>
                      <div>
                        <Check size={14} /> 이번 버전은 로그인 안정화에
                        집중한다.
                      </div>
                    </>
                  ) : i === 1 ? (
                    <>
                      <span className="task-key">
                        <CheckSquare size={14} /> FU-103
                      </span>
                      <div>
                        로그인 오류 수정{' '}
                        <span className="priority high">HIGH</span>
                      </div>
                      <span className="muted">반서현 · 금요일까지</span>
                    </>
                  ) : i === 2 ? (
                    <>
                      {['반서현', '장은호', '김도윤'].map((n, k) => (
                        <div className="example-progress" key={n}>
                          <span className="avatar">{n[0]}</span>
                          <span>{n}</span>
                          <div>
                            <i style={{ width: `${[75, 50, 100][k]}%` }} />
                          </div>
                          <b>{[75, 50, 100][k]}%</b>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <span className="loop-pill">
                        <FileText size={15} /> 지난 회의
                      </span>
                      <ArrowRight size={18} />
                      <span className="loop-pill next">
                        <RefreshCw size={15} /> 다음 회의
                      </span>
                      <small>미완료 업무 2개가 연결되었어요</small>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section id="pricing" className="pricing section-wrap">
          <div className="section-title">
            <span className="eyebrow">MADE FOR YOUR TEAM</span>
            <h2>
              팀 규모에 맞게
              <br />
              <span>시작하세요.</span>
            </h2>
            <p>요금제 디자인 미리보기 · 결제는 진행되지 않아요.</p>
          </div>
          <div className="pricing-grid">
            {[
              {
                name: '무료',
                desc: '작은 팀의 큰 시작을 위해.',
                price: '₩0',
                cta: '무료로 시작하기',
                features: [
                  '프로젝트 1개',
                  '구성원 최대 5명',
                  '회의 기록 무제한',
                  'AI 분석 월 20회',
                ],
              },
              {
                name: '팀',
                desc: '함께 만드는 일이 많아질 때.',
                price: '₩12,000',
                cta: '팀으로 시작하기',
                features: [
                  '프로젝트 무제한',
                  '구성원 무제한',
                  'AI 분석 무제한',
                  '업무 보드 · 필터',
                ],
              },
              {
                name: '엔터프라이즈',
                desc: '조직에 꼭 맞는 협업을 위해.',
                price: '문의',
                cta: '제품 먼저 둘러보기',
                features: ['SSO · 감사 로그', '전담 지원', '맞춤 온보딩'],
              },
            ].map((p, i) => (
              <article
                key={p.name}
                className={`price-card ${i === 1 ? 'featured' : ''}`}
              >
                <span className="price-name">
                  {p.name}
                  {i === 1 && <span>FOR TEAMS</span>}
                </span>
                <p>{p.desc}</p>
                <div className="price">
                  {p.price}
                  {i === 1 && <small>/ 인당 월</small>}
                </div>
                <Button
                  onClick={i === 2 ? onDemo : onSignup}
                  className={`fu-button ${i !== 1 ? 'secondary' : ''}`}
                >
                  {p.cta}
                  <ArrowUpRight size={15} />
                </Button>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>
                      <Check size={15} />
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
        <section className="cta-section section-wrap">
          <div className="cta-inner">
            <Logo symbol />
            <h2>
              다음 회의부터,
              <br />
              달라질 수 있어요.
            </h2>
            <p>좋은 대화가, 좋은 결과로 이어지도록.</p>
            <Button className="fu-button" onClick={onSignup}>
              무료로 시작하기 <ArrowUpRight size={17} />
            </Button>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div>
          <Logo white />
          <p>회의에서 다음 행동으로.</p>
        </div>
        <nav>
          <a href="#features" onClick={scrollSection}>
            기능
          </a>
          <a href="#pricing" onClick={scrollSection}>
            요금제
          </a>
          <button onClick={onDemo}>제품 둘러보기</button>
          <button onClick={onLogin}>로그인</button>
        </nav>
        <div className="footer-bottom">
          © 2026 FollowUp. All rights reserved.
          <span>Keep the conversation moving.</span>
        </div>
      </footer>
    </div>
  );
}
