import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FollowUp — 회의에서 다음 행동으로',
  description:
    '회의록을 결정 사항과 후속 업무로. 검토하고 확정한 업무를 다음 회의까지 이어가는 팀의 작업 공간.',
  icons: { icon: '/brand/logo-symbol.png' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
